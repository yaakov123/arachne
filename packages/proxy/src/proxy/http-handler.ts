import http, { IncomingMessage } from 'node:http'
import { isHostIgnored } from './utils/headers'
import {
    createCorrelationId,
    extendCorrelationId,
    type CorrelationId,
} from './utils/ids'
import { sendHttpErrorResponse } from './error-responses'
import type { PluginManager } from './plugin-manager'
import type { RequestContext, ErrorContext } from '../plugins/types'
import { UrlProcessor } from './url-processor'
import { ContextBuilder } from './context-builder'
import { RequestBodyHandler } from './request-body-handler'
import { ResponseBodyHandler } from './response-body-handler'
import { UpstreamHandler } from './upstream-handler'
import { TunnelHandler } from './tunnel-handler'
import { logger } from '../logger'
import { DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT } from './constants'

export class HttpHandler {
    private requestBodyHandler: RequestBodyHandler
    private responseBodyHandler: ResponseBodyHandler
    private upstreamHandler: UpstreamHandler
    private tunnelHandler: TunnelHandler

    constructor(
        private pluginManager: PluginManager,
        private onError: (err: unknown, ctx: ErrorContext) => void,
        private ignoredHosts?: string[],
        maxBodySize?: number
    ) {
        this.requestBodyHandler = new RequestBodyHandler(
            pluginManager,
            maxBodySize
        )
        this.responseBodyHandler = new ResponseBodyHandler(
            pluginManager,
            maxBodySize
        )
        this.upstreamHandler = new UpstreamHandler(onError)
        this.tunnelHandler = new TunnelHandler(onError)
    }

    async handleHttpRequest(
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        isHttps: boolean,
        parentCorrelation?: CorrelationId
    ): Promise<void> {
        const correlation = parentCorrelation
            ? extendCorrelationId(parentCorrelation, 'req')
            : createCorrelationId('req')
        const id = correlation.full
        const startTime = Date.now()

        try {
            // Parse URL
            const fullUrl = UrlProcessor.buildFullUrl(clientReq, isHttps)

            logger.logRequest(
                id,
                clientReq.method || 'UNKNOWN',
                fullUrl.toString(),
                {
                    isHttps,
                    hostname: fullUrl.hostname,
                    port: fullUrl.port
                        ? parseInt(fullUrl.port)
                        : isHttps
                        ? DEFAULT_HTTPS_PORT
                        : DEFAULT_HTTP_PORT,
                }
            )

            // Check if host should be ignored - if so, create direct tunnel
            if (isHostIgnored(fullUrl.hostname, this.ignoredHosts)) {
                logger.debug(
                    'Request to ignored host, creating direct tunnel',
                    {
                        requestId: id,
                        hostname: fullUrl.hostname,
                        component: 'http-handler',
                    }
                )
                await this.tunnelHandler.createHttpTunnel(
                    clientReq,
                    clientRes,
                    {
                        hostname: fullUrl.hostname,
                        port:
                            parseInt(fullUrl.port || '') ||
                            (fullUrl.protocol === 'https:'
                                ? DEFAULT_HTTPS_PORT
                                : DEFAULT_HTTP_PORT),
                        isHttps: fullUrl.protocol === 'https:',
                        requestId: id,
                        path: fullUrl.pathname + fullUrl.search,
                    }
                )
                return
            }

            // Build request context
            const reqCtx = ContextBuilder.buildRequestContext(
                fullUrl,
                clientReq,
                isHttps,
                id,
                correlation.parentId
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
                logger.warn('Bad request: Missing host header', {
                    requestId: id,
                    duration,
                    component: 'http-handler',
                    url: clientReq.url,
                    method: clientReq.method,
                    headers: clientReq.headers,
                })

                sendHttpErrorResponse(
                    clientRes,
                    400,
                    'Bad Request: Missing Host header',
                    undefined,
                    logger,
                    {
                        requestId: id,
                        component: 'http-handler',
                        originalError: error.message,
                    }
                )
                return
            }

            logger.error('HTTP request handling failed', error, {
                requestId: id,
                duration,
                component: 'http-handler',
                url: clientReq.url,
                method: clientReq.method,
                errorCode: (error as NodeJS.ErrnoException)?.code,
                errorErrno: (error as NodeJS.ErrnoException)?.errno,
            })

            this.onError(error, { id })

            sendHttpErrorResponse(
                clientRes,
                500,
                'Internal Server Error',
                'Internal server error',
                logger,
                {
                    requestId: id,
                    component: 'http-handler',
                    originalError:
                        error instanceof Error ? error.message : String(error),
                }
            )
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
                // Send buffered response - body was processed
                // Call onResponseStart hook before sending
                await this.pluginManager.runHook('onResponseStart', resCtx)

                this.upstreamHandler.sendBufferedResponse(
                    clientRes,
                    statusCode,
                    statusMessage,
                    processedBody.headers,
                    processedBody.body
                )

                // Call completion hook after buffered response is sent
                await this.pluginManager.runHook('onResponseComplete', resCtx)
            } else {
                // Stream original response - no body processing
                // Call onResponseStart hook before streaming starts
                await this.pluginManager.runHook('onResponseStart', resCtx)

                const headers =
                    this.responseBodyHandler.prepareStreamingHeaders(
                        resCtx.responseHeaders
                    )

                // Set up completion hook to fire after streaming finishes
                this.upstreamHandler.streamResponse(
                    upRes,
                    clientRes,
                    statusCode,
                    statusMessage,
                    headers,
                    async () => {
                        try {
                            await this.pluginManager.runHook(
                                'onResponseComplete',
                                resCtx
                            )
                        } catch (error) {
                            logger.error(
                                'Error in onResponseComplete hook',
                                error,
                                {
                                    requestId: resCtx.id,
                                    component: 'http-handler',
                                }
                            )
                        }
                    }
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
}
