import http, { IncomingMessage } from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { sanitizeHeaders } from './utils/headers'
import { generateId } from './utils/ids'
import { getSocketInfo } from './utils/sockets'
import { safeSocketEnd } from './cleanup'
import { logger } from '../logger'
import { USER_AGENT, PROXY_AGENT_HEADER } from './constants'
import { ErrorContext } from '../plugins/types'

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
    constructor(private onError: (err: unknown, ctx: ErrorContext) => void) {}

    /**
     * Creates a direct HTTP tunnel for ignored hosts
     */
    async createHttpTunnel(
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        options: HttpTunnelOptions
    ): Promise<ConnectTunnelResult> {
        const {
            hostname,
            port,
            isHttps = false,
            requestId = generateId('tunnel-http'),
        } = options

        const sanitizedHeaders = sanitizeHeaders(clientReq.headers)
        const requestOptions = {
            hostname,
            port,
            method: clientReq.method,
            path: options.path || clientReq.url || '/',
            headers: sanitizedHeaders,
        }

        const requestModule = isHttps ? https : http

        logger.debug('Starting direct HTTP tunnel', {
            requestId,
            component: 'tunnel-handler',
            hostname,
            port,
            isHttps,
            method: clientReq.method,
            path: requestOptions.path,
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
                    method: clientReq.method,
                })

                clientRes.writeHead(
                    res.statusCode || 200,
                    res.statusMessage,
                    res.headers
                )

                // Use pipeline for better error handling and backpressure
                pipelineAsync(res, clientRes)
                    .then(() => {
                        logger.debug('Direct HTTP tunnel response completed', {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            statusCode: res.statusCode,
                        })
                    })
                    .catch((pipelineError) => {
                        const errorCode = (
                            pipelineError as NodeJS.ErrnoException
                        )?.code
                        const logContext = {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            statusCode: res.statusCode,
                            errorCode,
                        }

                        // Log premature close errors at debug level - these are normal in proxy scenarios
                        if (errorCode === 'ERR_STREAM_PREMATURE_CLOSE') {
                            logger.debug(
                                'Direct HTTP tunnel response pipeline closed prematurely (normal)',
                                logContext
                            )
                        } else {
                            logger.error(
                                'Direct HTTP tunnel pipeline error',
                                pipelineError,
                                logContext
                            )
                        }
                    })
            })

            req.on('error', (err) => {
                const responseInfo = {
                    headersSent: clientRes.headersSent,
                    finished: clientRes.finished,
                    destroyed: clientRes.destroyed,
                    writable: clientRes.writable,
                }

                logger.error('Direct HTTP tunnel connection failed', err, {
                    requestId,
                    component: 'tunnel-handler',
                    hostname,
                    port,
                    method: clientReq.method,
                    responseInfo,
                    errorCode: (err as NodeJS.ErrnoException)?.code,
                    errorErrno: (err as NodeJS.ErrnoException)?.errno,
                })

                try {
                    if (!clientRes.headersSent && clientRes.writable) {
                        logger.debug(
                            'Sending 502 Bad Gateway for direct HTTP tunnel error',
                            {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port,
                            }
                        )
                        clientRes.writeHead(502, 'Bad Gateway')
                        clientRes.end('Error connecting to upstream server')
                    } else {
                        logger.debug(
                            'Cannot send 502 response for direct HTTP tunnel - headers already sent or not writable',
                            {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port,
                                responseInfo,
                            }
                        )
                    }
                } catch (writeError) {
                    logger.error(
                        'Failed to send 502 Bad Gateway response for direct HTTP tunnel',
                        writeError,
                        {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            originalError: err.message,
                            responseInfo,
                        }
                    )
                }
            })

            // Use pipeline for request body streaming with better error handling
            pipelineAsync(clientReq, req)
                .then(() => {
                    logger.debug('Direct HTTP tunnel request sent', {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        method: clientReq.method,
                    })
                })
                .catch((pipelineError) => {
                    const errorCode = (pipelineError as NodeJS.ErrnoException)
                        ?.code
                    const logContext = {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        method: clientReq.method,
                        errorCode,
                    }

                    // Log premature close errors at debug level - these are normal in proxy scenarios
                    if (errorCode === 'ERR_STREAM_PREMATURE_CLOSE') {
                        logger.debug(
                            'Direct HTTP tunnel request pipeline closed prematurely (normal)',
                            logContext
                        )
                    } else {
                        logger.error(
                            'Direct HTTP tunnel request pipeline error',
                            pipelineError,
                            logContext
                        )
                    }
                })

            return { success: true }
        } catch (err) {
            logger.error('Direct HTTP tunnel setup failed', err, {
                requestId,
                component: 'tunnel-handler',
                hostname,
                port,
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
        const {
            hostname,
            port,
            requestId = generateId('tunnel-connect'),
        } = options

        logger.debug('Creating direct CONNECT tunnel', {
            requestId,
            component: 'tunnel-handler',
            hostname,
            port,
            clientSocketInfo: getSocketInfo(clientSocket),
            headLength: head?.length || 0,
        })

        try {
            const upstreamSocket = new net.Socket()

            return new Promise((resolve) => {
                upstreamSocket.connect(port, hostname, () => {
                    logger.debug(
                        'Direct CONNECT tunnel connection established',
                        {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            clientSocketInfo: getSocketInfo(clientSocket),
                            upstreamSocketInfo: getSocketInfo(upstreamSocket),
                        }
                    )

                    // Send successful connection response
                    clientSocket.write(
                        'HTTP/1.1 200 Connection Established\r\n' +
                            `${PROXY_AGENT_HEADER}: ${USER_AGENT}\r\n` +
                            '\r\n'
                    )

                    // Forward any initial data
                    if (head && head.length) {
                        logger.debug(
                            'Forwarding initial HEAD data in direct CONNECT tunnel',
                            {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port,
                                headLength: head.length,
                            }
                        )
                        upstreamSocket.write(head)
                    }

                    logger.debug(
                        'Starting bidirectional data piping for direct CONNECT tunnel',
                        {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            clientSocketInfo: getSocketInfo(clientSocket),
                        }
                    )

                    // Use pipeline for both directions with better error handling
                    const clientToUpstream = pipelineAsync(
                        clientSocket,
                        upstreamSocket
                    ).catch((err) => {
                        const errorCode = (err as NodeJS.ErrnoException)?.code
                        const logContext = {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            direction: 'client-to-upstream',
                            errorCode,
                        }

                        // Log premature close and connection reset errors at debug level - these are normal in proxy scenarios
                        if (
                            errorCode === 'ERR_STREAM_PREMATURE_CLOSE' ||
                            errorCode === 'ECONNRESET'
                        ) {
                            logger.debug(
                                'Client to upstream pipeline closed prematurely in CONNECT tunnel (normal)',
                                logContext
                            )
                        } else {
                            logger.error(
                                'Client to upstream pipeline error in CONNECT tunnel',
                                err,
                                logContext
                            )
                        }
                    })

                    const upstreamToClient = pipelineAsync(
                        upstreamSocket,
                        clientSocket
                    ).catch((err) => {
                        const errorCode = (err as NodeJS.ErrnoException)?.code
                        const logContext = {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            direction: 'upstream-to-client',
                            errorCode,
                        }

                        // Log premature close and connection reset errors at debug level - these are normal in proxy scenarios
                        if (
                            errorCode === 'ERR_STREAM_PREMATURE_CLOSE' ||
                            errorCode === 'ECONNRESET'
                        ) {
                            logger.debug(
                                'Upstream to client pipeline closed prematurely in CONNECT tunnel (normal)',
                                logContext
                            )
                        } else {
                            logger.error(
                                'Upstream to client pipeline error in CONNECT tunnel',
                                err,
                                logContext
                            )
                        }
                    })

                    // Wait for both pipelines to complete
                    Promise.allSettled([
                        clientToUpstream,
                        upstreamToClient,
                    ]).then(() => {
                        logger.debug('CONNECT tunnel pipelines completed', {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                        })
                    })

                    resolve({ success: true })
                })

                upstreamSocket.on('error', (err) => {
                    const clientSocketInfo = {
                        clientSocketInfo: getSocketInfo(clientSocket),
                        destroyed: clientSocket.destroyed,
                        readable: clientSocket.readable,
                        writable: clientSocket.writable,
                    }

                    const upstreamSocketInfo = {
                        upstreamSocketInfo: getSocketInfo(upstreamSocket),
                        destroyed: upstreamSocket.destroyed,
                        readable: upstreamSocket.readable,
                        writable: upstreamSocket.writable,
                    }

                    const errorCode = (err as any)?.code
                    const logContext = {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        clientSocketInfo,
                        upstreamSocketInfo,
                        errorCode,
                        errorErrno: (err as any)?.errno,
                    }

                    // Log connection reset errors at debug level - these are normal in proxy scenarios
                    if (errorCode === 'ECONNRESET') {
                        logger.debug(
                            'Upstream socket connection reset in direct CONNECT tunnel (normal)',
                            logContext
                        )
                    } else {
                        logger.error(
                            'Upstream socket error in direct CONNECT tunnel',
                            err,
                            logContext
                        )
                    }

                    try {
                        if (!clientSocket.destroyed && clientSocket.writable) {
                            logger.debug(
                                'Sending 502 Bad Gateway to client socket for upstream error',
                                {
                                    requestId,
                                    component: 'tunnel-handler',
                                    hostname,
                                    port,
                                    clientSocketInfo:
                                        getSocketInfo(clientSocket),
                                }
                            )
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
                                port,
                            })
                        } else {
                            logger.debug(
                                'Cannot write 502 response to client socket - already destroyed or not writable',
                                {
                                    requestId,
                                    component: 'tunnel-handler',
                                    hostname,
                                    port,
                                    clientSocketInfo,
                                }
                            )
                        }
                    } catch (writeError) {
                        logger.error(
                            'Failed to write 502 response to client socket for upstream error',
                            writeError,
                            {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port,
                                originalError: err.message,
                                clientSocketInfo,
                            }
                        )
                    }

                    resolve({ success: false, error: err })
                })

                // Clean up when client disconnects
                const cleanup = (reason: string) => {
                    logger.debug(
                        'Cleaning up direct CONNECT tunnel connection',
                        {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            reason,
                            clientSocketInfo: getSocketInfo(clientSocket),
                            upstreamDestroyed: upstreamSocket.destroyed,
                        }
                    )
                    try {
                        if (!upstreamSocket.destroyed) {
                            upstreamSocket.destroy()
                        }
                    } catch (destroyError) {
                        logger.error(
                            'Error destroying upstream socket during cleanup',
                            destroyError,
                            {
                                requestId,
                                component: 'tunnel-handler',
                                hostname,
                                port,
                                reason,
                            }
                        )
                    }
                }

                clientSocket.on('close', () => cleanup('client-close'))
                clientSocket.on('end', () => cleanup('client-end'))
                upstreamSocket.on('close', () => {
                    logger.debug(
                        'Upstream socket closed in direct CONNECT tunnel',
                        {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            clientSocketInfo: getSocketInfo(clientSocket),
                        }
                    )
                })
            })
        } catch (err) {
            const clientSocketInfo = {
                clientSocketInfo: getSocketInfo(clientSocket),
                destroyed: clientSocket.destroyed,
                readable: clientSocket.readable,
                writable: clientSocket.writable,
            }

            logger.error('Direct CONNECT tunnel setup failed', err, {
                requestId,
                component: 'tunnel-handler',
                hostname,
                port,
                clientSocketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno,
            })

            this.onError(err, { hostname, port })

            try {
                if (!clientSocket.destroyed && clientSocket.writable) {
                    logger.debug(
                        'Closing client socket after direct CONNECT tunnel setup failure',
                        {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            clientSocketInfo: getSocketInfo(clientSocket),
                        }
                    )
                    safeSocketEnd(clientSocket, {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                    })
                } else {
                    logger.debug(
                        'Client socket already destroyed or not writable after direct CONNECT tunnel setup failure',
                        {
                            requestId,
                            component: 'tunnel-handler',
                            hostname,
                            port,
                            clientSocketInfo,
                        }
                    )
                }
            } catch (closeError) {
                logger.error(
                    'Failed to close client socket after direct CONNECT tunnel setup failure',
                    closeError,
                    {
                        requestId,
                        component: 'tunnel-handler',
                        hostname,
                        port,
                        originalError:
                            err instanceof Error ? err.message : String(err),
                        clientSocketInfo,
                    }
                )
            }

            return { success: false, error: err as Error }
        }
    }
}
