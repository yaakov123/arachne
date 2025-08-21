import type {
  ProxyPlugin,
  RequestContext,
  ResponseContext,
  RequestBodyContext,
  ResponseBodyContext,
} from '@arachne/proxy'
import { WsHub } from './ws-hub.js'
import type {
  BackendEvent,
  InterceptRequestBodyEvent,
} from '@arachne/api-types'

const DEFAULT_MAX = 1024 * 1024 // 1MB sample cap, aligns with recorder default

function bodyToSampleString(buf: Buffer, contentType?: string, max = DEFAULT_MAX): { sample: string; truncated: boolean; encoding: 'utf8' | 'base64' } {
  const ct = (contentType || '').toLowerCase()
  const truncated = buf.length > max
  const slice = truncated ? buf.subarray(0, max) : buf
  if (
    ct.includes('application/json') ||
    ct.startsWith('text/') ||
    ct.endsWith('+json') ||
    ct.includes('application/xml')
  ) {
    try {
      return { sample: slice.toString('utf8'), truncated, encoding: 'utf8' }
    } catch {
      /* fallthrough */
    }
  }
  return { sample: 'base64:' + slice.toString('base64'), truncated, encoding: 'base64' }
}

function nowIso() {
  return new Date().toISOString()
}

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

export interface BroadcastPluginOptions {
  hub: WsHub
  maxSampleBytes?: number
}

export function createBroadcastPlugin(opts: BroadcastPluginOptions): ProxyPlugin {
  const hub = opts.hub
  const maxSampleBytes = typeof opts.maxSampleBytes === 'number' ? opts.maxSampleBytes : DEFAULT_MAX

  const plugin: ProxyPlugin = {
    name: 'ws-broadcast',

    async onRequest(ctx: RequestContext) {
      const ev: BackendEvent = {
        type: 'request',
        id: ctx.id,
        ts: nowIso(),
        method: ctx.method,
        url: ctx.url.toString(),
        headers: ctx.headers,
        clientIp: ctx.clientIp,
        isHttps: ctx.isHttps,
      } as any
      hub.broadcast(ev)
    },

    async onResponse(ctx: ResponseContext) {
      const ev: BackendEvent = {
        type: 'responseHead',
        id: ctx.id,
        ts: nowIso(),
        statusCode: ctx.statusCode,
        statusMessage: ctx.statusMessage,
        headers: ctx.responseHeaders,
      } as any
      hub.broadcast(ev)
    },

    async onRequestBody(ctx: RequestBodyContext) {
      // Always broadcast a body sample first
      const { sample, truncated } = bodyToSampleString(ctx.body, ctx.contentType, maxSampleBytes)
      const ev: BackendEvent = {
        type: 'requestBody',
        id: ctx.id,
        ts: nowIso(),
        contentType: ctx.contentType,
        sample,
        truncated,
      } as any
      hub.broadcast(ev)

      // Interactive interception: prompt interested clients and await reply
      const interceptId = genId('iv')
      const preview = bodyToSampleString(ctx.body, ctx.contentType, maxSampleBytes)
      const prompt: InterceptRequestBodyEvent = {
        type: 'intercept:requestBody',
        id: ctx.id,
        interceptId,
        ts: nowIso(),
        method: ctx.method,
        url: ctx.url.toString(),
        headers: ctx.headers,
        contentType: ctx.contentType,
        sample: preview.sample,
        sampleEncoding: preview.encoding,
        truncated: preview.truncated,
        maxBytes: maxSampleBytes,
      }

      const result = await hub.requestIntercept(prompt)
      if (result.edited && result.buffer) {
        ctx.setBody(result.buffer)
      }
    },

    async onResponseBody(ctx: ResponseBodyContext) {
      const { sample, truncated } = bodyToSampleString(ctx.body, ctx.contentType, maxSampleBytes)
      const ev: BackendEvent = {
        type: 'responseBody',
        id: ctx.id,
        ts: nowIso(),
        contentType: ctx.contentType,
        sample,
        truncated,
      } as any
      hub.broadcast(ev)
    },

    onError(err: unknown, ctx: Partial<RequestContext>) {
      try {
        hub.broadcast({
          type: 'error',
          id: ctx?.id || genId('err'),
          ts: nowIso(),
          message: (err instanceof Error ? err.message : String(err)) || 'Unknown error',
        } as any)
      } catch {}
    },
  }

  return plugin
}
