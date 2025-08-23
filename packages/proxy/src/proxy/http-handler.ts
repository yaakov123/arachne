import http, { IncomingMessage } from 'node:http'
import { genId, isHostIgnored } from './utils'
import type { PluginManager } from './plugin-manager'
import type { RequestContext } from '../plugins/types'
import { UrlProcessor } from './url-processor'
import { ContextBuilder } from './context-builder'
import { RequestBodyHandler } from './request-body-handler'
import { ResponseBodyHandler } from './response-body-handler'
import { UpstreamHandler } from './upstream-handler'

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

        try {
            // Parse URL
            const fullUrl = UrlProcessor.buildFullUrl(clientReq, isHttps)

            // Check if host should be ignored - if so, create direct tunnel
            if (isHostIgnored(fullUrl.hostname, this.ignoredHosts)) {
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
                requestBodyToSend
            )
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes('Host header')
            ) {
                clientRes.writeHead(400, 'Bad Request: Missing Host header')
                clientRes.end()
                return
            }
            this.onError(error, { id })
            if (!clientRes.headersSent) {
                clientRes.writeHead(500, 'Internal Server Error')
                clientRes.end('Internal server error')
            }
        }
    }

    private async handleUpstreamRequest(
        fullUrl: URL,
        reqCtx: RequestContext,
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        requestBodyToSend?: Buffer
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
        const port = fullUrl.port || (fullUrl.protocol === 'https:' ? 443 : 80)
        const options = {
            hostname: fullUrl.hostname,
            port: port,
            method: clientReq.method,
            path: fullUrl.pathname + fullUrl.search,
            headers: clientReq.headers
        }

        const req = http.request(options, (res) => {
            clientRes.writeHead(res.statusCode || 200, res.statusMessage, res.headers)
            res.pipe(clientRes, { end: true })
        })

        req.on('error', (_err) => {
            if (!clientRes.headersSent) {
                clientRes.writeHead(502, 'Bad Gateway')
                clientRes.end('Error connecting to upstream server')
            }
        })

        clientReq.pipe(req, { end: true })
    }
}
