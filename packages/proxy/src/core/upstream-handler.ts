import http, { IncomingMessage, RequestOptions } from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import type { RequestContext, ErrorContext } from '../plugins/types'
import { logger } from '../logger'

const pipelineAsync = promisify(pipeline)

export class UpstreamHandler {
    constructor(private onError: (err: unknown, ctx: ErrorContext) => void) {}

    async sendRequest(
        fullUrl: URL,
        requestOptions: RequestOptions,
        ctx: RequestContext,
        clientReq: IncomingMessage,
        requestBodyToSend?: Buffer
    ): Promise<IncomingMessage> {
        return new Promise((resolve, reject) => {
            const upstream = fullUrl.protocol === 'https:' ? https : http
            const upstreamReq = upstream.request(requestOptions, (upRes) => {
                resolve(upRes)
            })

            upstreamReq.on('error', (err) => {
                logger.logUpstreamError(ctx.id, err, fullUrl.toString())
                this.onError(err, ctx)
                reject(err)
            })

            if (requestBodyToSend) {
                upstreamReq.end(requestBodyToSend)
            } else {
                // Stream request body using pipeline for better error handling
                pipelineAsync(clientReq, upstreamReq).catch((pipelineError) => {
                    const errorCode = (pipelineError as NodeJS.ErrnoException)
                        ?.code
                    const logContext = {
                        requestId: ctx.id,
                        component: 'upstream-handler',
                        url: fullUrl.toString(),
                        method: ctx.method,
                        errorCode,
                    }

                    // Log premature close and connection reset errors at debug level - these are normal in proxy scenarios
                    if (
                        errorCode === 'ERR_STREAM_PREMATURE_CLOSE' ||
                        errorCode === 'ECONNRESET'
                    ) {
                        logger.debug(
                            'Request body pipeline closed prematurely (normal)',
                            logContext
                        )
                    } else {
                        logger.error(
                            'Request body pipeline error',
                            pipelineError,
                            logContext
                        )
                    }
                    reject(pipelineError)
                })
            }
        })
    }

    handleUpstreamError(
        err: Error,
        ctx: RequestContext,
        clientRes: http.ServerResponse
    ): void {
        const responseInfo = {
            headersSent: clientRes.headersSent,
            finished: clientRes.finished,
            destroyed: clientRes.destroyed,
            writable: clientRes.writable,
        }

        logger.error('Handling upstream error response', err, {
            requestId: ctx.id,
            component: 'upstream-handler',
            url: ctx.url.toString(),
            method: ctx.method,
            hostname: ctx.url.hostname,
            responseInfo,
            errorCode: (err as NodeJS.ErrnoException)?.code,
            errorErrno: (err as NodeJS.ErrnoException)?.errno,
        })

        this.onError(err, ctx)

        try {
            if (!clientRes.headersSent && clientRes.writable) {
                logger.debug(
                    'Sending 502 Bad Gateway response for upstream error',
                    {
                        requestId: ctx.id,
                        component: 'upstream-handler',
                        url: ctx.url.toString(),
                    }
                )
                clientRes.writeHead(502, 'Bad Gateway')
                clientRes.end('Upstream error')
            } else {
                logger.debug(
                    'Cannot send 502 response for upstream error - headers already sent or not writable',
                    {
                        requestId: ctx.id,
                        component: 'upstream-handler',
                        url: ctx.url.toString(),
                        responseInfo,
                    }
                )

                // Try to end the response if it's still writable
                if (clientRes.writable && !clientRes.finished) {
                    clientRes.end('Upstream error')
                }
            }
        } catch (writeError) {
            logger.error('Failed to send upstream error response', writeError, {
                requestId: ctx.id,
                component: 'upstream-handler',
                url: ctx.url.toString(),
                originalError: err.message,
                responseInfo,
            })
        }
    }

    streamResponse(
        upstreamResponse: IncomingMessage,
        clientRes: http.ServerResponse,
        statusCode: number,
        statusMessage: string | undefined,
        headers: Record<string, any>,
        onComplete?: () => void
    ): void {
        clientRes.writeHead(statusCode, statusMessage, headers)

        // Set up completion tracking and use pipeline for better error handling
        if (onComplete) {
            pipelineAsync(upstreamResponse, clientRes)
                .then(() => {
                    onComplete()
                })
                .catch((pipelineError) => {
                    const errorCode = (pipelineError as NodeJS.ErrnoException)
                        ?.code
                    const logContext = {
                        component: 'upstream-handler',
                        statusCode,
                        errorCode,
                    }

                    // Log premature close errors at debug level - these are normal in proxy scenarios
                    if (errorCode === 'ERR_STREAM_PREMATURE_CLOSE') {
                        logger.debug(
                            'Response streaming pipeline closed prematurely (normal)',
                            logContext
                        )
                    } else {
                        logger.error(
                            'Response streaming pipeline error',
                            pipelineError,
                            logContext
                        )
                    }
                    onComplete()
                })
        } else {
            pipelineAsync(upstreamResponse, clientRes).catch(
                (pipelineError) => {
                    const errorCode = (pipelineError as NodeJS.ErrnoException)
                        ?.code
                    const logContext = {
                        component: 'upstream-handler',
                        statusCode,
                        errorCode,
                    }

                    // Log premature close errors at debug level - these are normal in proxy scenarios
                    if (errorCode === 'ERR_STREAM_PREMATURE_CLOSE') {
                        logger.debug(
                            'Response streaming pipeline closed prematurely (normal)',
                            logContext
                        )
                    } else {
                        logger.error(
                            'Response streaming pipeline error',
                            pipelineError,
                            logContext
                        )
                    }
                }
            )
        }
    }

    sendBufferedResponse(
        clientRes: http.ServerResponse,
        statusCode: number,
        statusMessage: string | undefined,
        headers: Record<string, any>,
        body: Buffer
    ): void {
        clientRes.writeHead(statusCode, statusMessage, headers)
        clientRes.end(body)
    }
}
