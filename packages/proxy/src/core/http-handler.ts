import http, { IncomingMessage } from 'node:http'
import { shouldIgnoreHost } from './utils/headers'
import {
    createCorrelationId,
    extendCorrelationId,
    type CorrelationId,
} from './utils/ids'
import { sendHttpErrorResponse } from './error-responses'
import type { PluginManager } from './plugin-manager'
import type { ErrorContext } from '../plugins/types'
import { UrlProcessor } from './url-processor'
import { ContextAccumulator } from './context-accumulator'
import { BodyHandler } from './body-handler'
import { UpstreamHandler } from './upstream-handler'
import { TunnelHandler } from './tunnel-handler'
import { logger } from '../logger'
import { DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT } from './constants'
import { ProxyConfigStore } from './config-store'

/**
 * Handles HTTP requests using the new simplified plugin API
 */
export class HttpHandler {
    private bodyHandler: BodyHandler
    private upstreamHandler: UpstreamHandler
    private tunnelHandler: TunnelHandler

    constructor(
        private pluginManager: PluginManager,
        private onError: (err: unknown, ctx: ErrorContext) => void,
        private configStore: ProxyConfigStore
    ) {
        this.bodyHandler = new BodyHandler(configStore.current.maxBodySize)
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
            if (
                shouldIgnoreHost(
                    fullUrl.hostname,
                    this.configStore.current.hostFilter,
                    this.configStore.current.hostFilterMode
                )
            ) {
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

            // Buffer request body if needed
            const requestBody = await this.bodyHandler.bufferRequestBody(
                clientReq
            )

            // Create context accumulator
            const contextAccumulator = new ContextAccumulator(
                fullUrl,
                clientReq,
                isHttps,
                id,
                correlation.parentId,
                requestBody
            )

            // Execute beforeRequest hooks
            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder =
                await this.pluginManager.executeBeforeRequest(beforeRequestCtx)

            // Build afterRequest context and execute hooks
            const afterRequestCtx =
                contextAccumulator.buildAfterRequestContext(requestBuilder)
            await this.pluginManager.executeAfterRequest(afterRequestCtx)

            // Get final request state for upstream
            const finalRequest = contextAccumulator.getFinalRequestState()

            // Check if we need to buffer responses (if any response hooks exist)
            const hasResponseHooks = this.pluginManager.hasResponseHooks()

            // Prefer uncompressed responses if we plan to buffer them
            if (hasResponseHooks) {
                finalRequest.headers['accept-encoding'] = 'identity'
            }

            // Forward to upstream and handle response
            await this.handleUpstreamRequest(
                contextAccumulator,
                clientReq,
                clientRes,
                hasResponseHooks,
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
        contextAccumulator: ContextAccumulator,
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        hasResponseHooks: boolean,
        startTime?: number
    ): Promise<void> {
        const finalRequest = contextAccumulator.getFinalRequestState()
        try {
            // Convert final request to request options
            const requestOptions = {
                protocol: finalRequest.url.protocol as 'http:' | 'https:',
                hostname: finalRequest.url.hostname,
                port:
                    parseInt(finalRequest.url.port) ||
                    (finalRequest.url.protocol === 'https:'
                        ? DEFAULT_HTTPS_PORT
                        : DEFAULT_HTTP_PORT),
                path: finalRequest.url.pathname + finalRequest.url.search,
                method: finalRequest.method,
                headers: finalRequest.headers,
            }

            // Send request to upstream
            const upRes = await this.upstreamHandler.sendRequest(
                finalRequest.url,
                requestOptions,
                contextAccumulator.getAfterRequestContext(),
                clientReq,
                finalRequest.body
            )

            const statusCode = upRes.statusCode || 502
            const statusMessage = upRes.statusMessage
            const responseHeaders = this.normalizeHeaders(upRes.headers)

            // Buffer response body if we have response hooks
            const responseBody = await this.bodyHandler.bufferResponseBody(
                upRes,
                finalRequest.method,
                statusCode,
                hasResponseHooks
            )

            if (hasResponseHooks && responseBody !== undefined) {
                // We have response hooks and buffered body - execute hooks
                const beforeResponseCtx =
                    contextAccumulator.buildBeforeResponseContext(
                        statusCode,
                        statusMessage,
                        responseHeaders,
                        responseBody
                    )
                const responseBuilder =
                    await this.pluginManager.executeBeforeResponse(
                        beforeResponseCtx
                    )

                // Get final response state

                // Send buffered response to client
                const finalHeaders =
                    this.bodyHandler.prepareHeadersForBufferedContent(
                        responseBuilder.getHeaders(),
                        responseBuilder.getBody()?.length || 0
                    )

                this.upstreamHandler.sendBufferedResponse(
                    clientRes,
                    responseBuilder.getStatusCode(),
                    responseBuilder.getStatusMessage(),
                    finalHeaders,
                    responseBuilder.getBody() || Buffer.alloc(0)
                )

                // Execute afterResponse hooks
                const afterResponseCtx =
                    contextAccumulator.buildAfterResponseContext(
                        responseBuilder
                    )
                await this.pluginManager.executeAfterResponse(afterResponseCtx)
            } else {
                // No response hooks or couldn't buffer - stream response directly
                const streamHeaders =
                    this.bodyHandler.prepareHeadersForStreaming(responseHeaders)

                this.upstreamHandler.streamResponse(
                    upRes,
                    clientRes,
                    statusCode,
                    statusMessage,
                    streamHeaders,
                    async () => {
                        // If we have response hooks but couldn't buffer, still call them with empty body
                        if (hasResponseHooks) {
                            try {
                                const beforeResponseCtx =
                                    contextAccumulator.buildBeforeResponseContext(
                                        statusCode,
                                        statusMessage,
                                        responseHeaders,
                                        undefined // No body available
                                    )
                                const responseBuilder =
                                    await this.pluginManager.executeBeforeResponse(
                                        beforeResponseCtx
                                    )
                                const afterResponseCtx =
                                    contextAccumulator.buildAfterResponseContext(
                                        responseBuilder
                                    )
                                await this.pluginManager.executeAfterResponse(
                                    afterResponseCtx
                                )
                            } catch (error) {
                                logger.error(
                                    'Error in response hooks during streaming',
                                    error,
                                    {
                                        requestId:
                                            contextAccumulator.buildBeforeRequestContext()
                                                .id,
                                        component: 'http-handler',
                                    }
                                )
                            }
                        }
                    }
                )
            }

            // Log response
            const duration = startTime ? Date.now() - startTime : undefined
            logger.logResponse(
                contextAccumulator.buildBeforeRequestContext().id,
                statusCode,
                duration
            )
        } catch (err) {
            this.upstreamHandler.handleUpstreamError(
                err as Error,
                contextAccumulator.getAfterRequestContext(),
                clientRes
            )
        }
    }

    private normalizeHeaders(
        headers: Record<string, string | string[] | undefined>
    ): Record<string, string | string[]> {
        const normalized: Record<string, string | string[]> = {}
        for (const [key, value] of Object.entries(headers)) {
            if (value !== undefined) {
                normalized[key] = value
            }
        }
        return normalized
    }
}
