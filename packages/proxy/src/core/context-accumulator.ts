import type { IncomingMessage } from 'node:http'
import type {
    BeforeRequestContext,
    AfterRequestContext,
    BeforeResponseContext,
    AfterResponseContext,
    ConnectContext,
} from '../plugins/types'
import { RequestBuilder, ResponseBuilder } from '../plugins/builders'

/**
 * Builds and accumulates context data across the request/response lifecycle
 */
export class ContextAccumulator {
    private startTime: number
    private baseContext: {
        id: string
        parentId?: string
        isHttps: boolean
        url: URL
        method: string
        headers: Record<string, string | string[]>
        clientIp?: string
        body?: Buffer
    }

    private finalRequestState?: {
        url: URL
        method: string
        headers: Record<string, string | string[]>
        body?: Buffer
    }

    private responseState?: {
        statusCode: number
        statusMessage?: string
        headers: Record<string, string | string[]>
        body?: Buffer
    }

    private finalResponseState?: {
        statusCode: number
        statusMessage?: string
        headers: Record<string, string | string[]>
        body?: Buffer
    }

    constructor(
        url: URL,
        clientReq: IncomingMessage,
        isHttps: boolean,
        id: string,
        parentId?: string,
        body?: Buffer
    ) {
        this.startTime = Date.now()
        this.baseContext = {
            id,
            parentId,
            isHttps,
            url: new URL(url.toString()),
            method: (clientReq.method || 'GET').toUpperCase(),
            headers: this.normalizeHeaders(clientReq.headers),
            clientIp: this.extractClientIp(clientReq),
            body: body ? Buffer.from(body) : undefined,
        }
    }

    /**
     * Build context for beforeRequest hook
     */
    buildBeforeRequestContext(): BeforeRequestContext {
        const requestBuilder = new RequestBuilder(
            this.baseContext.url,
            this.baseContext.method,
            this.baseContext.headers,
            this.baseContext.body
        )

        return {
            ...this.baseContext,
            request: requestBuilder,
        }
    }

    /**
     * Capture final request state and build afterRequest context
     */
    buildAfterRequestContext(
        requestBuilder: RequestBuilder
    ): AfterRequestContext {
        this.finalRequestState = requestBuilder._getFinalState()

        return {
            ...this.baseContext,
            finalUrl: this.finalRequestState.url,
            finalMethod: this.finalRequestState.method,
            finalHeaders: this.finalRequestState.headers,
            finalBody: this.finalRequestState.body,
        }
    }

    /**
     * Set response data and build beforeResponse context
     */
    buildBeforeResponseContext(
        statusCode: number,
        statusMessage: string | undefined,
        responseHeaders: Record<string, string | string[]>,
        responseBody?: Buffer
    ): BeforeResponseContext {
        if (!this.finalRequestState) {
            throw new Error(
                'Cannot build response context without final request state'
            )
        }

        this.responseState = {
            statusCode,
            statusMessage,
            headers: { ...responseHeaders },
            body: responseBody ? Buffer.from(responseBody) : undefined,
        }

        const responseBuilder = new ResponseBuilder(
            statusCode,
            statusMessage,
            responseHeaders,
            responseBody
        )

        return {
            ...this.baseContext,
            finalUrl: this.finalRequestState.url,
            finalMethod: this.finalRequestState.method,
            finalHeaders: this.finalRequestState.headers,
            finalBody: this.finalRequestState.body,
            statusCode: this.responseState.statusCode,
            statusMessage: this.responseState.statusMessage,
            responseHeaders: this.responseState.headers,
            responseBody: this.responseState.body,
            response: responseBuilder,
        }
    }

    /**
     * Capture final response state and build afterResponse context
     */
    buildAfterResponseContext(
        responseBuilder: ResponseBuilder
    ): AfterResponseContext {
        if (!this.finalRequestState || !this.responseState) {
            throw new Error(
                'Cannot build final response context without request and response state'
            )
        }

        this.finalResponseState = responseBuilder._getFinalState()
        const duration = Date.now() - this.startTime

        return {
            ...this.baseContext,
            finalUrl: this.finalRequestState.url,
            finalMethod: this.finalRequestState.method,
            finalHeaders: this.finalRequestState.headers,
            finalBody: this.finalRequestState.body,
            statusCode: this.responseState.statusCode,
            statusMessage: this.responseState.statusMessage,
            responseHeaders: this.responseState.headers,
            responseBody: this.responseState.body,
            finalStatusCode: this.finalResponseState.statusCode,
            finalStatusMessage: this.finalResponseState.statusMessage,
            finalResponseHeaders: this.finalResponseState.headers,
            finalResponseBody: this.finalResponseState.body,
            duration,
        }
    }

    /**
     * Get the final request state for upstream processing
     */
    getFinalRequestState() {
        if (!this.finalRequestState) {
            throw new Error('Final request state not available')
        }
        return this.finalRequestState
    }

    getAfterRequestContext(): AfterRequestContext {
        if (!this.finalRequestState) {
            throw new Error('Final request state not available')
        }
        return {
            ...this.baseContext,
            finalUrl: this.finalRequestState.url,
            finalMethod: this.finalRequestState.method,
            finalHeaders: this.finalRequestState.headers,
            finalBody: this.finalRequestState.body,
        }
    }

    /**
     * Get the final response state for client response
     */
    getFinalResponseState() {
        if (!this.finalResponseState) {
            throw new Error('Final response state not available')
        }
        return this.finalResponseState
    }

    /**
     * Build context for CONNECT requests
     */
    static buildConnectContext(
        hostname: string,
        port: number,
        id: string,
        parentId?: string,
        clientIp?: string
    ): ConnectContext {
        return {
            id,
            parentId,
            hostname,
            port,
            clientIp,
        }
    }

    private extractClientIp(req: IncomingMessage): string | undefined {
        // Try various headers for client IP
        const forwarded = req.headers['x-forwarded-for']
        if (forwarded) {
            const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded
            return ip.split(',')[0].trim()
        }

        const realIp = req.headers['x-real-ip']
        if (realIp && !Array.isArray(realIp)) {
            return realIp
        }

        // Fallback to socket remote address
        return req.socket?.remoteAddress
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
