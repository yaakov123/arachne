import type { RequestBuilder, ResponseBuilder } from './builders'

export type HookResult = void | Promise<void>

/**
 * Context for beforeRequest hook - allows modification of the outgoing request
 */
export interface BeforeRequestContext {
    /** Unique request ID */
    id: string
    /** Parent correlation ID for linking flows (e.g., conn_abc123 for req_def456) */
    parentId?: string
    /** Whether this is an HTTPS request */
    isHttps: boolean
    /** Original request URL */
    url: URL
    /** HTTP method */
    method: string
    /** Request headers */
    headers: Record<string, string | string[]>
    /** Client IP address */
    clientIp?: string
    /** Request body (if present and buffered) */
    body?: Buffer

    /** Builder for modifying the request */
    request: RequestBuilder
}

/**
 * Context for afterRequest hook - contains finalized request data
 */
export interface AfterRequestContext {
    /** Unique request ID */
    id: string
    /** Parent correlation ID for linking flows */
    parentId?: string
    /** Whether this is an HTTPS request */
    isHttps: boolean
    /** Original request URL */
    url: URL
    /** Original HTTP method */
    method: string
    /** Original request headers */
    headers: Record<string, string | string[]>
    /** Client IP address */
    clientIp?: string
    /** Original request body */
    body?: Buffer

    /** Final request URL (after all modifications) */
    finalUrl: URL
    /** Final HTTP method (after all modifications) */
    finalMethod: string
    /** Final request headers (after all modifications) */
    finalHeaders: Record<string, string | string[]>
    /** Final request body (after all modifications) */
    finalBody?: Buffer
}

/**
 * Context for beforeResponse hook - allows modification of the response
 */
export interface BeforeResponseContext extends AfterRequestContext {
    /** Response status code from upstream */
    statusCode: number
    /** Response status message from upstream */
    statusMessage?: string
    /** Response headers from upstream */
    responseHeaders: Record<string, string | string[]>
    /** Response body from upstream (always buffered when response hooks are present) */
    responseBody?: Buffer

    /** Builder for modifying the response */
    response: ResponseBuilder
}

/**
 * Context for afterResponse hook - contains all finalized data and timing
 */
export interface AfterResponseContext
    extends Omit<BeforeResponseContext, 'response'> {
    /** Final response status code (after all modifications) */
    finalStatusCode: number
    /** Final response status message (after all modifications) */
    finalStatusMessage?: string
    /** Final response headers (after all modifications) */
    finalResponseHeaders: Record<string, string | string[]>
    /** Final response body (after all modifications) */
    finalResponseBody?: Buffer

    /** Total request duration in milliseconds */
    duration: number
}

/**
 * Context for CONNECT requests (HTTPS tunneling)
 */
export interface ConnectContext {
    /** Unique connection ID */
    id: string
    /** Parent correlation ID for linking flows */
    parentId?: string
    /** Target hostname */
    hostname: string
    /** Target port */
    port: number
    /** Client IP address */
    clientIp?: string
}

/**
 * Error context for error handlers
 */
export type ErrorContext =
    | Partial<BeforeRequestContext>
    | Partial<AfterRequestContext>
    | Partial<BeforeResponseContext>
    | Partial<AfterResponseContext>
    | Partial<ConnectContext>
    | {
          id?: string
          hostname?: string
          socketInfo?: import('../core/utils/sockets').SocketInfo
      }
    | { [key: string]: any } // fallback for unknown context shapes

/**
 * New simplified proxy plugin interface
 */
export interface ProxyPlugin {
    /** Plugin name for identification */
    readonly name: string

    /**
     * Called before the request is sent to upstream
     * Allows modification of request headers, body, URL, and method
     */
    beforeRequest?(ctx: BeforeRequestContext): HookResult

    /**
     * Called after the request has been finalized but before sending to upstream
     * Provides access to final request data (read-only)
     */
    afterRequest?(ctx: AfterRequestContext): HookResult

    /**
     * Called after receiving response from upstream, before sending to client
     * Allows modification of response headers, body, and status
     */
    beforeResponse?(ctx: BeforeResponseContext): HookResult

    /**
     * Called after the response has been finalized and sent to client
     * Provides access to complete transaction data including timing
     */
    afterResponse?(ctx: AfterResponseContext): HookResult

    /**
     * Called for HTTPS CONNECT requests (tunneling)
     */
    onConnect?(ctx: ConnectContext): HookResult

    /**
     * Called when an error occurs during request processing
     */
    onError?(err: unknown, ctx: ErrorContext): void
}

/**
 * Type-safe hook context mapping for better type checking
 */
export type HookContextMap = {
    beforeRequest: BeforeRequestContext
    afterRequest: AfterRequestContext
    beforeResponse: BeforeResponseContext
    afterResponse: AfterResponseContext
    onConnect: ConnectContext
}

/**
 * Utility type to extract hook names that are implemented by a plugin
 */
export type ImplementedHooks<T extends ProxyPlugin> = {
    [K in keyof HookContextMap]: T[K] extends (...args: any[]) => any
        ? K
        : never
}[keyof HookContextMap]

/**
 * Type-safe hook execution helper type
 */
export type HookExecutor<K extends keyof HookContextMap> = (
    ctx: HookContextMap[K]
) => HookResult
