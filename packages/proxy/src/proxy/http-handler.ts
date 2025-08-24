import http, { IncomingMessage } from 'node:http'
import { genId, isHostIgnored, sanitizeHeaders } from './utils'
import type { PluginManager } from './plugin-manager'
import type { RequestContext } from '../plugins/types'
import { UrlProcessor } from './url-processor'
import { ContextBuilder } from './context-builder'
import { RequestBodyHandler } from './request-body-handler'
import { ResponseBodyHandler } from './response-body-handler'
import { UpstreamHandler } from './upstream-handler'
import { logger } from '../logger'

export class HttpHandler {
    private requestBodyHandler: RequestBodyHandler
    private responseBodyHandler: ResponseBodyHandler
    private upstreamHandler: UpstreamHandler

    constructor(
        private pluginManager: PluginManager,
        private onError: (err: unknown, ctx: any) => void,
        private ignoredHosts?: string[]
    ) {
        this.requestBodyHandler = new RequestBodyHandler(pluginManager)
        this.responseBodyHandler = new ResponseBodyHandler(pluginManager)
        this.upstreamHandler = new UpstreamHandler(onError)
    }

    async handleHttpRequest(
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        isHttps: boolean
    ): Promise<void> {
        const id = genId('req')
        const startTime = Date.now()

        try {
            // Parse URL
            const fullUrl = UrlProcessor.buildFullUrl(clientReq, isHttps)

            logger.logRequest(id, clientReq.method || 'UNKNOWN', fullUrl.toString(), {
                isHttps,
                hostname: fullUrl.hostname,
                port: fullUrl.port ? parseInt(fullUrl.port) : (isHttps ? 443 : 80)
            })

            // Check if host should be ignored - if so, create direct tunnel
            if (isHostIgnored(fullUrl.hostname, this.ignoredHosts)) {
                logger.debug('Request to ignored host, creating direct tunnel', {
                    requestId: id,
                    hostname: fullUrl.hostname,
                    component: 'http-handler'
                })
                await this.createDirectTunnel(clientReq, clientRes, fullUrl)
                return
            }

            // Build request context
            const reqCtx = ContextBuilder.buildRequestContext(
                fullUrl,
                clientReq,
                isHttps,
                id
            )

            // Execute request hook
            await this.pluginManager.runHook('onRequest', reqCtx)

            // Process request body if needed
            const { body: requestBodyToSend, updatedHeaders } =
                await this.requestBodyHandler.processBody(clientReq, reqCtx)

            // Update headers based on body processing
            if (requestBodyToSend) {
                this.requestBodyHandler.updateRequestHeaders(
                    reqCtx.requestOptions.headers,
                    updatedHeaders
                )
            }

            // Prefer uncompressed upstream responses if we plan to inspect/modify bodies
            const hasResBodyHook = this.pluginManager.hasHook('onResponseBody')
            if (hasResBodyHook) {
                reqCtx.requestOptions.headers['accept-encoding'] = 'identity'
            }

            // Forward to upstream and handle response
            await this.handleUpstreamRequest(
                fullUrl,
                reqCtx,
                clientReq,
                clientRes,
                requestBodyToSend,
                startTime
            )
        } catch (error) {
            const duration = Date.now() - startTime
            
            if (
                error instanceof Error &&
                error.message.includes('Host header')
            ) {
                const responseInfo = {
                    headersSent: clientRes.headersSent,
                    finished: clientRes.finished,
                    destroyed: clientRes.destroyed,
                    writable: clientRes.writable
                }
                
                logger.warn('Bad request: Missing host header', {
                    requestId: id,
                    duration,
                    component: 'http-handler',
                    url: clientReq.url,
                    method: clientReq.method,
                    headers: clientReq.headers,
                    responseInfo
                })
                
                try {
                    if (!clientRes.headersSent && clientRes.writable) {
                        logger.debug('Sending 400 Bad Request response', {
                            requestId: id,
                            component: 'http-handler'
                        })
                        clientRes.writeHead(400, 'Bad Request: Missing Host header')
                        clientRes.end()
                    } else {
                        logger.debug('Cannot send 400 response - headers already sent or not writable', {
                            requestId: id,
                            component: 'http-handler',
                            responseInfo
                        })
                    }
                } catch (writeError) {
                    logger.error('Failed to send 400 Bad Request response', writeError, {
                        requestId: id,
                        component: 'http-handler',
                        originalError: error.message,
                        responseInfo
                    })
                }
                return
            }
            
            const responseInfo = {
                headersSent: clientRes.headersSent,
                finished: clientRes.finished,
                destroyed: clientRes.destroyed,
                writable: clientRes.writable
            }
            
            logger.error('HTTP request handling failed', error, {
                requestId: id,
                duration,
                component: 'http-handler',
                url: clientReq.url,
                method: clientReq.method,
                responseInfo,
                errorCode: (error as any)?.code,
                errorErrno: (error as any)?.errno
            })
            
            this.onError(error, { id })
            
            try {
                if (!clientRes.headersSent && clientRes.writable) {
                    logger.debug('Sending 500 Internal Server Error response', {
                        requestId: id,
                        component: 'http-handler'
                    })
                    clientRes.writeHead(500, 'Internal Server Error')
                    clientRes.end('Internal server error')
                } else {
                    logger.debug('Cannot send 500 response - headers already sent or not writable', {
                        requestId: id,
                        component: 'http-handler',
                        responseInfo
                    })
                }
            } catch (writeError) {
                logger.error('Failed to send 500 Internal Server Error response', writeError, {
                    requestId: id,
                    component: 'http-handler',
                    originalError: error instanceof Error ? error.message : String(error),
                    responseInfo
                })
            }
        }
    }

    private async handleUpstreamRequest(
        fullUrl: URL,
        reqCtx: RequestContext,
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        requestBodyToSend?: Buffer,
        startTime?: number
    ): Promise<void> {
        try {
            const upRes = await this.upstreamHandler.sendRequest(
                fullUrl,
                reqCtx.requestOptions,
                reqCtx,
                clientReq,
                requestBodyToSend
            )

            // Build response context
            const resCtx = ContextBuilder.buildResponseContext(reqCtx, upRes)

            // Execute response hook
            await this.pluginManager.runHook('onResponse', resCtx)

            const statusCode = upRes.statusCode || 502
            const statusMessage = upRes.statusMessage
            const method = reqCtx.method.toUpperCase()

            // Try to process response body
            const processedBody = await this.responseBodyHandler.processBody(
                upRes,
                resCtx,
                method
            )

            if (processedBody) {
                // Send buffered response - body was processed, call completion hook
                await this.pluginManager.runHook('onResponseComplete', resCtx)
                this.upstreamHandler.sendBufferedResponse(
                    clientRes,
                    statusCode,
                    statusMessage,
                    processedBody.headers,
                    processedBody.body
                )
            } else {
                // Stream original response - no body processing, call completion hook immediately
                await this.pluginManager.runHook('onResponseComplete', resCtx)
                const headers =
                    this.responseBodyHandler.prepareStreamingHeaders(
                        resCtx.responseHeaders as any
                    )
                this.upstreamHandler.streamResponse(
                    upRes,
                    clientRes,
                    statusCode,
                    statusMessage,
                    headers
                )
            }

            // Log response
            const duration = startTime ? Date.now() - startTime : undefined
            logger.logResponse(reqCtx.id, statusCode, duration)
        } catch (err) {
            this.upstreamHandler.handleUpstreamError(
                err as Error,
                reqCtx,
                clientRes
            )
        }
    }

    private async createDirectTunnel(
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        fullUrl: URL
    ): Promise<void> {
        const port = parseInt(fullUrl.port || '') || (fullUrl.protocol === 'https:' ? 443 : 80)
        const sanitizedHeaders = sanitizeHeaders(clientReq.headers)
        const options = {
            hostname: fullUrl.hostname,
            port: port,
            method: clientReq.method,
            path: fullUrl.pathname + fullUrl.search,
            headers: sanitizedHeaders
        }

        const req = http.request(options, (res) => {
            logger.debug('Direct tunnel HTTP response received', {
                component: 'http-handler',
                hostname: fullUrl.hostname,
                port,
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                method: clientReq.method
            })
            
            clientRes.writeHead(res.statusCode || 200, res.statusMessage, res.headers)
            res.pipe(clientRes, { end: true })
            
            res.on('end', () => {
                logger.debug('Direct tunnel HTTP response completed', {
                    component: 'http-handler',
                    hostname: fullUrl.hostname,
                    port,
                    statusCode: res.statusCode
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
            
            logger.error('Direct tunnel connection failed', err, {
                component: 'http-handler',
                hostname: fullUrl.hostname,
                port,
                method: clientReq.method,
                url: fullUrl.toString(),
                responseInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            try {
                if (!clientRes.headersSent && clientRes.writable) {
                    logger.debug('Sending 502 Bad Gateway for direct tunnel error', {
                        component: 'http-handler',
                        hostname: fullUrl.hostname,
                        port
                    })
                    clientRes.writeHead(502, 'Bad Gateway')
                    clientRes.end('Error connecting to upstream server')
                } else {
                    logger.debug('Cannot send 502 response for direct tunnel - headers already sent or not writable', {
                        component: 'http-handler',
                        hostname: fullUrl.hostname,
                        port,
                        responseInfo
                    })
                }
            } catch (writeError) {
                logger.error('Failed to send 502 Bad Gateway response for direct tunnel', writeError, {
                    component: 'http-handler',
                    hostname: fullUrl.hostname,
                    port,
                    originalError: err.message,
                    responseInfo
                })
            }
        })

        logger.debug('Starting direct tunnel HTTP request', {
            component: 'http-handler',
            hostname: fullUrl.hostname,
            port,
            method: clientReq.method,
            path: fullUrl.pathname + fullUrl.search
        })
        
        clientReq.pipe(req, { end: true })
        
        req.on('finish', () => {
            logger.debug('Direct tunnel HTTP request sent', {
                component: 'http-handler',
                hostname: fullUrl.hostname,
                port,
                method: clientReq.method
            })
        })
    }
}
