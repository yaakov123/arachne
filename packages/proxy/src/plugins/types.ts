export type HookResult = void | Promise<void>

export interface RequestContext {
    id: string
    isHttps: boolean
    url: URL
    method: string
    headers: Record<string, string | string[]>
    clientIp?: string
    // Mutable request options forwarded upstream
    requestOptions: {
        protocol: 'http:' | 'https:'
        hostname: string
        port: number
        path: string
        method: string
        headers: Record<string, string | string[]>
    }
}

export interface ResponseContext extends RequestContext {
    // Upstream response metadata (available in onResponse)
    statusCode: number
    statusMessage?: string
    responseHeaders: Record<string, string | string[]>
}

// Body rewrite contexts
export interface RequestBodyContext extends RequestContext {
    // Uncompressed body (decoded if content-encoding is supported)
    body: Buffer
    contentType?: string
    contentEncoding?: string
    // Replace the outgoing request body. If string is provided, it's encoded as UTF-8.
    setBody(body: Buffer | string): void
}

export interface ResponseBodyContext extends ResponseContext {
    // Uncompressed body (decoded if content-encoding is supported)
    body: Buffer
    contentType?: string
    contentEncoding?: string
    // Replace the downstream response body. If string is provided, it's encoded as UTF-8.
    setBody(body: Buffer | string): void
}

export interface ConnectContext {
    id: string
    hostname: string
    port: number
    clientIp?: string
}

export interface ProxyPlugin {
    name: string
    onConnect?(ctx: ConnectContext): HookResult
    onRequest?(ctx: RequestContext): HookResult
    onResponse?(ctx: ResponseContext): HookResult
    // Called with buffered/decoded bodies if available and within size limits
    onRequestBody?(ctx: RequestBodyContext): HookResult
    onResponseBody?(ctx: ResponseBodyContext): HookResult
    onError?(err: unknown, ctx: Partial<RequestContext & ConnectContext>): void
}
