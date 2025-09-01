import { getPrismaClient } from '../client'
import type {
    PrismaClient,
    AuthProfileCreateInput,
    AuthProfileFindManyArgs,
    AuthProfileUpdateInput,
    DatabaseAuthProfile,
    AuthProfile,
} from '../types/index'

/**
 * Repository for AuthProfile entity operations
 */
export class AuthProfileRepository {
    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient = getPrismaClient()) {
        this.prisma = prismaClient
    }

    private parseAuthProfile(authProfile: DatabaseAuthProfile): AuthProfile {
        return authProfile as unknown as AuthProfile
    }
    /**
     * Create a new auth profile
     */
    async create(data: AuthProfileCreateInput): Promise<AuthProfile> {
        return this.prisma.authProfile
            .create({
                data,
            })
            .then(this.parseAuthProfile)
    }

    /**
     * Find auth profile by ID
     */
    async findById(id: string): Promise<AuthProfile | null> {
        const authProfile = await this.prisma.authProfile.findUnique({
            where: { id },
        })
        if (!authProfile) {
            return null
        }
        return this.parseAuthProfile(authProfile)
    }

    /**
     * Find all auth profiles for a project with optional filtering
     */
    async findByProject(
        projectId: string,
        options?: AuthProfileFindManyArgs
    ): Promise<AuthProfile[]> {
        const authProfiles = await this.prisma.authProfile.findMany({
            where: { projectId },
            ...options,
        })
        return authProfiles.map(this.parseAuthProfile)
    }

    /**
     * Find enabled auth profiles for a project, ordered by priority
     */
    async findEnabledByProject(projectId: string): Promise<AuthProfile[]> {
        return this.prisma.authProfile
            .findMany({
                where: {
                    projectId,
                    enabled: true,
                },
                orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
            })
            .then((profiles) => profiles.map(this.parseAuthProfile))
    }

    /**
     * Find auth profiles by method for a project
     */
    async findByMethod(
        projectId: string,
        method: string
    ): Promise<AuthProfile[]> {
        return this.prisma.authProfile
            .findMany({
                where: {
                    projectId,
                    method,
                    enabled: true,
                },
                orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
            })
            .then((profiles) => profiles.map(this.parseAuthProfile))
    }

    /**
     * Update auth profile by ID
     */
    async update(
        id: string,
        data: AuthProfileUpdateInput
    ): Promise<AuthProfile> {
        return this.prisma.authProfile
            .update({
                where: { id },
                data,
            })
            .then(this.parseAuthProfile)
    }

    /**
     * Delete auth profile by ID
     */
    async delete(id: string): Promise<string> {
        await this.prisma.authProfile.delete({
            where: { id },
        })

        return id
    }

    /**
     * Find all auth profiles with optional filtering and pagination
     */
    async findMany(options?: AuthProfileFindManyArgs): Promise<AuthProfile[]> {
        return this.prisma.authProfile
            .findMany(options)
            .then((profiles) => profiles.map(this.parseAuthProfile))
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
