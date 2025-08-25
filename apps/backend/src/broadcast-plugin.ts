import type {
    ProxyPlugin,
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
} from '@arachne/proxy'
import { randomBytes } from 'node:crypto'
import { WsHub } from './ws-hub'
import { broadcastLogger } from './logger'
import type {
    RequestBodyEvent,
    RequestEvent,
    ResponseBodyEvent,
    ResponseHeadEvent,
    TransactionCompleteEvent,
    DisplayHeader,
    ContentInfo,
    RequestURL,
} from '@arachne/api-types'
// import { ReverseLookupDependencyDetector } from './dependency-analyzer'

const DEFAULT_MAX = 1024 * 1024 * 1024 // 1GB sample cap

// Sensitive headers that should be marked for special handling in UI
const SENSITIVE_HEADERS = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'proxy-authorization',
    'www-authenticate',
    'x-api-key',
    'x-auth-token',
])

function detectContentFormat(
    contentType?: string,
    sample?: string
): ContentInfo['detectedFormat'] {
    if (!contentType && !sample) return 'binary'

    const ct = (contentType || '').toLowerCase()

    // Check content-type first
    if (ct.includes('application/json') || ct.endsWith('+json')) return 'json'
    if (
        ct.includes('application/xml') ||
        ct.endsWith('+xml') ||
        ct.includes('text/xml')
    )
        return 'xml'
    if (ct.includes('text/html')) return 'html'
    if (ct.includes('text/css')) return 'css'
    if (ct.includes('application/javascript') || ct.includes('text/javascript'))
        return 'javascript'
    if (
        ct.includes('application/x-www-form-urlencoded') ||
        ct.includes('multipart/form-data')
    )
        return 'form'
    if (ct.startsWith('text/')) return 'text'
    if (ct.startsWith('image/')) return 'image'

    // Fallback to sample-based detection for UTF8 content
    if (sample && typeof sample === 'string' && !sample.startsWith('base64:')) {
        const trimmed = sample.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
        if (trimmed.startsWith('<'))
            return trimmed.includes('<!DOCTYPE') ? 'html' : 'xml'
        return 'text'
    }

    return 'binary'
}

function parseHeaders(
    headers: Record<string, string | string[]>
): DisplayHeader[] {
    return Object.entries(headers).map(([name, value]) => ({
        name,
        value: Array.isArray(value) ? value.join(', ') : value,
        sensitive: SENSITIVE_HEADERS.has(name.toLowerCase()),
    }))
}

function parseURL(url: URL): RequestURL {
    return {
        full: url.toString(),
        protocol: url.protocol,
        host: url.hostname,
        port: url.port ? parseInt(url.port) : undefined,
        path: url.pathname,
        query: url.search ? url.search.substring(1) : undefined,
        fragment: url.hash ? url.hash.substring(1) : undefined,
    }
}

function bodyToContentInfo(
    buf: Buffer,
    contentType?: string,
    contentEncoding?: string,
    max = DEFAULT_MAX
): { content: ContentInfo; sample: string } {
    const ct = (contentType || '').toLowerCase()
    const truncated = buf.length > max
    const slice = truncated ? buf.subarray(0, max) : buf

    let sample: string
    let encoding: 'utf8' | 'base64' = 'base64'

    // Try UTF8 for text-like content
    if (
        ct.includes('application/json') ||
        ct.startsWith('text/') ||
        ct.endsWith('+json') ||
        ct.includes('application/xml') ||
        ct.includes('application/x-www-form-urlencoded') ||
        ct.includes('application/javascript')
    ) {
        try {
            sample = slice.toString('utf8')
            encoding = 'utf8'
        } catch {
            sample = 'base64:' + slice.toString('base64')
            encoding = 'base64'
        }
    } else {
        sample = 'base64:' + slice.toString('base64')
        encoding = 'base64'
    }

    const content: ContentInfo = {
        contentType,
        contentEncoding,
        size: buf.length,
        sampleSize: slice.length,
        truncated,
        detectedFormat: detectContentFormat(
            contentType,
            encoding === 'utf8' ? sample : undefined
        ),
        encoding,
        isCompressed: !!(
            contentEncoding &&
            ['gzip', 'deflate', 'br', 'compress'].includes(
                contentEncoding.toLowerCase()
            )
        ),
    }

    return { content, sample }
}

function nowIso() {
    return new Date().toISOString()
}

function genId(prefix: string) {
    // Use crypto.randomBytes for secure, collision-resistant ID generation
    return `${prefix}_${randomBytes(6).toString('hex')}`
}

export interface BroadcastPluginOptions {
    hub: WsHub
    maxSampleBytes?: number
}

// Track transaction state for timing and completion events
interface TransactionState {
    requestStartTime: number
    responseStartTime?: number
    // Request data
    method: string
    url: RequestURL
    headers: DisplayHeader[]
    rawHeaders: Record<string, string | string[]>
    clientIp?: string
    requestBody?: {
        content: ContentInfo
        sample: string
    }
    // Response data
    statusCode?: number
    statusMessage?: string
    responseHeaders?: DisplayHeader[]
    rawResponseHeaders?: Record<string, string | string[]>
    responseBody?: {
        content: ContentInfo
        sample: string
    }
    // Summary stats
    requestSize?: number
    responseSize?: number
    hasRequestBody: boolean
    hasResponseBody: boolean
}

export function createBroadcastPlugin(
    opts: BroadcastPluginOptions
): ProxyPlugin {
    const hub = opts.hub
    const maxSampleBytes =
        typeof opts.maxSampleBytes === 'number'
            ? opts.maxSampleBytes
            : DEFAULT_MAX

    // Initialize dependency detector
    // const dependencyDetector = new ReverseLookupDependencyDetector()


    // Track ongoing transactions for completion events
    const transactions = new Map<string, TransactionState>()

    // Helper function to handle transaction completion
    function completeTransaction(id: string) {
        const transaction = transactions.get(id)
        if (!transaction) return
        if (transaction.method === "OPTIONS") return

        // Build complete transaction data
        const transactionData = {
            request: {
                method: transaction.method,
                url: transaction.url,
                headers: transaction.headers,
                rawHeaders: transaction.rawHeaders,
                clientIp: transaction.clientIp,
                body: transaction.requestBody,
            },
            response: transaction.statusCode
                ? {
                      statusCode: transaction.statusCode,
                      statusMessage: transaction.statusMessage,
                      headers: transaction.responseHeaders || [],
                      rawHeaders: transaction.rawResponseHeaders || {},
                      body: transaction.responseBody,
                  }
                : undefined,
            timing: {
                startTime: transaction.requestStartTime,
                responseTime: transaction.responseStartTime,
                duration: transaction.responseStartTime
                    ? transaction.responseStartTime -
                      transaction.requestStartTime
                    : undefined,
            },
            summary: {
                requestSize: transaction.requestSize,
                responseSize: transaction.responseSize,
                hasRequestBody: transaction.hasRequestBody,
                hasResponseBody: transaction.hasResponseBody,
            },
        }

        // STEP 1: Analyze current request for dependencies (look backwards)
        // const dependencies = dependencyDetector.analyzeRequest(transactionData, id)

        // STEP 2: Index current response for future lookups
        // dependencyDetector.indexResponse(transactionData, id)

        const ev: TransactionCompleteEvent = {
            type: 'transactionComplete',
            id,
            ts: nowIso(),
            transaction: transactionData,
            dependencies: []
        }

        // Log the broadcast event
        broadcastLogger.info('Broadcasting transaction complete event', {
            eventType: 'transactionComplete',
            id,
            method: transaction.method,
            url: transaction.url.full,
            statusCode: transaction.statusCode,
            duration: ev.transaction.timing.duration,
            requestSize: transaction.requestSize,
            responseSize: transaction.responseSize,
            hasRequestBody: transaction.hasRequestBody,
            hasResponseBody: transaction.hasResponseBody,
            dependenciesCount: 0 //dependencies.length
        })
        
        hub.broadcast(ev)

        // Clean up transaction state
        transactions.delete(id)
    }

    const plugin: ProxyPlugin = {
        name: 'ws-broadcast',

        async onRequest(ctx: RequestContext) {
            const timestamp = Date.now()
            const startTime = timestamp
            const parsedURL = parseURL(ctx.url)
            const parsedHeaders = parseHeaders(ctx.headers)

            // Initialize transaction tracking with complete request data
            transactions.set(ctx.id, {
                requestStartTime: startTime,
                method: ctx.method,
                url: parsedURL,
                headers: parsedHeaders,
                rawHeaders: ctx.headers,
                clientIp: ctx.clientIp,
                hasRequestBody: false,
                hasResponseBody: false,
            })

            const ev: RequestEvent = {
                type: 'request',
                id: ctx.id,
                ts: nowIso(),
                timestamp,
                method: ctx.method,
                url: parsedURL,
                headers: parsedHeaders,
                rawHeaders: ctx.headers,
                clientIp: ctx.clientIp,
            }
            
            // Log the broadcast event
            broadcastLogger.info('Broadcasting request event', {
                eventType: 'request',
                id: ctx.id,
                method: ctx.method,
                url: parsedURL.full,
                clientIp: ctx.clientIp,
                timestamp
            })
            
            hub.broadcast(ev)
        },

        async onResponse(ctx: ResponseContext) {
            const timestamp = Date.now()
            const transaction = transactions.get(ctx.id)
            const parsedHeaders = parseHeaders(ctx.responseHeaders)

            if (transaction) {
                transaction.responseStartTime = timestamp
                transaction.statusCode = ctx.statusCode
                transaction.statusMessage = ctx.statusMessage
                transaction.responseHeaders = parsedHeaders
                transaction.rawResponseHeaders = ctx.responseHeaders
            }

            const ev: ResponseHeadEvent = {
                type: 'responseHead',
                id: ctx.id,
                ts: nowIso(),
                statusCode: ctx.statusCode,
                statusMessage: ctx.statusMessage,
                headers: parsedHeaders,
                rawHeaders: ctx.responseHeaders,
                timing: transaction
                    ? {
                          startTime: transaction.requestStartTime,
                          responseTime: timestamp,
                          duration: timestamp - transaction.requestStartTime,
                      }
                    : undefined,
            }
            
            // Log the broadcast event
            broadcastLogger.info('Broadcasting response head event', {
                eventType: 'responseHead',
                id: ctx.id,
                statusCode: ctx.statusCode,
                statusMessage: ctx.statusMessage,
                duration: transaction ? timestamp - transaction.requestStartTime : undefined,
                timestamp
            })
            
            hub.broadcast(ev)
        },

        async onRequestBody(ctx: RequestBodyContext) {
            const { content, sample } = bodyToContentInfo(
                ctx.body,
                ctx.contentType,
                ctx.contentEncoding,
                maxSampleBytes
            )

            const transaction = transactions.get(ctx.id)
            if (transaction) {
                transaction.hasRequestBody = true
                transaction.requestSize = ctx.body.length
                transaction.requestBody = { content, sample }
            }

            const ev: RequestBodyEvent = {
                type: 'requestBody',
                id: ctx.id,
                ts: nowIso(),
                content,
                sample,
            }
            
            // Log the broadcast event
            broadcastLogger.info('Broadcasting request body event', {
                eventType: 'requestBody',
                id: ctx.id,
                contentType: content.contentType,
                size: content.size,
                detectedFormat: content.detectedFormat,
                truncated: content.truncated
            })
            
            hub.broadcast(ev)
        },

        async onResponseBody(ctx: ResponseBodyContext) {
            const { content, sample } = bodyToContentInfo(
                ctx.body,
                ctx.contentType,
                ctx.contentEncoding,
                maxSampleBytes
            )

            const transaction = transactions.get(ctx.id)
            if (transaction) {
                transaction.hasResponseBody = true
                transaction.responseSize = ctx.body.length
                transaction.responseBody = { content, sample }
            }

            const ev: ResponseBodyEvent = {
                type: 'responseBody',
                id: ctx.id,
                ts: nowIso(),
                content,
                sample,
            }
            
            // Log the broadcast event
            broadcastLogger.info('Broadcasting response body event', {
                eventType: 'responseBody',
                id: ctx.id,
                contentType: content.contentType,
                size: content.size,
                detectedFormat: content.detectedFormat,
                truncated: content.truncated
            })
            
            hub.broadcast(ev)
        },

        async onResponseComplete(ctx: ResponseContext) {
            // Response is fully processed - send transaction complete event
            completeTransaction(ctx.id)
        },

        onError(err: unknown, ctx: Partial<RequestContext>) {
            try {
                const ev = {
                    type: 'error' as const,
                    id: ctx?.id || genId('err'),
                    ts: nowIso(),
                    message:
                        (err instanceof Error ? err.message : String(err)) ||
                        'Unknown error',
                    stack: err instanceof Error ? err.stack : undefined,
                    phase: 'connection' as const, // Could be enhanced based on context
                }
                
                // Log the broadcast event
                broadcastLogger.error('Broadcasting error event', {
                    eventType: 'error',
                    id: ev.id,
                    message: ev.message,
                    phase: ev.phase,
                    contextId: ctx?.id
                })
                
                hub.broadcast(ev)

                // Complete transaction if we have an ID
                if (ctx?.id) {
                    completeTransaction(ctx.id)
                }
            } catch {}
        },
    }

    return plugin
}
