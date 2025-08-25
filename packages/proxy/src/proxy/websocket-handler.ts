import http, { IncomingMessage } from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { isHostIgnored, sanitizeHeaders } from './utils/headers'
import { createCorrelationId, extendCorrelationId, parseCorrelationId } from './utils/ids'
import { logger } from '../logger'
import { sendWebSocketErrorResponse } from './error-responses'
import { createSocketCleanup, safeSocketEnd } from './cleanup'
import { DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT } from './constants'
import { ErrorContext } from '../plugins/types'

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

interface WebSocketTunnelOptions {
    req: IncomingMessage
    clientSocket: net.Socket
    head: Buffer
    hostname: string
    port: number
    isHttps: boolean
    upgradeId: string
    connectId?: string
    useProxyHeaders: boolean
}

export class WebSocketHandler {
    constructor(
        private onError: (err: unknown, ctx: ErrorContext) => void
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
        const { hostname, port = options.isHttps ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT, isHttps, ignoredHosts, connectId } = options
        
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
            // Use shared tunnel creation logic
            const useProxyHeaders = !isHostIgnored(hostname, ignoredHosts)
            
            if (!useProxyHeaders) {
                logger.debug('Creating direct WebSocket tunnel for ignored host', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    component: 'websocket-handler'
                })
            }
            
            return await this.createWebSocketTunnel({
                req,
                clientSocket,
                head,
                hostname,
                port,
                isHttps,
                upgradeId,
                connectId,
                useProxyHeaders
            })
            
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

    private async createWebSocketTunnel(options: WebSocketTunnelOptions): Promise<WebSocketUpgradeResult> {
        const { req, clientSocket, head, hostname, port, isHttps, upgradeId, connectId, useProxyHeaders } = options
        
        // Prepare headers - use sanitized headers for proxy mode, original for direct mode
        const upstreamHeaders = useProxyHeaders ? sanitizeHeaders(req.headers) : req.headers
        
        const requestModule = isHttps ? https : http
        const upstreamReq = requestModule.request({
            hostname,
            port,
            method: req.method,
            path: req.url,
            headers: upstreamHeaders
        })
        
        const tunnelType = useProxyHeaders ? 'proxied' : 'direct'
        
        return new Promise((resolve) => {
            upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                logger.debug(`${tunnelType} WebSocket tunnel upgrade successful`, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    isHttps,
                    component: 'websocket-handler',
                    statusCode: upstreamRes.statusCode,
                    tunnelType
                })
                
                // Forward upgrade response to client using shared method
                this.forwardUpgradeResponse(clientSocket, upstreamRes, upstreamHead, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    tunnelType
                })
                
                // Setup bidirectional data piping using shared method
                this.setupTunnelPiping(clientSocket, upstreamSocket, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    tunnelType
                })
                
                resolve({ success: true })
            })
            
            upstreamReq.on('error', (err) => {
                logger.error(`${tunnelType} WebSocket tunnel failed`, err, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    component: 'websocket-handler',
                    errorCode: (err as NodeJS.ErrnoException)?.code,
                    errorErrno: (err as NodeJS.ErrnoException)?.errno,
                    tunnelType
                })
                
                this.handleTunnelError(clientSocket, err, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    tunnelType
                })
                
                resolve({ success: false, error: err })
            })
            
            // Send the upgrade request to upstream
            upstreamReq.end()
            
            // Forward any initial client data
            if (head && head.length > 0) {
                logger.debug(`Forwarding initial client WebSocket data for ${tunnelType} tunnel`, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    port,
                    component: 'websocket-handler',
                    dataLength: head.length,
                    tunnelType
                })
                upstreamReq.write(head)
            }
        })
    }

    private forwardUpgradeResponse(
        clientSocket: net.Socket, 
        upstreamRes: IncomingMessage, 
        upstreamHead: Buffer,
        logContext: { requestId: string; connectId?: string; hostname: string; port: number; tunnelType: string }
    ): void {
        // Format and send upgrade response
        const responseHeaders = Object.entries(upstreamRes.headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\r\n')
        
        const upgradeResponse = 
            `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n` +
            responseHeaders + '\r\n\r\n'
        
        clientSocket.write(upgradeResponse)
        
        // Forward any initial upstream data
        if (upstreamHead && upstreamHead.length > 0) {
            logger.debug(`Forwarding initial upstream WebSocket data for ${logContext.tunnelType} tunnel`, {
                ...logContext,
                component: 'websocket-handler',
                dataLength: upstreamHead.length
            })
            clientSocket.write(upstreamHead)
        }
    }

    private setupTunnelPiping(
        clientSocket: net.Socket,
        upstreamSocket: net.Socket,
        logContext: { requestId: string; connectId?: string; hostname: string; port: number; tunnelType: string }
    ): void {
        logger.debug(`Starting bidirectional WebSocket data piping for ${logContext.tunnelType} tunnel`, {
            ...logContext,
            component: 'websocket-handler'
        })
        
        // Use pipeline for both directions with proper error handling
        const clientToUpstream = pipelineAsync(clientSocket, upstreamSocket).catch((err) => {
            logger.error(`Client to upstream pipeline error in ${logContext.tunnelType} WebSocket tunnel`, err, {
                ...logContext,
                component: 'websocket-handler',
                direction: 'client-to-upstream',
                errorCode: (err as NodeJS.ErrnoException)?.code
            })
        })
        
        const upstreamToClient = pipelineAsync(upstreamSocket, clientSocket).catch((err) => {
            logger.error(`Upstream to client pipeline error in ${logContext.tunnelType} WebSocket tunnel`, err, {
                ...logContext,
                component: 'websocket-handler',
                direction: 'upstream-to-client',
                errorCode: (err as NodeJS.ErrnoException)?.code
            })
        })
        
        // Wait for both pipelines to complete
        Promise.allSettled([clientToUpstream, upstreamToClient]).then(() => {
            logger.debug(`${logContext.tunnelType} WebSocket tunnel pipelines completed`, {
                ...logContext,
                component: 'websocket-handler'
            })
        })
        
        // Setup cleanup handlers using shared cleanup
        const cleanup = createSocketCleanup(upstreamSocket, {
            requestId: logContext.requestId,
            component: 'websocket-handler',
            hostname: logContext.hostname,
            port: logContext.port
        })
        
        // Handle socket events consistently
        clientSocket.on('close', () => cleanup('client-close'))
        clientSocket.on('end', () => cleanup('client-end'))
        upstreamSocket.on('close', () => cleanup('upstream-close'))
        upstreamSocket.on('end', () => cleanup('upstream-end'))
        
        upstreamSocket.on('error', (err) => {
            logger.error(`Upstream WebSocket socket error in ${logContext.tunnelType} tunnel`, err, {
                ...logContext,
                component: 'websocket-handler'
            })
            cleanup('upstream-error')
        })
    }

    private handleTunnelError(
        clientSocket: net.Socket,
        err: Error,
        logContext: { requestId: string; connectId?: string; hostname: string; port: number; tunnelType: string }
    ): void {
        try {
            if (!clientSocket.destroyed && clientSocket.writable) {
                logger.debug(`Sending 502 Bad Gateway for ${logContext.tunnelType} WebSocket upgrade error`, {
                    ...logContext,
                    component: 'websocket-handler'
                })
                
                const errorMessage = logContext.tunnelType === 'direct' 
                    ? 'Upstream WebSocket upgrade failed'
                    : 'Upstream connection failed'
                
                sendWebSocketErrorResponse(clientSocket, 502, 'Bad Gateway', undefined, logger, {
                    requestId: logContext.requestId,
                    component: 'websocket-handler',
                    hostname: logContext.hostname,
                    port: logContext.port,
                    originalError: errorMessage
                })
                
                safeSocketEnd(clientSocket, {
                    requestId: logContext.requestId,
                    component: 'websocket-handler',
                    hostname: logContext.hostname,
                    port: logContext.port
                })
            }
        } catch (writeError) {
            logger.error(`Failed to send 502 response for ${logContext.tunnelType} WebSocket upgrade error`, writeError, {
                ...logContext,
                component: 'websocket-handler',
                originalError: err.message
            })
        }
    }
}
