import { IncomingMessage, RequestOptions } from 'node:http'
import { URL } from 'node:url'
import type { RequestContext, ResponseContext } from '../plugins/types'
import { sanitizeHeaders } from './utils'
import { getRemote } from './proxy-utils'
import { DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT } from './constants'

export class ContextBuilder {
    static buildRequestContext(
        url: URL,
        req: IncomingMessage,
        isHttps: boolean,
        id: string,
        parentId?: string
    ): RequestContext {
        const sanitizedHeaders = sanitizeHeaders(req.headers)
        const requestOptions: RequestOptions = {
            protocol: url.protocol,
            hostname: url.hostname,
            port: Number(url.port) || (url.protocol === 'https:' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT),
            method: req.method,
            path: `${url.pathname}${url.search}`,
            headers: sanitizedHeaders,
        }

        return {
            id,
            parentId,
            isHttps,
            url,
            method: req.method || 'GET',
            headers: sanitizedHeaders,
            clientIp: getRemote(req.socket),
            requestOptions: requestOptions as any,
        }
    }

    static buildResponseContext(
        reqCtx: RequestContext,
        response: IncomingMessage
    ): ResponseContext {
        return {
            ...reqCtx,
            statusCode: response.statusCode || 0,
            statusMessage: response.statusMessage,
            responseHeaders: { ...(response.headers as any) },
        }
    }

    static createRequestOptions(
        url: URL,
        method: string,
        headers: Record<string, any>
    ): RequestOptions {
        return {
            protocol: url.protocol,
            hostname: url.hostname,
            port: Number(url.port) || (url.protocol === 'https:' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT),
            method,
            path: `${url.pathname}${url.search}`,
            headers,
        }
    }
}
