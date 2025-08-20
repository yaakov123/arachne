import type {
  ProxyPlugin,
  RequestContext,
  ResponseContext,
  RequestBodyContext,
  ResponseBodyContext,
} from '@arachne/proxy'
import type { RecorderOptions, StorageAdapter } from './types.js'
import { InMemoryStorageAdapter } from './storage/memory.js'

export interface RecorderPluginResult {
  plugin: ProxyPlugin
  storage: StorageAdapter
}

const DEFAULT_MAX = 1024 * 1024 // 1MB

export function createRecorderPlugin(opts: RecorderOptions = {}): RecorderPluginResult {
  const captureBodies = !!opts.captureBodies
  const maxCaptureBytes = typeof opts.maxCaptureBytes === 'number' ? opts.maxCaptureBytes : DEFAULT_MAX
  const storage: StorageAdapter = opts.storage ?? new InMemoryStorageAdapter({
    normalizePaths: !!opts.normalizePaths,
    maxCaptureBytes,
  })

  const plugin: ProxyPlugin = {
    name: 'recorder',
    async onRequest(ctx: RequestContext) {
      storage.recordRequest(ctx)
    },
    async onResponse(ctx: ResponseContext) {
      storage.recordResponse(ctx)
    },
    async onRequestBody(ctx: RequestBodyContext) {
      if (!captureBodies) return
      const sample = bodyToSampleString(ctx.body, ctx.contentType, maxCaptureBytes)
      storage.recordRequestBody?.(ctx, sample)
    },
    async onResponseBody(ctx: ResponseBodyContext) {
      if (!captureBodies) return
      const sample = bodyToSampleString(ctx.body, ctx.contentType, maxCaptureBytes)
      storage.recordResponseBody?.(ctx, sample)
    },
    // Intentionally no-op; could add logging here later
    onError(_err: unknown, _ctx: unknown) {},
  }

  return { plugin, storage }
}

function bodyToSampleString(buf: Buffer, contentType?: string, max = DEFAULT_MAX): string {
  const ct = (contentType || '').toLowerCase()
  const slice = buf.length > max ? buf.subarray(0, max) : buf
  if (ct.includes('application/json') || ct.startsWith('text/') || ct.endsWith('+json') || ct.includes('application/xml')) {
    try {
      return slice.toString('utf8')
    } catch {
      // fall through to base64
    }
  }
  return 'base64:' + slice.toString('base64')
}
