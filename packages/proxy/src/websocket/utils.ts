import type { IncomingMessage } from 'node:http'
import { logger } from '../logger.js'

/**
 * Checks if an HTTP request is a WebSocket upgrade request
 */
export function isWebSocketUpgrade(req: IncomingMessage): boolean {
    const upgrade = req.headers.upgrade?.toString().toLowerCase()
    const connection = req.headers.connection?.toString().toLowerCase()
    
    return upgrade === 'websocket' && 
           connection?.includes('upgrade') === true &&
           req.method === 'GET'
}

/**
 * Extracts WebSocket protocols from the request headers
 */
export function extractWebSocketProtocols(req: IncomingMessage): string[] {
    const protocolHeader = req.headers['sec-websocket-protocol']
    if (!protocolHeader) return []
    
    return protocolHeader
        .toString()
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
}

/**
 * Extracts WebSocket extensions from the request headers
 */
export function extractWebSocketExtensions(req: IncomingMessage): string[] {
    const extensionHeader = req.headers['sec-websocket-extensions']
    if (!extensionHeader) return []
    
    return extensionHeader
        .toString()
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)
}

/**
 * Generates a unique connection ID
 */
export function generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Builds the upstream WebSocket URL from the original request
 */
export function buildUpstreamWebSocketUrl(req: IncomingMessage, isHttps: boolean): URL {
    const host = req.headers.host
    if (!host) {
        throw new Error('Missing Host header in WebSocket upgrade request')
    }
    
    const protocol = isHttps ? 'wss:' : 'ws:'
    const url = new URL(`${protocol}//${host}${req.url}`)
    
    logger.debug('Built upstream WebSocket URL', {
        component: 'websocket-utils',
        originalUrl: req.url,
        host,
        protocol,
        finalUrl: url.toString(),
        headers: {
            upgrade: req.headers.upgrade,
            connection: req.headers.connection,
            'sec-websocket-key': req.headers['sec-websocket-key'],
            'sec-websocket-version': req.headers['sec-websocket-version'],
            'sec-websocket-protocol': req.headers['sec-websocket-protocol']
        }
    })
    
    return url
}

/**
 * Checks if a hostname should be ignored for WebSocket proxying
 */
export function shouldIgnoreHost(hostname: string, ignoredHosts: string[] = []): boolean {
    return ignoredHosts.some(ignored => {
        if (ignored.startsWith('*.')) {
            const domain = ignored.slice(2)
            return hostname.endsWith(domain)
        }
        return hostname === ignored
    })
}

/**
 * Determines the message type from WebSocket frame data
 */
export function getWebSocketMessageType(opcode: number): 'text' | 'binary' | 'ping' | 'pong' | 'close' {
    switch (opcode) {
        case 0x1: return 'text'
        case 0x2: return 'binary'
        case 0x9: return 'ping'
        case 0xA: return 'pong'
        case 0x8: return 'close'
        default: return 'binary' // Default to binary for unknown opcodes
    }
}

/**
 * Safely converts buffer to text if it's valid UTF-8
 */
export function bufferToText(buffer: Buffer): string | undefined {
    try {
        return buffer.toString('utf8')
    } catch {
        return undefined
    }
}
