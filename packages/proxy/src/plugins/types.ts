export type HookResult = void | Promise<void>

export interface RequestOptions {
    protocol: 'http:' | 'https:'
    hostname: string
    port: number
    path: string
    method: string
    headers: Record<string, string | string[]>
}
export interface RequestContext {
    id: string
    /** Parent correlation ID for linking flows (e.g., conn_abc123 for req_def456) */
    parentId?: string
    isHttps: boolean
    url: URL
    method: string
    headers: Record<string, string | string[]>
    clientIp?: string
    // Mutable request options forwarded upstream
    requestOptions: RequestOptions
}

export interface ResponseContext extends RequestContext {
    // Upstream response metadata (available in onResponse)
    statusCode: number
    statusMessage?: string
    responseHeaders: Record<string, string | string[]>
}

// Body rewrite contexts with better type safety
export interface RequestBodyContext extends RequestContext {
    /** Uncompressed body (decoded if content-encoding is supported) */
    body: Buffer
    /** Content type extracted from headers */
    readonly contentType?: string
    /** Original content encoding (before decoding) */
    readonly contentEncoding?: string
    /** Replace the outgoing request body. If string is provided, it's encoded as UTF-8. */
    setBody(body: Buffer | string): void
}

export interface ResponseBodyContext extends ResponseContext {
    /** Uncompressed body (decoded if content-encoding is supported) */
    body: Buffer
    /** Content type extracted from headers */
    readonly contentType?: string
    /** Original content encoding (before decoding) */
    readonly contentEncoding?: string
    /** Replace the downstream response body. If string is provided, it's encoded as UTF-8. */
    setBody(body: Buffer | string): void
}

export interface ConnectContext {
    id: string
    /** Parent correlation ID for linking flows */
    parentId?: string
    hostname: string
    port: number
    clientIp?: string
}

/** Union type for error context - used in error handlers to provide type safety */
export type ErrorContext =
    | Partial<RequestContext>
    | Partial<ConnectContext>
    | {
          id?: string
          hostname?: string
          socketInfo?: import('../proxy/utils/sockets').SocketInfo
      }
    | { [key: string]: any } // fallback for unknown context shapes

export interface ProxyPlugin {
    readonly name: string
    onConnect?(ctx: ConnectContext): HookResult
    onRequest?(ctx: RequestContext): HookResult
    onResponse?(ctx: ResponseContext): HookResult
    // Called when response starts being sent (headers written), useful for immediate notification
    onResponseStart?(ctx: ResponseContext): HookResult
    // Called with buffered/decoded bodies if available and within size limits
    onRequestBody?(ctx: RequestBodyContext): HookResult
    onResponseBody?(ctx: ResponseBodyContext): HookResult
    // Called exactly once when the response is completely finished (after streaming or buffering)
    onResponseComplete?(ctx: ResponseContext): HookResult

    onError?(err: unknown, ctx: ErrorContext): void
}

/** Type-safe hook context mapping for better type checking */
export type HookContextMap = {
    onConnect: ConnectContext
    onRequest: RequestContext
    onResponse: ResponseContext
    onResponseStart: ResponseContext
    onRequestBody: RequestBodyContext
    onResponseBody: ResponseBodyContext
    onResponseComplete: ResponseContext
}

/** Utility type to extract hook names that are implemented by a plugin */
export type ImplementedHooks<T extends ProxyPlugin> = {
    [K in keyof HookContextMap]: T[K] extends (...args: any[]) => any
        ? K
        : never
}[keyof HookContextMap]

/** Type-safe hook execution helper type */
export type HookExecutor<K extends keyof HookContextMap> = (
    ctx: HookContextMap[K]
) => HookResult
