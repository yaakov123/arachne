import type {
    ProxyPlugin,
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
    WebSocketUpgradeContext,
    WebSocketMessageContext,
    WebSocketCloseContext,
} from '@arachne/proxy'
import type { RecorderOptions, StorageAdapter } from './types.js'
import { FileStorageAdapter } from './storage/file.js'

export interface RecorderPluginResult {
    plugin: ProxyPlugin
    storage: StorageAdapter
}

const DEFAULT_MAX = 1024 * 1024 // 1MB

export function createRecorderPlugin(
    opts: RecorderOptions = {}
): RecorderPluginResult {
    const maxCaptureBytes =
        typeof opts.maxCaptureBytes === 'number'
            ? opts.maxCaptureBytes
            : DEFAULT_MAX
    const storage: StorageAdapter = opts.storage ?? new FileStorageAdapter({})

    const plugin: ProxyPlugin = {
        name: 'recorder',
        async onRequest(ctx: RequestContext) {
            storage.recordRequest(ctx)
        },
        async onResponse(ctx: ResponseContext) {
            storage.recordResponse(ctx)
        },
        async onRequestBody(ctx: RequestBodyContext) {
            const sample = bodyToSampleString(
                ctx.body,
                ctx.contentType,
                maxCaptureBytes
            )
            storage.recordRequestBody?.(ctx, sample)
        },
        async onResponseBody(ctx: ResponseBodyContext) {
            const sample = bodyToSampleString(
                ctx.body,
                ctx.contentType,
                maxCaptureBytes
            )
            storage.recordResponseBody?.(ctx, sample)
        },
        // WebSocket hooks
        async onWebSocketUpgrade(ctx: WebSocketUpgradeContext) {
            storage.recordWebSocketUpgrade?.(ctx)
        },
        async onWebSocketMessage(ctx: WebSocketMessageContext) {
            const sample = webSocketMessageToSampleString(
                ctx.payload,
                ctx.messageType,
                ctx.textContent,
                maxCaptureBytes
            )
            storage.recordWebSocketMessage?.(ctx, sample)
        },
        async onWebSocketClose(ctx: WebSocketCloseContext) {
            storage.recordWebSocketClose?.(ctx)
        },
        // Intentionally no-op; could add logging here later
        onError(_err: unknown, _ctx: unknown) {},
    }

    return { plugin, storage }
}

function bodyToSampleString(
    buf: Buffer,
    contentType?: string,
    max = DEFAULT_MAX
): string {
    const ct = (contentType || '').toLowerCase()
    const slice = buf.length > max ? buf.subarray(0, max) : buf
    if (
        ct.includes('application/json') ||
        ct.startsWith('text/') ||
        ct.endsWith('+json') ||
        ct.includes('application/xml')
    ) {
        try {
            return slice.toString('utf8')
        } catch {
            // fall through to base64
        }
    }
    return 'base64:' + slice.toString('base64')
}

function webSocketMessageToSampleString(
    payload: Buffer,
    messageType: 'text' | 'binary' | 'ping' | 'pong' | 'close',
    textContent?: string,
    max = DEFAULT_MAX
): string {
    // For ping, pong, and close frames, return a simple indicator
    if (messageType === 'ping') return '[PING]'
    if (messageType === 'pong') return '[PONG]'
    if (messageType === 'close') return '[CLOSE]'
    
    // For text messages, use the decoded text content if available
    if (messageType === 'text' && textContent !== undefined) {
        return textContent.length > max 
            ? textContent.slice(0, max) + '...[truncated]'
            : textContent
    }
    
    // For binary messages or when text decoding failed, use base64 with prefix
    const base64 = payload.toString('base64')
    if (base64.length > max) {
        // Estimate character count for truncated base64
        const truncatedBytes = Math.floor((max - 20) * 3 / 4) // Account for base64 expansion
        const truncated = payload.slice(0, truncatedBytes).toString('base64')
        return `base64:${truncated}...[truncated]`
    }
    
    return `base64:${base64}`
}
