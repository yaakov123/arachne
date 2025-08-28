import { getPrismaClient } from '../client'
import type {
    Host,
    Endpoint,
    PrismaClient,
    HostWithEndpoints,
    HostFindManyArgs,
    EndpointFindManyArgs,
} from '../types/index'

/**
 * Repository for Host and Endpoint analytics operations
 */
export class HostRepository {
    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient = getPrismaClient()) {
        this.prisma = prismaClient
    }

    /**
     * Create or update host statistics
     */
    async upsertHost(hostId: string): Promise<Host> {
        return await this.prisma.host.upsert({
            where: { id: hostId },
            create: {
                id: hostId,
                firstSeen: new Date(),
                lastSeen: new Date(),
                totalHits: 1,
            },
            update: {
                lastSeen: new Date(),
                totalHits: {
                    increment: 1,
                },
            },
        })
    }

    /**
     * Create or update endpoint statistics
     */
    async upsertEndpoint(
        hostId: string,
        method: string,
        path: string
    ): Promise<Endpoint> {
        // Ensure host exists first
        await this.upsertHost(hostId)

        return await this.prisma.endpoint.upsert({
            where: {
                hostId_method_path: {
                    hostId,
                    method,
                    path,
                },
            },
            create: {
                hostId,
                method,
                path,
                firstSeen: new Date(),
                lastSeen: new Date(),
                hits: 1,
            },
            update: {
                lastSeen: new Date(),
                hits: {
                    increment: 1,
                },
            },
        })
    }

    /**
     * Record transaction activity for analytics
     */
    async recordTransactionActivity(
        hostId: string,
        method: string,
        path: string
    ): Promise<void> {
        await this.upsertEndpoint(hostId, method, path)
    }

    /**
     * Find host by ID
     */
    async findHostById(id: string): Promise<Host | null> {
        return await this.prisma.host.findUnique({
            where: { id },
        })
    }

    /**
     * Find host by ID with endpoints
     */
    async findHostByIdWithEndpoints(
        id: string
    ): Promise<HostWithEndpoints | null> {
        return (await this.prisma.host.findUnique({
            where: { id },
            include: {
                endpoints: {
                    orderBy: [{ hits: 'desc' }, { lastSeen: 'desc' }],
                },
            },
        })) as HostWithEndpoints | null
    }

    /**
     * Find all hosts with pagination
     */
    async findManyHosts(options?: HostFindManyArgs): Promise<Host[]> {
        return await this.prisma.host.findMany(options)
    }

    /**
     * Find all hosts with endpoints
     */
    async findManyHostsWithEndpoints(
        options?: HostFindManyArgs
    ): Promise<HostWithEndpoints[]> {
        return (await this.prisma.host.findMany({
            ...options,
            include: {
                endpoints: {
                    orderBy: [{ hits: 'desc' }, { lastSeen: 'desc' }],
                },
                ...options?.include,
            },
        })) as HostWithEndpoints[]
    }

    /**
     * Find endpoints for a specific host
     */
    async findEndpointsByHost(
        hostId: string,
        options?: EndpointFindManyArgs
    ): Promise<Endpoint[]> {
        return await this.prisma.endpoint.findMany({
            ...options,
            where: { hostId, ...options?.where },
        })
    }

    /**
     * Get top hosts by activity
     */
    async getTopHosts(limit: number = 10): Promise<Host[]> {
        return await this.prisma.host.findMany({
            take: limit,
            orderBy: [{ totalHits: 'desc' }, { lastSeen: 'desc' }],
        })
    }

    /**
     * Get top endpoints across all hosts
     */
    async getTopEndpoints(limit: number = 10): Promise<Endpoint[]> {
        return await this.prisma.endpoint.findMany({
            take: limit,
            orderBy: [{ hits: 'desc' }, { lastSeen: 'desc' }],
        })
    }

    /**
     * Get top endpoints for a specific host
     */
    async getTopEndpointsByHost(
        hostId: string,
        limit: number = 10
    ): Promise<Endpoint[]> {
        return await this.prisma.endpoint.findMany({
            where: { hostId },
            take: limit,
            orderBy: [{ hits: 'desc' }, { lastSeen: 'desc' }],
        })
    }

    /**
     * Delete host and all its endpoints
     */
    async deleteHost(id: string): Promise<void> {
        await this.prisma.host.delete({
            where: { id },
        })
    }

    /**
     * Delete endpoint by ID
     */
    async deleteEndpoint(id: string): Promise<void> {
        await this.prisma.endpoint.delete({
            where: { id },
        })
    }

    /**
     * Clean up old analytics data
     */
    async cleanupOldData(
        cutoffDate: Date
    ): Promise<{ hostsDeleted: number; endpointsDeleted: number }> {
        // Delete endpoints with no recent activity
        const endpointsResult = await this.prisma.endpoint.deleteMany({
            where: {
                lastSeen: {
                    lt: cutoffDate,
                },
            },
        })

        // Delete hosts with no endpoints
        const hostsWithoutEndpoints = await this.prisma.host.findMany({
            where: {
                endpoints: {
                    none: {},
                },
            },
            select: { id: true },
        })

        const hostsResult = await this.prisma.host.deleteMany({
            where: {
                id: {
                    in: hostsWithoutEndpoints.map((h) => h.id),
                },
            },
        })

        return {
            hostsDeleted: hostsResult.count,
            endpointsDeleted: endpointsResult.count,
        }
    }

    /**
     * Get analytics summary
     */
    async getAnalyticsSummary(): Promise<{
        totalHosts: number
        totalEndpoints: number
        totalHits: number
        mostActiveHost?: Host
    }> {
        const [hostCount, endpointCount, hitsSum, mostActiveHost] =
            await Promise.all([
                this.prisma.host.count(),
                this.prisma.endpoint.count(),
                this.prisma.host.aggregate({
                    _sum: {
                        totalHits: true,
                    },
                }),
                this.prisma.host.findFirst({
                    orderBy: {
                        totalHits: 'desc',
                    },
                }),
            ])

        return {
            totalHosts: hostCount,
            totalEndpoints: endpointCount,
            totalHits: Number(hitsSum._sum.totalHits || 0),
            mostActiveHost: mostActiveHost || undefined,
        }
    }
}
