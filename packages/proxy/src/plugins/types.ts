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

export interface WebSocketUpgradeContext {
    id: string
    isHttps: boolean
    url: URL
    method: string
    headers: Record<string, string | string[]>
    clientIp?: string
    // WebSocket specific properties
    protocols?: string[]
    extensions?: string[]
}

export interface WebSocketMessageContext extends WebSocketUpgradeContext {
    connectionId: string
    direction: 'client-to-server' | 'server-to-client'
    messageType: 'text' | 'binary' | 'ping' | 'pong' | 'close'
    payload: Buffer
    // For text messages, decoded content
    textContent?: string
    timestamp: number
}

export interface WebSocketCloseContext extends WebSocketUpgradeContext {
    connectionId: string
    code?: number
    reason?: string
    timestamp: number
}

export interface ProxyPlugin {
    name: string
    // HTTP/HTTPS hooks
    onConnect?(ctx: ConnectContext): HookResult
    onRequest?(ctx: RequestContext): HookResult
    onResponse?(ctx: ResponseContext): HookResult
    // Called with buffered/decoded bodies if available and within size limits
    onRequestBody?(ctx: RequestBodyContext): HookResult
    onResponseBody?(ctx: ResponseBodyContext): HookResult
    // Called exactly once when the response is complete (after onResponseBody if body exists, or immediately if no body)
    onResponseComplete?(ctx: ResponseContext): HookResult

    // WebSocket hooks
    onWebSocketUpgrade?(ctx: WebSocketUpgradeContext): HookResult
    onWebSocketMessage?(ctx: WebSocketMessageContext): HookResult
    onWebSocketClose?(ctx: WebSocketCloseContext): HookResult

    onError?(err: unknown, ctx: Partial<RequestContext & ConnectContext & WebSocketUpgradeContext>): void
}
