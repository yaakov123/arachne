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
  onError?(err: unknown, ctx: Partial<RequestContext & ConnectContext>): void
}
