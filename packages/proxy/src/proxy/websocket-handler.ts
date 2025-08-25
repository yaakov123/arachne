import http, { IncomingMessage } from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { isHostIgnored, sanitizeHeaders } from './utils'
import { createCorrelationId, extendCorrelationId, parseCorrelationId } from './correlation'
import { logger } from '../logger'
import { sendWebSocketErrorResponse } from './error-responses'
import { createSocketCleanup, safeSocketEnd } from './cleanup'

const pipelineAsync = promisify(pipeline)

export interface WebSocketUpgradeOptions {
    hostname: string
    port?: number
    isHttps: boolean
    ignoredHosts?: string[]
    requestId?: string
    connectId?: string
}

export interface WebSocketUpgradeResult {
    success: boolean
    error?: Error
}

export class WebSocketHandler {
    constructor(
        private onError: (err: unknown, ctx: any) => void
    ) {}

    async handleUpgrade(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer,
        options: WebSocketUpgradeOptions
    ): Promise<WebSocketUpgradeResult> {
        // Create correlation ID, extending from parent if available
        const parentCorrelation = options.connectId ? parseCorrelationId(options.connectId) : undefined
        const correlation = options.requestId 
            ? parseCorrelationId(options.requestId)
            : (parentCorrelation 
                ? extendCorrelationId(parentCorrelation, 'ws')
                : createCorrelationId('ws'))
        
        const upgradeId = correlation.full
        const { hostname, port = options.isHttps ? 443 : 80, isHttps, ignoredHosts, connectId } = options
        
        logger.debug('WebSocket upgrade request received', {
            requestId: upgradeId,
            connectId,
            hostname,
            port,
            isHttps,
            component: 'websocket-handler',
            url: req.url,
            headers: req.headers
        })
        
        try {
            // Check if host should be ignored - if so, create direct WebSocket tunnel
            if (isHostIgnored(hostname, ignoredHosts)) {
                logger.debug('Creating direct WebSocket tunnel for ignored host', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    component: 'websocket-handler'
                })
                return await this.createDirectTunnel(req, clientSocket, head, hostname, port, isHttps, upgradeId, connectId)
            }
            
            // Create upstream WebSocket connection
            return await this.createProxiedTunnel(req, clientSocket, head, hostname, port, isHttps, upgradeId, connectId)
            
        } catch (err) {
            logger.error('WebSocket upgrade handling failed', err, {
                requestId: upgradeId,
                connectId,
                hostname,
                port,
                component: 'websocket-handler'
            })
            
            this.onError(err, { id: upgradeId, hostname })
            
            sendWebSocketErrorResponse(clientSocket, 500, 'Internal Server Error', undefined, logger, {
                requestId: upgradeId,
                component: 'websocket-handler',
                hostname,
                port,
                originalError: err instanceof Error ? err.message : String(err)
            })
            
            safeSocketEnd(clientSocket, {
                requestId: upgradeId,
                component: 'websocket-handler',
                hostname,
                port
            })
            
            return { success: false, error: err as Error }
        }
    }

    private async createProxiedTunnel(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer,
        hostname: string,
        port: number,
        isHttps: boolean,
        upgradeId: string,
        connectId?: string
    ): Promise<WebSocketUpgradeResult> {
        // Prepare headers for upstream request
        const upstreamHeaders = sanitizeHeaders(req.headers)
        
        const requestModule = isHttps ? https : http
        const upstreamReq = requestModule.request({
            hostname,
            port,
            method: req.method,
            path: req.url,
            headers: upstreamHeaders
        })
        
        return new Promise((resolve) => {
            upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                logger.debug('Upstream WebSocket upgrade successful', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    isHttps,
                    component: 'websocket-handler',
                    statusCode: upstreamRes.statusCode
                })
                
                // Forward upgrade response to client
                const responseHeaders = Object.entries(upstreamRes.headers)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\r\n')
                
                const upgradeResponse = 
                    `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n` +
                    responseHeaders + '\r\n\r\n'
                
                clientSocket.write(upgradeResponse)
                
                // Forward any initial upstream data
                if (upstreamHead && upstreamHead.length > 0) {
                    logger.debug('Forwarding initial upstream WebSocket data', {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler',
                        dataLength: upstreamHead.length
                    })
                    clientSocket.write(upstreamHead)
                }
                
                logger.debug('Starting bidirectional WebSocket data piping', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    component: 'websocket-handler'
                })
                
                // Use pipeline for both directions with better error handling
                const clientToUpstream = pipelineAsync(clientSocket, upstreamSocket).catch((err) => {
                    logger.error('Client to upstream pipeline error in WebSocket tunnel', err, {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler',
                        direction: 'client-to-upstream',
                        errorCode: (err as any)?.code
                    })
                })
                
                const upstreamToClient = pipelineAsync(upstreamSocket, clientSocket).catch((err) => {
                    logger.error('Upstream to client pipeline error in WebSocket tunnel', err, {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler',
                        direction: 'upstream-to-client',
                        errorCode: (err as any)?.code
                    })
                })
                
                // Wait for both pipelines to complete
                Promise.allSettled([clientToUpstream, upstreamToClient]).then(() => {
                    logger.debug('WebSocket tunnel pipelines completed', {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler'
                    })
                })
                
                // Handle cleanup
                const cleanup = createSocketCleanup(upstreamSocket, {
                    requestId: upgradeId,
                    component: 'websocket-handler',
                    hostname,
                    port
                })
                
                clientSocket.on('close', () => cleanup('client-close'))
                clientSocket.on('end', () => cleanup('client-end'))
                upstreamSocket.on('close', () => cleanup('upstream-close'))
                upstreamSocket.on('end', () => cleanup('upstream-end'))
                
                upstreamSocket.on('error', (err) => {
                    logger.error('Upstream WebSocket socket error', err, {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler'
                    })
                    cleanup('upstream-error')
                })
                
                resolve({ success: true })
            })
            
            upstreamReq.on('error', (err) => {
                logger.error('WebSocket upgrade request failed', err, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    component: 'websocket-handler',
                    errorCode: (err as any)?.code,
                    errorErrno: (err as any)?.errno
                })
                
                try {
                    if (!clientSocket.destroyed && clientSocket.writable) {
                        logger.debug('Sending 502 Bad Gateway for WebSocket upgrade error', {
                            requestId: upgradeId,
                            connectId,
                            hostname,
                            port,
                            component: 'websocket-handler'
                        })
                        
                        sendWebSocketErrorResponse(clientSocket, 502, 'Bad Gateway', undefined, logger, {
                            requestId: upgradeId,
                            component: 'websocket-handler',
                            hostname,
                            port,
                            originalError: 'Upstream connection failed'
                        })
                        safeSocketEnd(clientSocket, {
                            requestId: upgradeId,
                            component: 'websocket-handler',
                            hostname,
                            port
                        })
                    }
                } catch (writeError) {
                    logger.error('Failed to send 502 response for WebSocket upgrade error', writeError, {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler',
                        originalError: err.message
                    })
                }
                
                resolve({ success: false, error: err })
            })
            
            // Send the upgrade request to upstream
            upstreamReq.end()
            
            // Forward any initial client data
            if (head && head.length > 0) {
                logger.debug('Forwarding initial client WebSocket data', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    component: 'websocket-handler',
                    dataLength: head.length
                })
                upstreamReq.write(head)
            }
        })
    }

    private async createDirectTunnel(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer,
        hostname: string,
        port: number,
        isHttps: boolean,
        upgradeId: string,
        connectId?: string
    ): Promise<WebSocketUpgradeResult> {
        logger.debug('Creating direct WebSocket tunnel for ignored host', {
            requestId: upgradeId,
            connectId,
            hostname,
            port,
            component: 'websocket-handler'
        })
        
        try {
            const requestModule = isHttps ? https : http
            const upstreamReq = requestModule.request({
                hostname,
                port,
                method: req.method,
                path: req.url,
                headers: req.headers // Use original headers for direct tunnel
            })
            
            return new Promise((resolve) => {
                upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                    logger.debug('Direct WebSocket tunnel upgrade successful', {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler',
                        statusCode: upstreamRes.statusCode
                    })
                    
                    // Forward upgrade response to client
                    const responseHeaders = Object.entries(upstreamRes.headers)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\r\n')
                    
                    const upgradeResponse = 
                        `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n` +
                        responseHeaders + '\r\n\r\n'
                    
                    clientSocket.write(upgradeResponse)
                    
                    // Forward any initial data
                    if (upstreamHead && upstreamHead.length > 0) {
                        clientSocket.write(upstreamHead)
                    }
                    
                    // Use pipeline for both directions with better error handling
                    const clientToUpstream = pipelineAsync(clientSocket, upstreamSocket).catch((err) => {
                        logger.error('Client to upstream pipeline error in direct WebSocket tunnel', err, {
                            requestId: upgradeId,
                            connectId,
                            hostname,
                            port,
                            component: 'websocket-handler',
                            direction: 'client-to-upstream',
                            errorCode: (err as any)?.code
                        })
                    })
                    
                    const upstreamToClient = pipelineAsync(upstreamSocket, clientSocket).catch((err) => {
                        logger.error('Upstream to client pipeline error in direct WebSocket tunnel', err, {
                            requestId: upgradeId,
                            connectId,
                            hostname,
                            port,
                            component: 'websocket-handler',
                            direction: 'upstream-to-client',
                            errorCode: (err as any)?.code
                        })
                    })
                    
                    // Wait for both pipelines to complete
                    Promise.allSettled([clientToUpstream, upstreamToClient]).then(() => {
                        logger.debug('Direct WebSocket tunnel pipelines completed', {
                            requestId: upgradeId,
                            connectId,
                            hostname,
                            port,
                            component: 'websocket-handler'
                        })
                    })
                    
                    // Cleanup handlers
                    const cleanup = createSocketCleanup(upstreamSocket, {
                        requestId: upgradeId,
                        component: 'websocket-handler',
                        hostname,
                        port
                    })
                    
                    clientSocket.on('close', cleanup)
                    clientSocket.on('end', cleanup)
                    upstreamSocket.on('close', cleanup)
                    upstreamSocket.on('end', cleanup)
                    
                    resolve({ success: true })
                })
                
                upstreamReq.on('error', (err) => {
                    logger.error('Direct WebSocket tunnel failed', err, {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        port,
                        component: 'websocket-handler'
                    })
                    
                    sendWebSocketErrorResponse(clientSocket, 502, 'Bad Gateway', undefined, logger, {
                        requestId: upgradeId,
                        component: 'websocket-handler',
                        hostname,
                        port,
                        originalError: 'Upstream WebSocket upgrade failed'
                    })
                    
                    safeSocketEnd(clientSocket, {
                        requestId: upgradeId,
                        component: 'websocket-handler',
                        hostname,
                        port
                    })
                    
                    resolve({ success: false, error: err })
                })
                
                upstreamReq.end()
                
                if (head && head.length > 0) {
                    upstreamReq.write(head)
                }
            })
            
        } catch (err) {
            logger.error('Direct WebSocket tunnel setup failed', err, {
                requestId: upgradeId,
                connectId,
                hostname,
                port,
                component: 'websocket-handler'
            })
            
            sendWebSocketErrorResponse(clientSocket, 500, 'Internal Server Error', undefined, logger, {
                requestId: upgradeId,
                component: 'websocket-handler',
                hostname,
                port,
                originalError: err instanceof Error ? err.message : String(err)
            })
            
            safeSocketEnd(clientSocket, {
                requestId: upgradeId,
                component: 'websocket-handler',
                hostname,
                port
            })
            
            return { success: false, error: err as Error }
        }
    }
}
