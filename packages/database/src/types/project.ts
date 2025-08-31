import type { Project as DatabaseProject, Prisma } from '@prisma/client'

// Repository input types
// Prisma input types
export type ProjectCreateInput = Prisma.ProjectCreateInput
export type ProjectUpdateInput = Prisma.ProjectUpdateInput
export type ProjectFindManyArgs = Prisma.ProjectFindManyArgs

export type Project = Omit<DatabaseProject, 'settings' | 'tags'> & {
    settings: ProjectSettings
    tags: string[]
}

export interface ProjectSettings {
    maxTransactions?: number
    retentionDays?: number
    hostFilterMode?: 'blacklist' | 'whitelist'
    hostFilter?: string[]
    maxBodySize?: number
}

export interface ProjectWithStats extends DatabaseProject {
    _count?: {
        transactions: number
    }
    _sum?: {
        transactions: {
            requestSize: number
            responseSize: number
        }
    }
}

export interface ProjectStats {
    transactionCount: number
    totalSize: number
    lastActivity: Date | null
}

export type { Project as DatabaseProject } from '@prisma/client'
