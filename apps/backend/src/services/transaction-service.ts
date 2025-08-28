import {
    Transaction,
    TransactionCreateInput,
    TransactionRepository,
    HostRepository,
} from '@arachne/database'
import { TransactionCompleteEvent } from '@arachne/api-types'

export class TransactionService {
    constructor(
        private readonly transactionRepository: TransactionRepository = new TransactionRepository(),
        private readonly hostRepository: HostRepository = new HostRepository()
    ) {}

    async addTransaction(projectId: string, event: TransactionCompleteEvent) {
        const input = this.toTransactionCreateInput(projectId, event)

        // Extract host and path info for analytics
        const { request } = event.transaction
        const host = request.url.host
        const method = request.method
        const path = request.url.path

        // Record transaction and update host/endpoint analytics in parallel
        await Promise.all([
            this.transactionRepository.create(input),
            this.hostRepository.recordTransactionActivity(host, method, path),
        ])
    }

    async getTransaction(id: string) {
        return this.transactionRepository.findById(id)
    }

    async getFullTransaction(id: string) {
        return this.transactionRepository.findByIdWithAllRelatedData(id)
    }

    /**
     * Get transaction count for a project
     */
    async getTransactionCount(projectId: string) {
        return this.transactionRepository.countByProject(projectId)
    }

    /**
     * Get all transactions for a project
     */
    async getTransactions(projectId: string): Promise<Transaction[]> {
        return this.transactionRepository.findByProject(projectId)
    }

    toTransactionCreateInput(
        projectId: string,
        { id, transaction, ts }: TransactionCompleteEvent
    ): TransactionCreateInput {
        const { request, response, timing, summary } = transaction

        const input: TransactionCreateInput = {
            id: id,
            timestamp: ts,

            // Project relationship
            project: {
                connect: { id: projectId },
            },

            // Request data
            method: request.method,
            clientIp: request.clientIp,

            // URL data (denormalized for performance)
            urlFull: request.url.full,
            urlProtocol: request.url.protocol,
            urlHost: request.url.host,
            urlPort: request.url.port,
            urlPath: request.url.path,
            urlQuery: request.url.query,
            urlFragment: request.url.fragment,

            // Response data
            statusCode: response?.statusCode,
            statusMessage: response?.statusMessage,

            // Timing data
            startTime: BigInt(timing.startTime),
            responseTime: timing.responseTime
                ? BigInt(timing.responseTime)
                : null,
            duration: timing.duration,

            // Summary data
            requestSize: summary.requestSize || 0,
            responseSize: summary.responseSize || 0,
            hasRequestBody: summary.hasRequestBody,
            hasResponseBody: summary.hasResponseBody,

            // Headers (create nested records)
            requestHeaders: {
                create: request.headers.map((header) => ({
                    headerType: 'request',
                    name: header.name,
                    value: header.value,
                    sensitive: header.sensitive || false,
                })),
            },

            responseHeaders: response
                ? {
                      create: response.headers.map((header) => ({
                          headerType: 'response',
                          name: header.name,
                          value: header.value,
                          sensitive: header.sensitive || false,
                      })),
                  }
                : undefined,

            // Request body
            requestBody: request.body
                ? {
                      create: {
                          bodyType: 'request',
                          contentType: request.body.content.contentType,
                          contentEncoding: request.body.content.contentEncoding,
                          size: request.body.content.size,
                          sampleSize: request.body.content.sampleSize,
                          truncated: request.body.content.truncated,
                          detectedFormat: request.body.content.detectedFormat,
                          encoding: request.body.content.encoding,
                          isCompressed:
                              request.body.content.isCompressed || false,
                          sample: request.body.sample,
                      },
                  }
                : undefined,

            // Response body
            responseBody: response?.body
                ? {
                      create: {
                          bodyType: 'response',
                          contentType: response.body.content.contentType,
                          contentEncoding:
                              response.body.content.contentEncoding,
                          size: response.body.content.size,
                          sampleSize: response.body.content.sampleSize,
                          truncated: response.body.content.truncated,
                          detectedFormat: response.body.content.detectedFormat,
                          encoding: response.body.content.encoding,
                          isCompressed:
                              response.body.content.isCompressed || false,
                          sample: response.body.sample,
                      },
                  }
                : undefined,

            // Repeater metadata
            repeaterMeta: transaction.repeater
                ? {
                      create: {
                          source: transaction.repeater.source,
                          originalTransactionId:
                              transaction.repeater.originalTransactionId,
                      },
                  }
                : undefined,
        }

        return input
    }
}
