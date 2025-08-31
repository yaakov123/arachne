import type { ProxyPlugin } from '@arachne/proxy'
import type {
    DisplayHeader,
    ContentInfo,
    RequestURL,
    TransactionData,
} from '@arachne/api-types'
import { BroadcastEmitter } from '../services/broadcast-emitter'

const DEFAULT_MAX = 1024 * 1024 * 1024 // 1GB sample cap

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

function getContentType(headers: Record<string, string | string[]>) {
    return headers['content-type'] as string | undefined
}

function getContentEncoding(headers: Record<string, string | string[]>) {
    return headers['content-encoding'] as string | undefined
}

export function createTransactionAggregatorPlugin(
    eventEmitter: BroadcastEmitter
): ProxyPlugin {
    return {
        name: 'transaction-aggregator',

        afterResponse(ctx) {
            // Build complete transaction data
            const transactionData: TransactionData = {
                request: {
                    method: ctx.method,
                    url: parseURL(ctx.finalUrl),
                    headers: parseHeaders(ctx.finalHeaders),
                    rawHeaders: ctx.finalHeaders,
                    clientIp: ctx.clientIp,
                    body: ctx.finalBody
                        ? bodyToContentInfo(
                              ctx.finalBody,
                              getContentType(ctx.finalHeaders),
                              getContentEncoding(ctx.finalHeaders)
                          )
                        : undefined,
                },

                response: {
                    statusCode: ctx.finalStatusCode,
                    statusMessage: ctx.finalStatusMessage,
                    headers: parseHeaders(ctx.finalResponseHeaders),
                    rawHeaders: ctx.finalResponseHeaders,
                    body: ctx.finalResponseBody
                        ? bodyToContentInfo(
                              ctx.finalResponseBody,
                              getContentType(ctx.finalResponseHeaders),
                              getContentEncoding(ctx.finalResponseHeaders)
                          )
                        : undefined,
                },

                timing: {
                    duration: ctx.duration,
                },
                summary: {
                    hasRequestBody: !!ctx.finalBody,
                    hasResponseBody: !!ctx.finalResponseBody,
                    requestSize: ctx.finalBody
                        ? ctx.finalBody.length
                        : undefined,
                    responseSize: ctx.finalResponseBody
                        ? ctx.finalResponseBody.length
                        : undefined,
                },
            }

            // Emit transaction complete event
            eventEmitter.emit('transactionComplete', {
                type: 'transactionComplete',
                id: ctx.id,
                ts: nowIso(),
                transaction: transactionData,
            })
        },
    }
}
