import { getPrismaClient } from '../client'
import type {
    AuthProfile,
    PrismaClient,
    AuthProfileCreateInput,
    AuthProfileFindManyArgs,
    AuthProfileUpdateInput,
} from '../types/index'

/**
 * Repository for AuthProfile entity operations
 */
export class AuthProfileRepository {
    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient = getPrismaClient()) {
        this.prisma = prismaClient
    }

    /**
     * Create a new auth profile
     */
    async create(data: AuthProfileCreateInput): Promise<AuthProfile> {
        return this.prisma.authProfile.create({
            data,
        })
    }

    /**
     * Find auth profile by ID
     */
    async findById(id: string): Promise<AuthProfile | null> {
        return this.prisma.authProfile.findUnique({
            where: { id },
        })
    }

    /**
     * Find all auth profiles for a project with optional filtering
     */
    async findByProject(
        projectId: string,
        options?: Omit<AuthProfileFindManyArgs, 'where'>
    ): Promise<AuthProfile[]> {
        return this.prisma.authProfile.findMany({
            where: { projectId },
            ...options,
        })
    }

    /**
     * Find enabled auth profiles for a project, ordered by priority
     */
    async findEnabledByProject(projectId: string): Promise<AuthProfile[]> {
        return this.prisma.authProfile.findMany({
            where: {
                projectId,
                enabled: true,
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        })
    }

    /**
     * Find auth profiles by method for a project
     */
    async findByMethod(
        projectId: string,
        method: string
    ): Promise<AuthProfile[]> {
        return this.prisma.authProfile.findMany({
            where: {
                projectId,
                method,
                enabled: true,
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        })
    }

    /**
     * Update auth profile by ID
     */
    async update(
        id: string,
        data: AuthProfileUpdateInput
    ): Promise<AuthProfile> {
        return this.prisma.authProfile.update({
            where: { id },
            data,
        })
    }

    /**
     * Delete auth profile by ID
     */
    async delete(id: string): Promise<AuthProfile> {
        return this.prisma.authProfile.delete({
            where: { id },
        })
    }

    /**
     * Find all auth profiles with optional filtering and pagination
     */
    async findMany(options?: AuthProfileFindManyArgs): Promise<AuthProfile[]> {
        return this.prisma.authProfile.findMany(options)
    }

    /**
     * Count auth profiles for a project
     */
    async countByProject(projectId: string): Promise<number> {
        return this.prisma.authProfile.count({
            where: { projectId },
        })
    }

    /**
     * Check if an auth profile with the same name exists in the project
     */
    async existsByName(
        projectId: string,
        name: string,
        excludeId?: string
    ): Promise<boolean> {
        const count = await this.prisma.authProfile.count({
            where: {
                projectId,
                name,
                ...(excludeId && { id: { not: excludeId } }),
            },
        })
        return count > 0
    }
}
