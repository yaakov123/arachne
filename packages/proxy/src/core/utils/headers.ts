import type { IncomingHttpHeaders } from 'node:http'
import { logger } from '../../logger'

export function parseHostPort(hostHeaderOrAuthority: string): {
    hostname: string
    port: number
} {
    // Handles forms like "example.com", "example.com:443", "127.0.0.1:8080", "[::1]:443"
    let hostname = hostHeaderOrAuthority
    let port = 0
    if (hostname.startsWith('[')) {
        // IPv6 authority
        const match = hostname.match(/^\[(.+?)\](?::(\d+))?$/)
        if (match) {
            hostname = match[1]
            port = match[2] ? parseInt(match[2], 10) : 0
        }
    } else if (hostname.includes(':')) {
        const idx = hostname.lastIndexOf(':')
        const maybePort = hostname.slice(idx + 1)
        if (/^\d+$/.test(maybePort)) {
            port = parseInt(maybePort, 10)
            hostname = hostname.slice(0, idx)
        }
    }
    return { hostname, port }
}

export function sanitizeHeaders(
    headers: IncomingHttpHeaders
): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {}

    // RFC 7230 Section 6.1 - Hop-by-hop headers that must not be forwarded
    const hopByHopHeaders = new Set([
        'connection',
        'proxy-connection',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
    ])

    // Parse Connection header to find additional hop-by-hop headers
    const connectionTokens = new Set<string>()
    const connectionValue = headers.connection || headers.Connection
    if (typeof connectionValue === 'string') {
        connectionValue.split(',').forEach((token) => {
            const trimmed = token.trim().toLowerCase()
            if (trimmed) connectionTokens.add(trimmed)
        })
    }

    for (const [k, v] of Object.entries(headers)) {
        if (!v) continue
        const lk = k.toLowerCase()

        // Skip hop-by-hop headers
        if (hopByHopHeaders.has(lk)) {
            // Special handling for Connection and Upgrade headers
            if (lk === 'connection' && typeof v === 'string') {
                const connectionValue = v.toLowerCase()
                // Allow keep-alive and upgrade (for WebSocket)
                if (
                    connectionValue === 'keep-alive' ||
                    connectionValue === 'upgrade'
                ) {
                    out[k] = v
                    continue
                }
            }
            if (lk === 'upgrade' && connectionTokens.has('upgrade')) {
                // Allow upgrade header when Connection: upgrade is present
                out[k] =
                    typeof v === 'string'
                        ? v
                        : Array.isArray(v)
                        ? v.join(', ')
                        : String(v)
                continue
            }
            continue
        }

        // Skip headers listed in Connection tokens (custom hop-by-hop headers)
        if (connectionTokens.has(lk)) continue

        // Preserve array structure for headers that can have multiple values
        // This is important for Set-Cookie and other headers that should maintain their array nature
        if (Array.isArray(v)) {
            out[k] = v
            continue
        }

        out[k] = v
    }
    return out
}

export function isHostIgnored(
    hostname: string,
    ignoredHosts?: string[]
): boolean {
    if (!ignoredHosts || ignoredHosts.length === 0) return false

    const normalizedHostname = hostname.toLowerCase()

    return ignoredHosts.some((ignored) => {
        const normalizedIgnored = ignored.toLowerCase()

        // Exact match
        if (normalizedHostname === normalizedIgnored) return true

        // Wildcard match (e.g., *.example.com matches subdomain.example.com)
        if (normalizedIgnored.startsWith('*.')) {
            const domain = normalizedIgnored.slice(2)
            return (
                normalizedHostname === domain ||
                normalizedHostname.endsWith('.' + domain)
            )
        }

        // Subdomain match (e.g., example.com matches subdomain.example.com)
        return normalizedHostname.endsWith('.' + normalizedIgnored)
    })
}

export function shouldIgnoreHost(
    hostname: string,
    hostFilter?: string[],
    hostFilterMode: 'blacklist' | 'whitelist' = 'blacklist'
): boolean {
    logger.info('shouldIgnoreHost', {
        hostname,
        hostFilter,
        hostFilterMode,
    })
    if (!hostFilter || hostFilter.length === 0) {
        // If no filter is set, default behavior depends on mode
        // Blacklist: don't ignore anything (capture all)
        // Whitelist: ignore everything (capture nothing)
        return hostFilterMode === 'whitelist'
    }

    const normalizedHostname = hostname.toLowerCase()

    const matchesFilter = hostFilter.some((pattern) => {
        const normalizedPattern = pattern.toLowerCase()

        // Exact match
        if (normalizedHostname === normalizedPattern) return true

        // Wildcard match (e.g., *.example.com matches subdomain.example.com)
        if (normalizedPattern.startsWith('*.')) {
            const domain = normalizedPattern.slice(2)
            return (
                normalizedHostname === domain ||
                normalizedHostname.endsWith('.' + domain)
            )
        }

        // Subdomain match (e.g., example.com matches subdomain.example.com)
        return normalizedHostname.endsWith('.' + normalizedPattern)
    })

    // In blacklist mode: ignore if it matches the filter
    // In whitelist mode: ignore if it doesn't match the filter
    return hostFilterMode === 'blacklist' ? matchesFilter : !matchesFilter
}

export function getNumericHeader(
    h: string | string[] | number | undefined
): number | undefined {
    if (typeof h === 'number') return h
    if (typeof h === 'string') {
        const n = parseInt(h, 10)
        return isNaN(n) ? undefined : n
    }
    if (Array.isArray(h)) {
        for (const v of h) {
            const n = parseInt(v, 10)
            if (!isNaN(n)) return n
        }
    }
    return undefined
}

export function headerToString(
    h: string | string[] | undefined
): string | undefined {
    if (typeof h === 'string') return h
    if (Array.isArray(h)) return h[0]
    return undefined
}
