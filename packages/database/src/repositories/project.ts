import { getPrismaClient } from '../client'
import type {
    Project,
    PrismaClient,
    ProjectWithStats,
    ProjectStats,
    ProjectCreateInput,
    ProjectFindManyArgs,
    ProjectUpdateInput,
    DatabaseProject,
} from '../types/index'

/**
 * Repository for Project entity operations
 */
export class ProjectRepository {
    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient = getPrismaClient()) {
        this.prisma = prismaClient
    }

    private parseProject(project: DatabaseProject): Project {
        const settings = project.settings
        return {
            ...project,
            settings: settings,
        } as Project
    }

    async count(): Promise<number> {
        return this.prisma.project.count()
    }
    /**
     * Create a new project
     */
    async create(data: ProjectCreateInput) {
        const project = await this.prisma.project.create({
            data,
        })
        return this.parseProject(project)
    }

    /**
     * Find project by ID
     */
    async findById(id: string): Promise<Project | null> {
        const project = await this.prisma.project.findUnique({
            where: { id },
        })
        if (!project) {
            return null
        }
        return this.parseProject(project)
    }

    /**
     * Find all projects
     */
    async findAll(): Promise<Project[]> {
        const projects = await this.prisma.project.findMany()
        return projects.map(this.parseProject)
    }

    /**
     * Find project by ID with transaction stats
     */
    async findByIdWithStats(id: string): Promise<ProjectWithStats | null> {
        return this.prisma.project.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        transactions: true,
                    },
                },
                transactions: {
                    select: {
                        requestSize: true,
                        responseSize: true,
                    },
                },
            },
        })
    }

    /**
     * Find all projects with optional filtering and pagination
     */
    async findMany(options?: ProjectFindManyArgs): Promise<Project[]> {
        const projects = await this.prisma.project.findMany(options)
        return projects.map(this.parseProject)
    }

    /**
     * Update project by ID
     */
    async update(id: string, data: ProjectUpdateInput): Promise<Project> {
        const project = await this.prisma.project.update({
            where: { id },
            data: data,
        })
        return this.parseProject(project)
    }

    /**
     * Delete project by ID (cascades to transactions)
     */
    async delete(id: string): Promise<void> {
        await this.prisma.project.delete({
            where: { id },
        })
    }

    /**
     * Check if project exists
     */
    async exists(id: string): Promise<boolean> {
        return (
            (await this.prisma.project.count({
                where: { id },
            })) > 0
        )
    }

    /**
     * Get project statistics
     */
    async getStats(projectId: string): Promise<ProjectStats | null> {
        const stats = await this.prisma.transaction.aggregate({
            where: { projectId },
            _count: true,
            _sum: {
                requestSize: true,
                responseSize: true,
            },
            _max: {
                timestamp: true,
            },
        })

        if (stats._count === 0) {
            return {
                transactionCount: 0,
                totalSize: 0,
                lastActivity: null,
            }
        }

        return {
            transactionCount: stats._count,
            totalSize:
                (stats._sum.requestSize ?? 0) + (stats._sum.responseSize ?? 0),
            lastActivity: stats._max.timestamp,
        }
    }
}
