import http, { IncomingMessage, RequestOptions } from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import type { RequestContext } from '../plugins/types'

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
        this.onError(err, ctx)
        if (!clientRes.headersSent) {
            clientRes.writeHead(502, 'Bad Gateway')
        }
        clientRes.end('Upstream error')
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
