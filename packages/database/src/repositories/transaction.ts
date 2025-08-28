import type {
    Transaction,
    TransactionHeader,
    PrismaClient,
    TransactionCreateInput,
    TransactionFindManyArgs,
    TransactionWithHeaders,
} from '../types/index'
import { getPrismaClient } from '../client'

/**
 * Repository for Transaction entity operations
 */
export class TransactionRepository {
    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient = getPrismaClient()) {
        this.prisma = prismaClient
    }

    /**
     * Create a new transaction with related data
     */
    async create(data: TransactionCreateInput): Promise<Transaction> {
        return await this.prisma.transaction.create({
            data,
        })
    }

    /**
     * Find transaction by ID
     */
    async findById(id: string): Promise<Transaction | null> {
        return await this.prisma.transaction.findUnique({
            where: { id },
        })
    }

    /**
     * Find transaction by ID with all related data
     */
    async findByIdWithHeaders(
        id: string
    ): Promise<TransactionWithHeaders | null> {
        return (await this.prisma.transaction.findUnique({
            where: { id },
            include: {
                requestHeaders: true,
                responseHeaders: true,
                requestBody: true,
                responseBody: true,
                repeaterMeta: true,
            },
        })) as TransactionWithHeaders | null
    }

    /**
     * Find transactions by project ID with pagination
     */
    async findByProject(
        projectId: string,
        options?: TransactionFindManyArgs
    ): Promise<Transaction[]> {
        return await this.prisma.transaction.findMany({
            ...options,
            where: {
                projectId,
                ...options?.where,
            },
        })
    }

    /**
     * Find transactions by project ID with headers
     */
    async findByProjectWithHeaders(
        projectId: string,
        options?: TransactionFindManyArgs
    ): Promise<TransactionWithHeaders[]> {
        return (await this.prisma.transaction.findMany({
            ...options,
            where: {
                projectId,
                ...options?.where,
            },
            include: {
                requestHeaders: true,
                responseHeaders: true,
                requestBody: true,
                responseBody: true,
                repeaterMeta: true,
                ...options?.include,
            },
        })) as TransactionWithHeaders[]
    }

    /**
     * Count transactions by project ID
     */
    async countByProject(projectId: string): Promise<number> {
        return await this.prisma.transaction.count({
            where: { projectId },
        })
    }

    /**
     * Delete transaction by ID
     */
    async delete(id: string): Promise<void> {
        await this.prisma.transaction.delete({
            where: { id },
        })
    }

    /**
     * Delete all transactions for a project
     */
    async deleteByProject(projectId: string): Promise<number> {
        const result = await this.prisma.transaction.deleteMany({
            where: { projectId },
        })
        return result.count
    }

    /**
     * Delete old transactions based on retention policy
     */
    async deleteOldTransactions(
        projectId: string,
        retentionDays: number
    ): Promise<number> {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

        const result = await this.prisma.transaction.deleteMany({
            where: {
                projectId,
                timestamp: {
                    lt: cutoffDate,
                },
            },
        })

        return result.count
    }

    /**
     * Enforce max transaction limit for a project
     */
    async enforceMaxTransactions(
        projectId: string,
        maxTransactions: number
    ): Promise<number> {
        // Find excess transactions (oldest first)
        const excessTransactions = await this.prisma.transaction.findMany({
            where: { projectId },
            orderBy: { timestamp: 'asc' },
            skip: maxTransactions,
            select: { id: true },
        })

        if (excessTransactions.length === 0) {
            return 0
        }

        const result = await this.prisma.transaction.deleteMany({
            where: {
                id: {
                    in: excessTransactions.map((t) => t.id),
                },
            },
        })

        return result.count
    }

    /**
     * Get unique hosts for a project
     */
    async getUniqueHosts(projectId: string): Promise<string[]> {
        const result = await this.prisma.transaction.findMany({
            where: { projectId },
            select: { urlHost: true },
            distinct: ['urlHost'],
            orderBy: { urlHost: 'asc' },
        })

        return result.map((r) => r.urlHost)
    }

    /**
     * Get recent activity for a project
     */
    async getRecentActivity(
        projectId: string,
        limit: number = 10
    ): Promise<Transaction[]> {
        return await this.prisma.transaction.findMany({
            where: { projectId },
            orderBy: { timestamp: 'desc' },
            take: limit,
        })
    }

    /**
     * Convert database Transaction to API TransactionCompleteEvent
     */
    // async toTransactionCompleteEvent(
    //     transaction: TransactionWithHeaders
    // ): Promise<TransactionCompleteEvent> {
    //     const event: TransactionCompleteEvent = {
    //         type: 'transactionComplete',
    //         id: transaction.id,
    //         ts: transaction.timestamp.toISOString(),
    //         transaction: {
    //             request: {
    //                 method: transaction.method,
    //                 url: {
    //                     full: transaction.urlFull,
    //                     protocol: transaction.urlProtocol,
    //                     host: transaction.urlHost,
    //                     port: transaction.urlPort || undefined,
    //                     path: transaction.urlPath,
    //                     query: transaction.urlQuery || undefined,
    //                     fragment: transaction.urlFragment || undefined,
    //                 },
    //                 headers: transaction.requestHeaders.map((h) => ({
    //                     name: h.name,
    //                     value: h.value,
    //                     sensitive: h.sensitive,
    //                 })),
    //                 rawHeaders: this.headersToRawMap(
    //                     transaction.requestHeaders
    //                 ),
    //                 clientIp: transaction.clientIp || undefined,
    //                 body: transaction.requestBody
    //                     ? {
    //                           content: {
    //                               contentType:
    //                                   transaction.requestBody.contentType ||
    //                                   undefined,
    //                               contentEncoding:
    //                                   transaction.requestBody.contentEncoding ||
    //                                   undefined,
    //                               size: transaction.requestBody.size,
    //                               sampleSize:
    //                                   transaction.requestBody.sampleSize,
    //                               truncated: transaction.requestBody.truncated,
    //                               detectedFormat:
    //                                   (transaction.requestBody
    //                                       .detectedFormat as any) || undefined,
    //                               encoding: transaction.requestBody
    //                                   .encoding as any,
    //                               isCompressed:
    //                                   transaction.requestBody.isCompressed,
    //                           },
    //                           sample: transaction.requestBody.sample,
    //                       }
    //                     : undefined,
    //             },
    //             response: transaction.statusCode
    //                 ? {
    //                       statusCode: transaction.statusCode,
    //                       statusMessage: transaction.statusMessage || undefined,
    //                       headers: transaction.responseHeaders.map((h) => ({
    //                           name: h.name,
    //                           value: h.value,
    //                           sensitive: h.sensitive,
    //                       })),
    //                       rawHeaders: this.headersToRawMap(
    //                           transaction.responseHeaders
    //                       ),
    //                       body: transaction.responseBody
    //                           ? {
    //                                 content: {
    //                                     contentType:
    //                                         transaction.responseBody
    //                                             .contentType || undefined,
    //                                     contentEncoding:
    //                                         transaction.responseBody
    //                                             .contentEncoding || undefined,
    //                                     size: transaction.responseBody.size,
    //                                     sampleSize:
    //                                         transaction.responseBody.sampleSize,
    //                                     truncated:
    //                                         transaction.responseBody.truncated,
    //                                     detectedFormat:
    //                                         (transaction.responseBody
    //                                             .detectedFormat as any) ||
    //                                         undefined,
    //                                     encoding: transaction.responseBody
    //                                         .encoding as any,
    //                                     isCompressed:
    //                                         transaction.responseBody
    //                                             .isCompressed,
    //                                 },
    //                                 sample: transaction.responseBody.sample,
    //                             }
    //                           : undefined,
    //                   }
    //                 : undefined,
    //             timing: {
    //                 startTime: Number(transaction.startTime),
    //                 responseTime: transaction.responseTime
    //                     ? Number(transaction.responseTime)
    //                     : undefined,
    //                 duration: transaction.duration || undefined,
    //             },
    //             summary: {
    //                 requestSize: transaction.requestSize || undefined,
    //                 responseSize: transaction.responseSize || undefined,
    //                 hasRequestBody: transaction.hasRequestBody,
    //                 hasResponseBody: transaction.hasResponseBody,
    //             },
    //             repeater: transaction.repeaterMeta
    //                 ? {
    //                       source: transaction.repeaterMeta.source as any,
    //                       originalTransactionId:
    //                           transaction.repeaterMeta.originalTransactionId ||
    //                           undefined,
    //                       repeatedAt:
    //                           transaction.repeaterMeta.repeatedAt?.toISOString(),
    //                   }
    //                 : undefined,
    //         },
    //     }

    //     return event
    // }

    /**
     * Convert headers array to raw header map
     */
    // private headersToRawMap(
    //     headers: TransactionHeader[]
    // ): Record<string, string | string[]> {
    //     const map: Record<string, string | string[]> = {}

    //     for (const header of headers) {
    //         if (map[header.name]) {
    //             // Multiple values for same header
    //             if (Array.isArray(map[header.name])) {
    //                 ;(map[header.name] as string[]).push(header.value)
    //             } else {
    //                 map[header.name] = [
    //                     map[header.name] as string,
    //                     header.value,
    //                 ]
    //             }
    //         } else {
    //             map[header.name] = header.value
    //         }
    //     }

    //     return map
    // }

    /**
     * Batch create transactions for better performance
     */
    async createMany(transactions: TransactionCreateInput[]): Promise<number> {
        const results = await Promise.all(
            transactions.map((data) => this.create(data))
        )
        return results.length
    }
}
