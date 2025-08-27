import { randomBytes } from 'node:crypto'

/**
 * Correlation ID system for tracing requests across the proxy pipeline.
 * 
 * Format: conn_<id>:req_<id>:ws_<id>
 * - Connection ID: Initial connection (CONNECT tunnel, TLS handshake)
 * - Request ID: HTTP request within connection
 * - WebSocket ID: WebSocket upgrade within request
 * 
 * This hierarchical system allows tracing flows like:
 * CONNECT tunnel → HTTP request → WebSocket upgrade
 */

export type IdPrefix = 'conn' | 'req' | 'ws' | 'tunnel-http' | 'tunnel-connect' | 'ws-http'

export interface CorrelationId {
    /** Full correlation ID string (e.g., "conn_abc123:req_def456") */
    readonly full: string
    /** Connection ID component */
    readonly connectionId?: string
    /** Request ID component */
    readonly requestId?: string
    /** WebSocket ID component */
    readonly wsId?: string
    /** Parent correlation ID this was derived from */
    readonly parentId?: string
}

/**
 * Generates a new base correlation ID with the given prefix
 */
export function generateId(prefix: IdPrefix): string {
    return `${prefix}_${randomBytes(6).toString('hex')}`
}

/**
 * Creates a new correlation ID from scratch
 */
export function createCorrelationId(prefix: IdPrefix): CorrelationId {
    const id = generateId(prefix)
    
    switch (prefix) {
        case 'conn':
            return {
                full: id,
                connectionId: id
            }
        case 'req':
        case 'ws-http':
        case 'tunnel-http':
        case 'tunnel-connect':
            return {
                full: id,
                requestId: id
            }
        case 'ws':
            return {
                full: id,
                wsId: id
            }
        default:
            return {
                full: id
            }
    }
}

/**
 * Creates a child correlation ID by extending an existing one
 */
export function extendCorrelationId(parent: CorrelationId, prefix: IdPrefix): CorrelationId {
    const childId = generateId(prefix)
    
    switch (prefix) {
        case 'req':
        case 'ws-http':
        case 'tunnel-http':
        case 'tunnel-connect': {
            // Add request to connection
            const requestId = childId
            const connectionId = parent.connectionId || parent.requestId
            const full = connectionId ? `${connectionId}:${requestId}` : requestId
            
            return {
                full,
                connectionId,
                requestId,
                parentId: parent.full
            }
        }
        case 'ws': {
            // Add WebSocket to request chain
            const wsId = childId
            const connectionId = parent.connectionId
            const requestId = parent.requestId || parent.wsId
            
            let full = wsId
            if (requestId) {
                full = connectionId ? `${connectionId}:${requestId}:${wsId}` : `${requestId}:${wsId}`
            }
            
            return {
                full,
                connectionId,
                requestId,
                wsId,
                parentId: parent.full
            }
        }
        case 'conn': {
            // New connection (shouldn't typically extend from another ID)
            return createCorrelationId(prefix)
        }
        default: {
            return {
                full: `${parent.full}:${childId}`,
                connectionId: parent.connectionId,
                requestId: parent.requestId,
                wsId: parent.wsId,
                parentId: parent.full
            }
        }
    }
}

/**
 * Parses a correlation ID string back into its components
 */
export function parseCorrelationId(correlationId: string): CorrelationId {
    const parts = correlationId.split(':')
    
    let connectionId: string | undefined
    let requestId: string | undefined
    let wsId: string | undefined
    
    for (const part of parts) {
        if (part.startsWith('conn_')) {
            connectionId = part
        } else if (part.startsWith('req_') || part.startsWith('ws-http_') || 
                   part.startsWith('tunnel-http_') || part.startsWith('tunnel-connect_')) {
            requestId = part
        } else if (part.startsWith('ws_')) {
            wsId = part
        }
    }
    
    return {
        full: correlationId,
        connectionId,
        requestId,
        wsId
    }
}

/**
 * Legacy compatibility function - generates simple prefixed ID
 * @deprecated Use createCorrelationId() for new code
 */
export function genId(prefix: IdPrefix = 'req'): string {
    return generateId(prefix)
}

/**
 * Helper to extract just the ID portion for logging backwards compatibility
 */
export function getIdForLogging(correlation: CorrelationId): string {
    return correlation.full
}
