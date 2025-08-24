import http, { IncomingMessage, RequestOptions } from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import type { RequestContext } from '../plugins/types'
import { logger } from '../logger'

export class UpstreamHandler {
    constructor(private onError: (err: unknown, ctx: any) => void) {}

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
                // Stream request body
                clientReq.pipe(upstreamReq)
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
            writable: clientRes.writable
        }
        
        logger.error('Handling upstream error response', err, {
            requestId: ctx.id,
            component: 'upstream-handler',
            url: ctx.url.toString(),
            method: ctx.method,
            hostname: ctx.url.hostname,
            responseInfo,
            errorCode: (err as any)?.code,
            errorErrno: (err as any)?.errno
        })
        
        this.onError(err, ctx)
        
        try {
            if (!clientRes.headersSent && clientRes.writable) {
                logger.debug('Sending 502 Bad Gateway response for upstream error', {
                    requestId: ctx.id,
                    component: 'upstream-handler',
                    url: ctx.url.toString()
                })
                clientRes.writeHead(502, 'Bad Gateway')
                clientRes.end('Upstream error')
            } else {
                logger.debug('Cannot send 502 response for upstream error - headers already sent or not writable', {
                    requestId: ctx.id,
                    component: 'upstream-handler',
                    url: ctx.url.toString(),
                    responseInfo
                })
                
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
                responseInfo
            })
        }
    }

    streamResponse(
        upstreamResponse: IncomingMessage,
        clientRes: http.ServerResponse,
        statusCode: number,
        statusMessage: string | undefined,
        headers: Record<string, any>
    ): void {
        clientRes.writeHead(statusCode, statusMessage, headers)
        upstreamResponse.pipe(clientRes)
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
