import type {
    ProxyPlugin,
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
} from '@arachne/proxy'
import type { DisplayHeader, ContentInfo, RequestURL } from '@arachne/api-types'
import { BroadcastEmitter } from '../services/broadcast-emitter'

const DEFAULT_MAX = 1024 * 1024 * 1024 // 1GB sample cap

interface TransactionState {
    id: string
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

export function createTransactionAggregatorPlugin(
    eventEmitter: BroadcastEmitter,
    maxSampleBytes = DEFAULT_MAX
): ProxyPlugin {
    const transactions = new Map<string, TransactionState>()

    return {
        name: 'transaction-aggregator',

        async onRequest(ctx: RequestContext) {
            const timestamp = Date.now()
            const parsedURL = parseURL(ctx.url)

            const parsedHeaders = parseHeaders(ctx.headers)

            // Initialize transaction state
            transactions.set(ctx.id, {
                id: ctx.id,
                requestStartTime: timestamp,
                method: ctx.method,
                url: parsedURL,
                headers: parsedHeaders,
                rawHeaders: ctx.headers,
                clientIp: ctx.clientIp,
                hasRequestBody: false,
                hasResponseBody: false,
            })

            // Emit request event
            eventEmitter.emit('request', {
                type: 'request',
                rawHeaders: ctx.headers,
                id: ctx.id,
                method: ctx.method,
                url: parsedURL,
                headers: parsedHeaders,
                clientIp: ctx.clientIp,
                timestamp,
                ts: nowIso(),
            })
        },

        async onResponse(ctx: ResponseContext) {
            const timestamp = Date.now()
            const transaction = transactions.get(ctx.id)

            if (!transaction) return

            const parsedHeaders = parseHeaders(ctx.responseHeaders)

            // Update transaction state
            transaction.responseStartTime = timestamp
            transaction.statusCode = ctx.statusCode
            transaction.statusMessage = ctx.statusMessage
            transaction.responseHeaders = parsedHeaders
            transaction.rawResponseHeaders = ctx.responseHeaders

            // Emit response event
            eventEmitter.emit('response', {
                type: 'responseHead',
                rawHeaders: ctx.responseHeaders,
                id: ctx.id,
                statusCode: ctx.statusCode,
                statusMessage: ctx.statusMessage,
                headers: parsedHeaders,
                timing: {
                    startTime: transaction.requestStartTime,
                    responseTime: timestamp,
                    duration: timestamp - transaction.requestStartTime,
                },
                ts: nowIso(),
            })
        },

        async onRequestBody(ctx: RequestBodyContext) {
            const transaction = transactions.get(ctx.id)
            if (!transaction) return

            const { content, sample } = bodyToContentInfo(
                ctx.body,
                ctx.contentType,
                ctx.contentEncoding,
                maxSampleBytes
            )

            // Update transaction state
            transaction.hasRequestBody = true
            transaction.requestSize = ctx.body.length
            transaction.requestBody = { content, sample }

            // Emit request body event
            eventEmitter.emit('requestBody', {
                type: 'requestBody',
                id: ctx.id,
                content,
                sample,
                ts: nowIso(),
            })
        },

        async onResponseBody(ctx: ResponseBodyContext) {
            const transaction = transactions.get(ctx.id)
            if (!transaction) return

            const { content, sample } = bodyToContentInfo(
                ctx.body,
                ctx.contentType,
                ctx.contentEncoding,
                maxSampleBytes
            )

            // Update transaction state
            transaction.hasResponseBody = true
            transaction.responseSize = ctx.body.length
            transaction.responseBody = { content, sample }

            // Emit response body event
            eventEmitter.emit('responseBody', {
                type: 'responseBody',
                id: ctx.id,
                content,
                sample,
                ts: nowIso(),
            })
        },

        onResponseComplete(ctx: ResponseContext) {
            const transaction = transactions.get(ctx.id)
            if (!transaction) return
            if (transaction.method === 'OPTIONS') return

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
                    responseTime:
                        transaction.responseStartTime ||
                        transaction.requestStartTime,
                    duration:
                        transaction.responseStartTime &&
                        transaction.requestStartTime
                            ? transaction.responseStartTime -
                              transaction.requestStartTime
                            : 0,
                },
                summary: {
                    requestSize: transaction.requestSize,
                    responseSize: transaction.responseSize,
                    hasRequestBody: transaction.hasRequestBody,
                    hasResponseBody: transaction.hasResponseBody,
                },
            }

            // Emit transaction complete event
            eventEmitter.emit('transactionComplete', {
                type: 'transactionComplete',
                id: ctx.id,
                ts: nowIso(),
                transaction: transactionData,
            })

            // Clean up transaction state
            transactions.delete(ctx.id)
        },
    }
}
