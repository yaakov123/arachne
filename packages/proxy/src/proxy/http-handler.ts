import http, { IncomingMessage, RequestOptions } from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import type {
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
} from '../plugins/types'
import { genId, parseHostPort, sanitizeHeaders } from './utils'
import { 
    getRemote, 
    getNumericHeader, 
    headerToString, 
    readStreamToBuffer, 
    decodeBody,
    MAX_BODY_SIZE 
} from './proxy-utils'
import { PluginManager } from './plugin-manager'

export class HttpHandler {
    constructor(
        private pluginManager: PluginManager,
        private onError: (err: unknown, ctx: any) => void
    ) {}

    async handleHttpRequest(
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        isHttps: boolean,
    ): Promise<void> {
        const id = genId('req')
        const h = clientReq.headers

        // Build full URL
        let fullUrl: URL
        if (clientReq.url && /^https?:\/\//i.test(clientReq.url)) {
            fullUrl = new URL(clientReq.url)
        } else {
            const hostHeader = h['host'] as string | undefined
            if (!hostHeader) {
                try {
                    console.warn(
                        '[Arachne:Proxy] Origin-form request missing Host header',
                        { url: clientReq.url, headers: h }
                    )
                } catch {}
                clientRes.writeHead(400, 'Bad Request: Missing Host header')
                clientRes.end()
                return
            }
            const { hostname, port } = parseHostPort(hostHeader)
            const protocol = isHttps ? 'https:' : 'http:'
            const portPart = port ? `:${port}` : ''
            fullUrl = new URL(
                `${protocol}//${hostname}${portPart}${clientReq.url || '/'}`
            )
        }

        const sanitizedHeaders = sanitizeHeaders(h)
        const requestOptions: RequestOptions = {
            protocol: fullUrl.protocol,
            hostname: fullUrl.hostname,
            port:
                Number(fullUrl.port) ||
                (fullUrl.protocol === 'https:' ? 443 : 80),
            method: clientReq.method,
            path: `${fullUrl.pathname}${fullUrl.search}`,
            headers: sanitizedHeaders,
        }

        const reqCtx: RequestContext = {
            id,
            isHttps,
            url: fullUrl,
            method: clientReq.method || 'GET',
            headers: sanitizedHeaders,
            clientIp: getRemote(clientReq.socket),
            requestOptions: requestOptions as any,
        }

        await this.pluginManager.runHook('onRequest', reqCtx)

        const hasReqBodyHook = this.pluginManager.hasHook('onRequestBody')
        const hasResBodyHook = this.pluginManager.hasHook('onResponseBody')

        const method = (clientReq.method || 'GET').toUpperCase()
        const hasRequestBody = !['GET', 'HEAD'].includes(method)
        const reqContentLength = getNumericHeader(h['content-length'])
        const canBufferRequest =
            hasReqBodyHook &&
            hasRequestBody &&
            typeof reqContentLength === 'number' &&
            reqContentLength > 0 &&
            reqContentLength <= MAX_BODY_SIZE

        let requestBodyToSend: Buffer | undefined
        if (canBufferRequest) {
            try {
                const buffered = await readStreamToBuffer(
                    clientReq,
                    reqContentLength
                )
                const reqEnc = headerToString(h['content-encoding'])
                const decoded = await decodeBody(buffered, reqEnc)
                let bodyBuf = decoded
                const reqBodyCtx: RequestBodyContext = Object.assign(
                    {},
                    reqCtx,
                    {
                        body: bodyBuf,
                        contentType: headerToString(h['content-type']),
                        contentEncoding: reqEnc,
                        setBody: (b: Buffer | string) => {
                            bodyBuf = Buffer.isBuffer(b) ? b : Buffer.from(b)
                            ;(reqBodyCtx as any).body = bodyBuf
                        },
                    }
                )
                await this.pluginManager.runHook('onRequestBody', reqBodyCtx as any)
                requestBodyToSend = bodyBuf
                // Update headers for new body
                reqCtx.requestOptions.headers['content-length'] = String(
                    requestBodyToSend.length
                )
                delete (reqCtx.requestOptions.headers as any)[
                    'transfer-encoding'
                ]
                if (reqEnc)
                    delete (reqCtx.requestOptions.headers as any)[
                        'content-encoding'
                    ]
            } catch (e) {
                // Fallback to streaming if anything goes wrong while buffering
                this.onError(e, reqCtx)
            }
        }

        // Prefer uncompressed upstream responses if we plan to inspect/modify bodies
        if (hasResBodyHook) {
            reqCtx.requestOptions.headers['accept-encoding'] = 'identity'
        }

        await this.forwardToUpstream(
            requestOptions,
            fullUrl,
            reqCtx,
            clientReq,
            clientRes,
            requestBodyToSend,
            hasResBodyHook,
            method
        )
    }

    private async forwardToUpstream(
        requestOptions: RequestOptions,
        fullUrl: URL,
        reqCtx: RequestContext,
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        requestBodyToSend: Buffer | undefined,
        hasResBodyHook: boolean,
        method: string
    ): Promise<void> {
        const upstream = fullUrl.protocol === 'https:' ? https : http
        const upstreamReq = upstream.request(requestOptions, async (upRes) => {
            const resCtx: ResponseContext = {
                ...reqCtx,
                statusCode: upRes.statusCode || 0,
                statusMessage: upRes.statusMessage,
                responseHeaders: { ...(upRes.headers as any) },
            }

            await this.pluginManager.runHook('onResponse', resCtx)

            const statusCode = upRes.statusCode || 502
            const statusMessage = upRes.statusMessage

            const resContentLength = getNumericHeader(
                upRes.headers['content-length']
            )
            const resContentEncoding = headerToString(
                upRes.headers['content-encoding']
            )
            const isBodyless =
                method === 'HEAD' ||
                [101, 204, 304].includes(statusCode) ||
                resContentLength === 0

            const canBufferResponse =
                hasResBodyHook &&
                !isBodyless &&
                ((typeof resContentLength === 'number' &&
                    resContentLength >= 0 &&
                    resContentLength <= MAX_BODY_SIZE) ||
                    typeof resContentLength === 'undefined')

            if (canBufferResponse) {
                try {
                    const raw = await readStreamToBuffer(
                        upRes,
                        typeof resContentLength === 'number'
                            ? resContentLength
                            : MAX_BODY_SIZE + 1
                    )
                    const decoded = await decodeBody(raw, resContentEncoding)
                    let bodyBuf = decoded
                    const resBodyCtx: ResponseBodyContext = Object.assign(
                        {},
                        resCtx,
                        {
                            body: bodyBuf,
                            contentType: headerToString(
                                upRes.headers['content-type']
                            ),
                            contentEncoding: resContentEncoding,
                            setBody: (b: Buffer | string) => {
                                bodyBuf = Buffer.isBuffer(b)
                                    ? b
                                    : Buffer.from(b)
                                ;(resBodyCtx as any).body = bodyBuf
                            },
                        }
                    )
                    await this.pluginManager.runHook('onResponseBody', resBodyCtx as any)

                    // Prepare headers for uncompressed, rewritten body
                    const headersOut = sanitizeHeaders(
                        resCtx.responseHeaders as any
                    )
                    delete headersOut['content-encoding']
                    delete (headersOut as any)['transfer-encoding']
                    headersOut['content-length'] = String(bodyBuf.length)

                    clientRes.writeHead(statusCode, statusMessage, headersOut)
                    clientRes.end(bodyBuf)
                    return
                } catch (e) {
                    this.onError(e, resCtx)
                    // Fallback to streaming original if rewrite fails
                }
            }

            // Default: stream original response through
            const responseHeaders = sanitizeHeaders(
                resCtx.responseHeaders as any
            )
            clientRes.writeHead(statusCode, statusMessage, responseHeaders)
            upRes.pipe(clientRes)
        })

        upstreamReq.on('error', (err) => {
            this.onError(err, reqCtx)
            if (!clientRes.headersSent) clientRes.writeHead(502, 'Bad Gateway')
            clientRes.end('Upstream error')
        })

        if (requestBodyToSend) {
            upstreamReq.end(requestBodyToSend)
        } else {
            // Stream request body
            clientReq.pipe(upstreamReq)
        }
    }
}
