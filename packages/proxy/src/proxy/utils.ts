import { randomBytes } from 'node:crypto'
import { IncomingHttpHeaders } from 'node:http'

export function genId(prefix = 'req'): string {
    return `${prefix}_${randomBytes(6).toString('hex')}`
}

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
): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) {
        if (!v) continue
        const lk = k.toLowerCase()
        if (lk === 'proxy-connection') continue
        if (
            lk === 'connection' &&
            typeof v === 'string' &&
            v.toLowerCase() === 'keep-alive'
        ) {
            out[k] = v
            continue
        }
        if (lk === 'connection') continue

        if (Array.isArray(v)) {
            out[k] = v.join(', ')
            continue
        }

        out[k] = v
    }
    return out
}

export function isHostIgnored(hostname: string, ignoredHosts?: string[]): boolean {
    if (!ignoredHosts || ignoredHosts.length === 0) return false
    
    const normalizedHostname = hostname.toLowerCase()
    
    return ignoredHosts.some(ignored => {
        const normalizedIgnored = ignored.toLowerCase()
        
        // Exact match
        if (normalizedHostname === normalizedIgnored) return true
        
        // Wildcard match (e.g., *.example.com matches subdomain.example.com)
        if (normalizedIgnored.startsWith('*.')) {
            const domain = normalizedIgnored.slice(2)
            return normalizedHostname === domain || normalizedHostname.endsWith('.' + domain)
        }
        
        // Subdomain match (e.g., example.com matches subdomain.example.com)
        return normalizedHostname.endsWith('.' + normalizedIgnored)
    })
}
