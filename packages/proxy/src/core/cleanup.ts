import net from 'node:net'
import http from 'node:http'
import tls from 'node:tls'
import { logger } from '../logger'

export interface TunnelCleanupOptions {
    requestId?: string
    component?: string
    hostname?: string
    port?: number
    reason?: string
}

export interface CleanupResource {
    type: 'socket' | 'server' | 'tls-server'
    resource: net.Socket | http.Server | tls.Server
    name?: string
}

/**
 * Creates a standardized cleanup function for tunnel connections
 * Handles graceful shutdown with proper error logging instead of silent failures
 */
export function createTunnelCleanup(
    resources: CleanupResource[],
    options: TunnelCleanupOptions = {}
): (reason?: string) => void {
    const { requestId, component = 'cleanup', hostname, port } = options
    
    return (reason?: string) => {
        const cleanupReason = reason || options.reason || 'unknown'
        
        logger.debug('Starting tunnel cleanup', {
            requestId,
            component,
            hostname,
            port,
            reason: cleanupReason,
            resourceCount: resources.length
        })
        
        for (const { type, resource, name } of resources) {
            try {
                const resourceName = name || `${type}-${resources.indexOf({ type, resource, name })}`
                
                if (type === 'socket') {
                    const socket = resource as net.Socket
                    if (!socket.destroyed) {
                        logger.debug('Destroying socket during cleanup', {
                            requestId,
                            component,
                            hostname,
                            port,
                            reason: cleanupReason,
                            resourceName,
                            socketDestroyed: socket.destroyed,
                            socketWritable: socket.writable,
                            socketReadable: socket.readable
                        })
                        socket.destroy()
                    } else {
                        logger.debug('Socket already destroyed during cleanup', {
                            requestId,
                            component,
                            hostname,
                            port,
                            reason: cleanupReason,
                            resourceName
                        })
                    }
                } else if (type === 'server' || type === 'tls-server') {
                    const server = resource as http.Server | tls.Server
                    logger.debug('Closing server during cleanup', {
                        requestId,
                        component,
                        hostname,
                        port,
                        reason: cleanupReason,
                        resourceName,
                        serverType: type
                    })
                    server.close()
                }
            } catch (error) {
                // Replace empty catch blocks with proper debug logging
                logger.debug('Error during resource cleanup', {
                    requestId,
                    component,
                    hostname,
                    port,
                    reason: cleanupReason,
                    resourceType: type,
                    resourceName: name || `${type}-${resources.indexOf({ type, resource, name })}`,
                    error: error instanceof Error ? error.message : String(error),
                    errorCode: (error as NodeJS.ErrnoException)?.code,
                    errorErrno: (error as NodeJS.ErrnoException)?.errno
                })
            }
        }
        
        logger.debug('Tunnel cleanup completed', {
            requestId,
            component,
            hostname,
            port,
            reason: cleanupReason,
            resourceCount: resources.length
        })
    }
}

/**
 * Creates a cleanup function specifically for socket destruction
 * Used for simple socket cleanup scenarios
 */
export function createSocketCleanup(
    socket: net.Socket,
    options: TunnelCleanupOptions = {}
): (reason?: string) => void {
    return createTunnelCleanup([{
        type: 'socket',
        resource: socket,
        name: options.hostname ? `socket-${options.hostname}:${options.port}` : 'socket'
    }], options)
}

/**
 * Creates a cleanup function for server resources
 * Used for TLS and HTTP server cleanup
 */
export function createServerCleanup(
    servers: Array<{ server: http.Server | tls.Server, name: string }>,
    options: TunnelCleanupOptions = {}
): (reason?: string) => void {
    const resources: CleanupResource[] = servers.map(({ server, name }) => ({
        type: server instanceof tls.Server ? 'tls-server' : 'server',
        resource: server,
        name
    }))
    
    return createTunnelCleanup(resources, options)
}

/**
 * Safely ends a socket with proper error logging
 * Replaces try/catch {} patterns for socket.end()
 */
export function safeSocketEnd(
    socket: net.Socket,
    options: TunnelCleanupOptions = {}
): void {
    const { requestId, component = 'cleanup', hostname, port } = options
    
    try {
        if (!socket.destroyed && socket.writable) {
            logger.debug('Ending socket connection', {
                requestId,
                component,
                hostname,
                port,
                socketDestroyed: socket.destroyed,
                socketWritable: socket.writable,
                socketReadable: socket.readable
            })
            socket.end()
        } else {
            logger.debug('Socket already destroyed or not writable, skipping end()', {
                requestId,
                component,
                hostname,
                port,
                socketDestroyed: socket.destroyed,
                socketWritable: socket.writable,
                socketReadable: socket.readable
            })
        }
    } catch (error) {
        logger.debug('Error ending socket connection', {
            requestId,
            component,
            hostname,
            port,
            error: error instanceof Error ? error.message : String(error),
            errorCode: (error as NodeJS.ErrnoException)?.code,
            errorErrno: (error as NodeJS.ErrnoException)?.errno,
            socketDestroyed: socket.destroyed,
            socketWritable: socket.writable,
            socketReadable: socket.readable
        })
    }
}
