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
        'upgrade'
    ])
    
    // Parse Connection header to find additional hop-by-hop headers
    const connectionTokens = new Set<string>()
    const connectionValue = headers.connection || headers.Connection
    if (typeof connectionValue === 'string') {
        connectionValue.split(',').forEach(token => {
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
                if (connectionValue === 'keep-alive' || connectionValue === 'upgrade') {
                    out[k] = v
                    continue
                }
            }
            if (lk === 'upgrade' && connectionTokens.has('upgrade')) {
                // Allow upgrade header when Connection: upgrade is present
                out[k] = typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : String(v)
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

export interface SocketInfo {
    remoteAddress?: string
    remotePort?: number
    localAddress?: string
    localPort?: number
    destroyed: boolean
    readable: boolean
    writable: boolean
}

export function getSocketInfo(socket: any): SocketInfo {
    return {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        localAddress: socket.localAddress,
        localPort: socket.localPort,
        destroyed: socket.destroyed,
        readable: socket.readable,
        writable: socket.writable
    }
}

export interface ErrorResponseOptions {
    requestId?: string
    component?: string
    hostname?: string
    port?: number
    originalError?: string
    socketInfo?: SocketInfo
}

export function sendErrorResponse(
    socket: any,
    statusCode: number,
    statusMessage: string,
    body?: string,
    logger?: any,
    options?: ErrorResponseOptions
): boolean {
    try {
        if (!socket.destroyed && socket.writable) {
            const response = body 
                ? `HTTP/1.1 ${statusCode} ${statusMessage}\r\nContent-Type: text/plain\r\nContent-Length: ${body.length}\r\n\r\n${body}`
                : `HTTP/1.1 ${statusCode} ${statusMessage}\r\n\r\n`
            
            if (logger && options) {
                logger.debug(`Sending ${statusCode} ${statusMessage} response`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    remoteAddress: socket.remoteAddress,
                    remotePort: socket.remotePort
                })
            }
            
            socket.write(response)
            return true
        } else {
            if (logger && options) {
                logger.debug(`Cannot send ${statusCode} response - socket already destroyed or not writable`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    socketInfo: getSocketInfo(socket)
                })
            }
            return false
        }
    } catch (writeError) {
        if (logger && options) {
            logger.error(`Failed to send ${statusCode} ${statusMessage} response`, writeError, {
                requestId: options.requestId,
                component: options.component,
                hostname: options.hostname,
                port: options.port,
                originalError: options.originalError,
                socketInfo: getSocketInfo(socket)
            })
        }
        return false
    }
}

export function sendHttpErrorResponse(
    res: any,
    statusCode: number,
    statusMessage: string,
    body?: string,
    logger?: any,
    options?: ErrorResponseOptions
): boolean {
    const responseInfo = {
        headersSent: res.headersSent,
        finished: res.finished,
        destroyed: res.destroyed,
        writable: res.writable
    }
    
    try {
        if (!res.headersSent && res.writable) {
            if (logger && options) {
                logger.debug(`Sending ${statusCode} ${statusMessage} response`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port
                })
            }
            
            res.writeHead(statusCode, statusMessage)
            if (body) {
                res.end(body)
            } else {
                res.end()
            }
            return true
        } else {
            if (logger && options) {
                logger.debug(`Cannot send ${statusCode} response - headers already sent or not writable`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    responseInfo
                })
            }
            return false
        }
    } catch (writeError) {
        if (logger && options) {
            logger.error(`Failed to send ${statusCode} ${statusMessage} response`, writeError, {
                requestId: options.requestId,
                component: options.component,
                hostname: options.hostname,
                port: options.port,
                originalError: options.originalError,
                responseInfo
            })
        }
        return false
    }
}
