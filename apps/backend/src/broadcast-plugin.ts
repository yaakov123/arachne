import type {
    ProxyPlugin,
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
} from '@arachne/proxy'
import { WsHub } from './ws-hub'
import type {
    RequestBodyEvent,
    RequestEvent,
    ResponseBodyEvent,
    ResponseHeadEvent,
} from '@arachne/api-types'

const DEFAULT_MAX = 1024 * 1024 // 1MB sample cap, aligns with recorder default

function bodyToSampleString(
    buf: Buffer,
    contentType?: string,
    max = DEFAULT_MAX
): { sample: string; truncated: boolean; encoding: 'utf8' | 'base64' } {
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
            return {
                sample: slice.toString('utf8'),
                truncated,
                encoding: 'utf8',
            }
        } catch {
            /* fallthrough */
        }
    }
    return {
        sample: 'base64:' + slice.toString('base64'),
        truncated,
        encoding: 'base64',
    }
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

export function createBroadcastPlugin(
    opts: BroadcastPluginOptions
): ProxyPlugin {
    const hub = opts.hub
    const maxSampleBytes =
        typeof opts.maxSampleBytes === 'number'
            ? opts.maxSampleBytes
            : DEFAULT_MAX

    const plugin: ProxyPlugin = {
        name: 'ws-broadcast',

        async onRequest(ctx: RequestContext) {
            const ev: RequestEvent = {
                type: 'request',
                id: ctx.id,
                ts: nowIso(),
                method: ctx.method,
                url: ctx.url.toString(),
                headers: ctx.headers,
                clientIp: ctx.clientIp,
                isHttps: ctx.isHttps,
            }
            hub.broadcast(ev)
        },

        async onResponse(ctx: ResponseContext) {
            const ev: ResponseHeadEvent = {
                type: 'responseHead',
                id: ctx.id,
                ts: nowIso(),
                statusCode: ctx.statusCode,
                statusMessage: ctx.statusMessage,
                headers: ctx.responseHeaders,
            }
            hub.broadcast(ev)
        },

        async onRequestBody(ctx: RequestBodyContext) {
            const { sample, truncated } = bodyToSampleString(
                ctx.body,
                ctx.contentType,
                maxSampleBytes
            )
            const ev: RequestBodyEvent = {
                type: 'requestBody',
                id: ctx.id,
                ts: nowIso(),
                contentType: ctx.contentType,
                sample,
                truncated,
                request: {
                    type: 'request',
                    id: ctx.id,
                    ts: nowIso(),
                    method: ctx.method,
                    url: ctx.url.toString(),
                    headers: ctx.headers,
                    clientIp: ctx.clientIp,
                    isHttps: ctx.isHttps,
                },
            }
            hub.broadcast(ev)
        },

        async onResponseBody(ctx: ResponseBodyContext) {
            const { sample, truncated } = bodyToSampleString(
                ctx.body,
                ctx.contentType,
                maxSampleBytes
            )
            const ev: ResponseBodyEvent = {
                type: 'responseBody',
                id: ctx.id,
                ts: nowIso(),
                contentType: ctx.contentType,
                sample,
                truncated,
                response: {
                    type: 'responseHead',
                    id: ctx.id,
                    ts: nowIso(),
                    statusCode: ctx.statusCode,
                    statusMessage: ctx.statusMessage,
                    headers: ctx.responseHeaders,
                },
            }
            hub.broadcast(ev)
        },

        onError(err: unknown, ctx: Partial<RequestContext>) {
            try {
                hub.broadcast({
                    type: 'error',
                    id: ctx?.id || genId('err'),
                    ts: nowIso(),
                    message:
                        (err instanceof Error ? err.message : String(err)) ||
                        'Unknown error',
                } as any)
            } catch {}
        },
    }

    return plugin
}
