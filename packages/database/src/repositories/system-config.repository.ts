import { getPrismaClient } from '../client'
import type {
    SystemConfig,
    PrismaClient,
    SystemConfigUpdateInput,
} from '../types/index'

/**
 * Repository for SystemConfig operations (active project tracking, etc.)
 */
export class SystemConfigRepository {
    private static readonly SYSTEM_ID = 'system'

    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient = getPrismaClient()) {
        this.prisma = prismaClient
    }

    /**
     * Get system configuration (creates if doesn't exist)
     */
    async getConfig(): Promise<SystemConfig> {
        let config = await this.prisma.systemConfig.findUnique({
            where: { id: SystemConfigRepository.SYSTEM_ID },
        })

        if (!config) {
            config = await this.prisma.systemConfig.create({
                data: {
                    id: SystemConfigRepository.SYSTEM_ID,
                    activeProjectId: null,
                    lastUpdated: new Date(),
                },
            })
        }

        return config
    }

    /**
     * Get the currently active project ID
     */
    async getActiveProjectId(): Promise<string | null> {
        const config = await this.getConfig()
        return config.activeProjectId
    }

    /**
     * Set the active project
     */
    async setActiveProjectId(projectId: string | null): Promise<SystemConfig> {
        return await this.prisma.systemConfig.upsert({
            where: { id: SystemConfigRepository.SYSTEM_ID },
            create: {
                id: SystemConfigRepository.SYSTEM_ID,
                activeProjectId: projectId,
                lastUpdated: new Date(),
            },
            update: {
                activeProjectId: projectId,
                lastUpdated: new Date(),
            },
        })
    }

    /**
     * Update system configuration
     */
    async updateConfig(
        updates: SystemConfigUpdateInput
    ): Promise<SystemConfig> {
        const config = await this.getConfig()

        return await this.prisma.systemConfig.update({
            where: { id: config.id },
            data: updates,
        })
    }

    /**
     * Check if a project is currently active
     */
    async isProjectActive(projectId: string): Promise<boolean> {
        const activeProjectId = await this.getActiveProjectId()
        return activeProjectId === projectId
    }

    /**
     * Clear the active project (set to null)
     */
    async clearActiveProject(): Promise<SystemConfig> {
        return await this.setActiveProjectId(null)
    }

    /**
     * Get system status information
     */
    async getSystemStatus(): Promise<{
        activeProjectId: string | null
        lastUpdated: Date
        hasActiveProject: boolean
    }> {
        const config = await this.getConfig()

        return {
            activeProjectId: config.activeProjectId,
            lastUpdated: config.lastUpdated,
            hasActiveProject: config.activeProjectId !== null,
        }
    }

    /**
     * Reset system configuration to defaults
     */
    async resetConfig(): Promise<SystemConfig> {
        return await this.prisma.systemConfig.upsert({
            where: { id: SystemConfigRepository.SYSTEM_ID },
            create: {
                id: SystemConfigRepository.SYSTEM_ID,
                activeProjectId: null,
                lastUpdated: new Date(),
            },
            update: {
                activeProjectId: null,
                lastUpdated: new Date(),
            },
        })
    }
}
