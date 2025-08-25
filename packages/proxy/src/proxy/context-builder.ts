import { IncomingMessage } from 'node:http'
import { URL } from 'node:url'
import type { RequestContext, ResponseContext, RequestOptions } from '../plugins/types'
import { sanitizeHeaders } from './utils/headers'
import { getRemote } from './utils/sockets'
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
            protocol: url.protocol as 'http:' | 'https:',
            hostname: url.hostname,
            port: Number(url.port) || (url.protocol === 'https:' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT),
            method: req.method || 'GET',
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
            requestOptions,
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
            responseHeaders: Object.fromEntries(
                Object.entries(response.headers).filter(([_, value]) => value !== undefined)
            ) as Record<string, string | string[]>,
        }
    }

    static createRequestOptions(
        url: URL,
        method: string,
        headers: Record<string, string | string[]>
    ): RequestOptions {
        return {
            protocol: url.protocol as 'http:' | 'https:',
            hostname: url.hostname,
            port: Number(url.port) || (url.protocol === 'https:' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT),
            method,
            path: `${url.pathname}${url.search}`,
            headers,
        }
    }
}
