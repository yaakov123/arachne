import type {
    Transaction,
    PrismaClient,
    TransactionCreateInput,
    TransactionFindManyArgs,
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
    async findByIdWithAllRelatedData(id: string) {
        return this.prisma.transaction.findUnique({
            where: { id },
            include: {
                requestHeaders: true,
                responseHeaders: true,
                requestBody: true,
                responseBody: true,
                repeaterMeta: true,
            },
        })
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
            orderBy: {
                timestamp: 'desc',
            },
        })
    }

    /**
     * Find transactions by project ID with headers
     */
    async findByProjectWithAllRelatedData(
        projectId: string,
        options?: TransactionFindManyArgs
    ) {
        return this.prisma.transaction.findMany({
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
        })
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
     * Batch create transactions for better performance
     */
    async createMany(transactions: TransactionCreateInput[]): Promise<number> {
        const results = await Promise.all(
            transactions.map((data) => this.create(data))
        )
        return results.length
    }
}
