import { getPrismaClient } from '../client'
import type {
    Host,
    Endpoint,
    PrismaClient,
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
     * Find or create host for a project
     */
    async findOrCreateHost(projectId: string, hostname: string): Promise<Host> {
        return await this.prisma.host.upsert({
            where: {
                projectId_hostname: {
                    projectId,
                    hostname,
                },
            },
            create: {
                hostname,
                projectId,
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            update: {
                lastSeen: new Date(),
            },
        })
    }

    /**
     * Create or update host statistics (legacy method - updated for new schema)
     */
    async upsertHost(projectId: string, hostname: string): Promise<Host> {
        return this.findOrCreateHost(projectId, hostname)
    }

    /**
     * Create or update endpoint statistics
     */
    async upsertEndpoint(
        projectId: string,
        hostname: string,
        method: string,
        path: string
    ): Promise<Endpoint> {
        // Ensure host exists first
        const host = await this.findOrCreateHost(projectId, hostname)

        return await this.prisma.endpoint.upsert({
            where: {
                hostId_method_path: {
                    hostId: host.id,
                    method,
                    path,
                },
            },
            create: {
                hostId: host.id,
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
        projectId: string,
        hostname: string,
        method: string,
        path: string
    ): Promise<void> {
        await this.upsertEndpoint(projectId, hostname, method, path)
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
     * Find host by project and hostname
     */
    async findHostByProjectAndHostname(
        projectId: string,
        hostname: string
    ): Promise<Host | null> {
        return await this.prisma.host.findUnique({
            where: {
                projectId_hostname: {
                    projectId,
                    hostname,
                },
            },
        })
    }

    /**
     * Find host by ID with endpoints
     */
    async findHostByIdWithEndpoints(id: string) {
        return await this.prisma.host.findUnique({
            where: { id },
            include: {
                endpoints: {
                    orderBy: [{ hits: 'desc' }, { lastSeen: 'desc' }],
                },
            },
        })
    }

    /**
     * Find all hosts with pagination
     */
    async findManyHosts(options?: HostFindManyArgs): Promise<Host[]> {
        return await this.prisma.host.findMany(options)
    }

    /**
     * Find hosts by project
     */
    async findHostsByProject(projectId: string): Promise<Host[]> {
        return await this.prisma.host.findMany({
            where: { projectId },
            orderBy: [{ lastSeen: 'desc' }],
        })
    }

    async findHostWithTransactionCount(projectId: string) {
        return await this.prisma.host.findMany({
            where: { projectId },
            include: { _count: { select: { transactions: true } } },
        })
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
            orderBy: [{ lastSeen: 'desc' }],
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
        mostActiveHost?: Host
    }> {
        const [hostCount, endpointCount, mostActiveHost] = await Promise.all([
            this.prisma.host.count(),
            this.prisma.endpoint.count(),
            this.prisma.host.findFirst({
                orderBy: {
                    lastSeen: 'desc',
                },
            }),
        ])

        return {
            totalHosts: hostCount,
            totalEndpoints: endpointCount,
            mostActiveHost: mostActiveHost || undefined,
        }
    }
}
