import type { TransactionCompleteEvent } from '@arachne/api-types'
import type { Transaction } from '@arachne/database'

export function mapTransactionCompleteEventToTransaction(
    event: TransactionCompleteEvent
): Omit<Transaction, 'projectId' | 'hostId'> {
    return {
        id: event.id,
        timestamp: new Date(event.ts),
        clientIp: event.transaction.request.clientIp || null,
        method: event.transaction.request.method,
        urlFull: event.transaction.request.url.full,
        urlProtocol: event.transaction.request.url.protocol,
        urlHost: event.transaction.request.url.host,
        urlPort: event.transaction.request.url.port || null,
        urlPath: event.transaction.request.url.path,
        urlQuery: event.transaction.request.url.query || null,
        urlFragment: event.transaction.request.url.fragment || null,
        statusCode: event.transaction.response?.statusCode || 0,
        statusMessage: event.transaction.response?.statusMessage || '',
        duration: event.transaction.timing.duration,
        hasRequestBody: event.transaction.summary.hasRequestBody,
        hasResponseBody: event.transaction.summary.hasResponseBody,
        requestSize: event.transaction.summary.requestSize || null,
        responseSize: event.transaction.summary.responseSize || null,
        startTime: BigInt(event.transaction.timing.startTime),
        responseTime: BigInt(event.transaction.timing.responseTime),
        requestBodyId: null,
        responseBodyId: null,
    }
}
