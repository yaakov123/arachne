import http, { IncomingMessage } from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { sanitizeHeaders } from './utils'
import { generateId } from './correlation'
import { safeSocketEnd } from './cleanup'
import { logger } from '../logger'
import { USER_AGENT, PROXY_AGENT_HEADER } from './constants'

const pipelineAsync = promisify(pipeline)

export interface TunnelOptions {
    hostname: string
    port: number
    isHttps?: boolean
    requestId?: string
}

export interface HttpTunnelOptions extends TunnelOptions {
    method?: string
    path?: string
    headers?: Record<string, any>
}

export interface ConnectTunnelResult {
    success: boolean
    error?: Error
}

export class TunnelHandler {
    constructor(
        private onError: (err: unknown, ctx: any) => void
    ) {}

    /**
     * Creates a direct HTTP tunnel for ignored hosts
     */
    async createHttpTunnel(
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        options: HttpTunnelOptions
    ): Promise<ConnectTunnelResult> {
        const { hostname, port, isHttps = false, requestId = generateId('tunnel-http') } = options
        
        const sanitizedHeaders = sanitizeHeaders(clientReq.headers)
        const requestOptions = {
            hostname,
            port,
            method: clientReq.method,
            path: options.path || (clientReq.url || '/'),
            headers: sanitizedHeaders
        }

        const requestModule = isHttps ? https : http
        
        logger.debug('Starting direct HTTP tunnel', {
            requestId,
            component: 'tunnel-handler',
            hostname,
            port,
            isHttps,
            method: clientReq.method,
            path: requestOptions.path
        })

        try {
            const req = requestModule.request(requestOptions, (res) => {
                logger.debug('Direct HTTP tunnel response received', {
                    requestId,
                    component: 'tunnel-handler',
                    hostname,
                    port,
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    method: clientReq.method
                })
                
                clientRes.writeHead(res.statusCode || 200, res.statusMessage, res.headers)
                
                // Use pipeline for better error handling and backpressure
                pipelineAsync(res, clientRes).then(() => {
                    logger.debug('Direct HTTP tunnel response completed', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        statusCode: res.statusCode
                    })
                }).catch((pipelineError) => {
                    logger.error('Direct HTTP tunnel pipeline error', pipelineError, {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        statusCode: res.statusCode,
                        errorCode: (pipelineError as any)?.code
                    })
                })
            })

            req.on('error', (err) => {
                const responseInfo = {
                    headersSent: clientRes.headersSent,
                    finished: clientRes.finished,
                    destroyed: clientRes.destroyed,
                    writable: clientRes.writable
                }
                
                logger.error('Direct HTTP tunnel connection failed', err, {
                    requestId,
                    component: 'tunnel-handler',
                    hostname,
                    port,
                    method: clientReq.method,
                    responseInfo,
                    errorCode: (err as any)?.code,
                    errorErrno: (err as any)?.errno
                })
                
                try {
                    if (!clientRes.headersSent && clientRes.writable) {
                        logger.debug('Sending 502 Bad Gateway for direct HTTP tunnel error', {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port
                        })
                        clientRes.writeHead(502, 'Bad Gateway')
                        clientRes.end('Error connecting to upstream server')
                    } else {
                        logger.debug('Cannot send 502 response for direct HTTP tunnel - headers already sent or not writable', {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            responseInfo
                        })
                    }
                } catch (writeError) {
                    logger.error('Failed to send 502 Bad Gateway response for direct HTTP tunnel', writeError, {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        originalError: err.message,
                        responseInfo
                    })
                }
            })
            
            // Use pipeline for request body streaming with better error handling
            pipelineAsync(clientReq, req).then(() => {
                logger.debug('Direct HTTP tunnel request sent', {
                    requestId,
                    component: 'tunnel-handler',
                    hostname,
                    port,
                    method: clientReq.method
                })
            }).catch((pipelineError) => {
                logger.error('Direct HTTP tunnel request pipeline error', pipelineError, {
                    requestId,
                    component: 'tunnel-handler',
                    hostname,
                    port,
                    method: clientReq.method,
                    errorCode: (pipelineError as any)?.code
                })
            })

            return { success: true }
            
        } catch (err) {
            logger.error('Direct HTTP tunnel setup failed', err, {
                requestId,
                component: 'tunnel-handler',
                hostname,
                port
            })
            
            this.onError(err, { hostname, port })
            return { success: false, error: err as Error }
        }
    }

    /**
     * Creates a direct TCP tunnel for CONNECT requests to ignored hosts
     */
    async createConnectTunnel(
        clientSocket: net.Socket,
        options: TunnelOptions,
        head?: Buffer
    ): Promise<ConnectTunnelResult> {
        const { hostname, port, requestId = generateId('tunnel-connect') } = options
        
        logger.debug('Creating direct CONNECT tunnel', {
            requestId,
            component: 'tunnel-handler',
            hostname,
            port,
            clientRemoteAddress: (clientSocket as any).remoteAddress,
            headLength: head?.length || 0
        })
        
        try {
            const upstreamSocket = new net.Socket()
            
            return new Promise((resolve) => {
                upstreamSocket.connect(port, hostname, () => {
                    logger.debug('Direct CONNECT tunnel connection established', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        clientRemoteAddress: (clientSocket as any).remoteAddress,
                        upstreamLocalAddress: (upstreamSocket as any).localAddress,
                        upstreamLocalPort: (upstreamSocket as any).localPort
                    })
                    
                    // Send successful connection response
                    clientSocket.write(
                        'HTTP/1.1 200 Connection Established\r\n' +
                            `${PROXY_AGENT_HEADER}: ${USER_AGENT}\r\n` +
                            '\r\n'
                    )
                    
                    // Forward any initial data
                    if (head && head.length) {
                        logger.debug('Forwarding initial HEAD data in direct CONNECT tunnel', {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            headLength: head.length
                        })
                        upstreamSocket.write(head)
                    }
                    
                    logger.debug('Starting bidirectional data piping for direct CONNECT tunnel', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        clientRemoteAddress: (clientSocket as any).remoteAddress
                    })
                    
                    // Use pipeline for both directions with better error handling
                    const clientToUpstream = pipelineAsync(clientSocket, upstreamSocket).catch((err) => {
                        logger.error('Client to upstream pipeline error in CONNECT tunnel', err, {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            direction: 'client-to-upstream',
                            errorCode: (err as any)?.code
                        })
                    })
                    
                    const upstreamToClient = pipelineAsync(upstreamSocket, clientSocket).catch((err) => {
                        logger.error('Upstream to client pipeline error in CONNECT tunnel', err, {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            direction: 'upstream-to-client',
                            errorCode: (err as any)?.code
                        })
                    })
                    
                    // Wait for both pipelines to complete
                    Promise.allSettled([clientToUpstream, upstreamToClient]).then(() => {
                        logger.debug('CONNECT tunnel pipelines completed', {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port
                        })
                    })
                    
                    resolve({ success: true })
                })
                
                upstreamSocket.on('error', (err) => {
                    const clientSocketInfo = {
                        remoteAddress: (clientSocket as any).remoteAddress,
                        remotePort: (clientSocket as any).remotePort,
                        destroyed: clientSocket.destroyed,
                        readable: clientSocket.readable,
                        writable: clientSocket.writable
                    }
                    
                    const upstreamSocketInfo = {
                        remoteAddress: (upstreamSocket as any).remoteAddress,
                        remotePort: (upstreamSocket as any).remotePort,
                        destroyed: upstreamSocket.destroyed,
                        readable: upstreamSocket.readable,
                        writable: upstreamSocket.writable
                    }
                    
                    logger.error('Upstream socket error in direct CONNECT tunnel', err, {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        clientSocketInfo,
                        upstreamSocketInfo,
                        errorCode: (err as any)?.code,
                        errorErrno: (err as any)?.errno
                    })
                    
                    try {
                        if (!clientSocket.destroyed && clientSocket.writable) {
                            logger.debug('Sending 502 Bad Gateway to client socket for upstream error', {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port,
                                clientRemoteAddress: (clientSocket as any).remoteAddress
                            })
                            clientSocket.write(
                                'HTTP/1.1 502 Bad Gateway\r\n' +
                                    'Content-Type: text/plain\r\n' +
                                    'Content-Length: 19\r\n' +
                                    '\r\n' +
                                    'Connection failed\r\n'
                            )
                            safeSocketEnd(clientSocket, {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port
                            })
                        } else {
                            logger.debug('Cannot write 502 response to client socket - already destroyed or not writable', {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port,
                                clientSocketInfo
                            })
                        }
                    } catch (writeError) {
                        logger.error('Failed to write 502 response to client socket for upstream error', writeError, {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            originalError: err.message,
                            clientSocketInfo
                        })
                    }
                    
                    resolve({ success: false, error: err })
                })
                
                // Clean up when client disconnects
                const cleanup = (reason: string) => {
                    logger.debug('Cleaning up direct CONNECT tunnel connection', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        reason,
                        clientRemoteAddress: (clientSocket as any).remoteAddress,
                        upstreamDestroyed: upstreamSocket.destroyed
                    })
                    try {
                        if (!upstreamSocket.destroyed) {
                            upstreamSocket.destroy()
                        }
                    } catch (destroyError) {
                        logger.error('Error destroying upstream socket during cleanup', destroyError, {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            reason
                        })
                    }
                }
                
                clientSocket.on('close', () => cleanup('client-close'))
                clientSocket.on('end', () => cleanup('client-end'))
                upstreamSocket.on('close', () => {
                    logger.debug('Upstream socket closed in direct CONNECT tunnel', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        clientRemoteAddress: (clientSocket as any).remoteAddress
                    })
                })
            })
            
        } catch (err) {
            const clientSocketInfo = {
                remoteAddress: (clientSocket as any).remoteAddress,
                remotePort: (clientSocket as any).remotePort,
                destroyed: clientSocket.destroyed,
                readable: clientSocket.readable,
                writable: clientSocket.writable
            }
            
            logger.error('Direct CONNECT tunnel setup failed', err, {
                requestId,
                component: 'tunnel-handler',
                hostname,
                port,
                clientSocketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            this.onError(err, { hostname, port })
            
            try {
                if (!clientSocket.destroyed && clientSocket.writable) {
                    logger.debug('Closing client socket after direct CONNECT tunnel setup failure', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        clientRemoteAddress: (clientSocket as any).remoteAddress
                    })
                    safeSocketEnd(clientSocket, {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port
                    })
                } else {
                    logger.debug('Client socket already destroyed or not writable after direct CONNECT tunnel setup failure', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        clientSocketInfo
                    })
                }
            } catch (closeError) {
                logger.error('Failed to close client socket after direct CONNECT tunnel setup failure', closeError, {
                    requestId,
                    component: 'tunnel-handler',
                    hostname,
                    port,
                    originalError: err instanceof Error ? err.message : String(err),
                    clientSocketInfo
                })
            }
            
            return { success: false, error: err as Error }
        }
    }
}
