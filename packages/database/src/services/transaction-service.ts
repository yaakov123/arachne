import { TransactionRepository } from '../repositories/index'
import { Transaction, TransactionCreateInput } from '../types'

export class TransactionService {
    constructor(
        private readonly transactionRepository: TransactionRepository = new TransactionRepository()
    ) {}

    async addTransactionToProject(transaction: TransactionCreateInput) {
        return this.transactionRepository.create(transaction)
    }

    async getTransactions(projectId: string): Promise<Transaction[]> {
        return this.transactionRepository.findByProject(projectId)
    }

    async transactionCount(projectId: string) {
        return this.transactionRepository.countByProject(projectId)
    }

    async getTransaction(id: string) {
        return this.transactionRepository.findById(id)
    }

    // toTransaction(
    //     projectId: string,
    //     transaction: TransactionCompleteEvent
    // ): Transaction {
    //     const { transaction: txData } = transaction
    //     const { request, response, timing, summary } = txData

    //     const transactionRecord: Transaction = {
    //         id: transaction.id,
    //         type: transaction.type,
    //         timestamp: new Date(transaction.ts),
    //         projectId: projectId,

    //         // Request data
    //         method: request.method,
    //         clientIp: request.clientIp || null,

    //         // URL data (denormalized for performance)
    //         urlFull: request.url.full,
    //         urlProtocol: request.url.protocol,
    //         urlHost: request.url.host,
    //         urlPort: request.url.port || null,
    //         urlPath: request.url.path,
    //         urlQuery: request.url.query || null,
    //         urlFragment: request.url.fragment || null,

    //         // Response data
    //         statusCode: response?.statusCode || null,
    //         statusMessage: response?.statusMessage || null,

    //         // Timing data
    //         startTime: BigInt(timing.startTime),
    //         responseTime: timing.responseTime
    //             ? BigInt(timing.responseTime)
    //             : null,
    //         duration: timing.duration || null,

    //         // Summary data
    //         requestSize: summary.requestSize || 0,
    //         responseSize: summary.responseSize || 0,
    //         hasRequestBody: summary.hasRequestBody,
    //         hasResponseBody: summary.hasResponseBody,
    //     }

    //     return transactionRecord
    // }

    // toTransactionCreateInput(
    //     projectId: string,
    //     transaction: TransactionCompleteEvent
    // ): TransactionCreateInput {
    //     const { transaction: txData } = transaction
    //     const { request, response, timing, summary } = txData

    //     const input: TransactionCreateInput = {
    //         id: transaction.id,
    //         type: transaction.type,
    //         timestamp: new Date(transaction.ts),

    //         // Project relationship
    //         project: {
    //             connect: { id: projectId },
    //         },

    //         // Request data
    //         method: request.method,
    //         clientIp: request.clientIp,

    //         // URL data (denormalized for performance)
    //         urlFull: request.url.full,
    //         urlProtocol: request.url.protocol,
    //         urlHost: request.url.host,
    //         urlPort: request.url.port,
    //         urlPath: request.url.path,
    //         urlQuery: request.url.query,
    //         urlFragment: request.url.fragment,

    //         // Response data
    //         statusCode: response?.statusCode,
    //         statusMessage: response?.statusMessage,

    //         // Timing data
    //         startTime: BigInt(timing.startTime),
    //         responseTime: timing.responseTime
    //             ? BigInt(timing.responseTime)
    //             : null,
    //         duration: timing.duration,

    //         // Summary data
    //         requestSize: summary.requestSize || 0,
    //         responseSize: summary.responseSize || 0,
    //         hasRequestBody: summary.hasRequestBody,
    //         hasResponseBody: summary.hasResponseBody,

    //         // Headers (create nested records)
    //         requestHeaders: {
    //             create: request.headers.map((header) => ({
    //                 headerType: 'request',
    //                 name: header.name,
    //                 value: header.value,
    //                 sensitive: header.sensitive || false,
    //             })),
    //         },

    //         responseHeaders: response
    //             ? {
    //                   create: response.headers.map((header) => ({
    //                       headerType: 'response',
    //                       name: header.name,
    //                       value: header.value,
    //                       sensitive: header.sensitive || false,
    //                   })),
    //               }
    //             : undefined,

    //         // Request body
    //         requestBody: request.body
    //             ? {
    //                   create: {
    //                       bodyType: 'request',
    //                       contentType: request.body.content.contentType,
    //                       contentEncoding: request.body.content.contentEncoding,
    //                       size: request.body.content.size,
    //                       sampleSize: request.body.content.sampleSize,
    //                       truncated: request.body.content.truncated,
    //                       detectedFormat: request.body.content.detectedFormat,
    //                       encoding: request.body.content.encoding,
    //                       isCompressed:
    //                           request.body.content.isCompressed || false,
    //                       sample: request.body.sample,
    //                   },
    //               }
    //             : undefined,

    //         // Response body
    //         responseBody: response?.body
    //             ? {
    //                   create: {
    //                       bodyType: 'response',
    //                       contentType: response.body.content.contentType,
    //                       contentEncoding:
    //                           response.body.content.contentEncoding,
    //                       size: response.body.content.size,
    //                       sampleSize: response.body.content.sampleSize,
    //                       truncated: response.body.content.truncated,
    //                       detectedFormat: response.body.content.detectedFormat,
    //                       encoding: response.body.content.encoding,
    //                       isCompressed:
    //                           response.body.content.isCompressed || false,
    //                       sample: response.body.sample,
    //                   },
    //               }
    //             : undefined,

    //         // Repeater metadata
    //         repeaterMeta: txData.repeater
    //             ? {
    //                   create: {
    //                       source: txData.repeater.source,
    //                       originalTransactionId:
    //                           txData.repeater.originalTransactionId,
    //                       repeatedAt: txData.repeater.repeatedAt
    //                           ? new Date(txData.repeater.repeatedAt)
    //                           : null,
    //                   },
    //               }
    //             : undefined,
    //     }

    //     return input
    // }

    // async toTransactionCompleteEvent(
    //     transaction: Transaction
    // ): Promise<TransactionCompleteEvent> {
    //     // If the transaction doesn't have headers loaded, we need to fetch it with all related data
    //     const transactionWithHeaders =
    //         await this.transactionRepository.findByIdWithHeaders(transaction.id)

    //     if (!transactionWithHeaders) {
    //         throw new Error(`Transaction with ID ${transaction.id} not found`)
    //     }

    //     return this.transactionRepository.toTransactionCompleteEvent(
    //         transactionWithHeaders
    //     )
    // }
}
