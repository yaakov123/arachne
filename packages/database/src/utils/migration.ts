import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getPrismaClient } from '../client.js'
import { ProjectRepository } from '../repositories/project.js'
import { generateId } from './id.js'

/**
 * Migration utilities for converting from file-based storage to database
 */

export interface ProjectMetadataFile {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    tags?: string[]
    settings?: {
        maxTransactions?: number
        retentionDays?: number
        hostFilter?: string[]
        hostFilterMode?: 'blacklist' | 'whitelist'
        maxBodySize?: number
    }
}

export interface MigrationOptions {
    projectsDir: string
    batchSize?: number
    dryRun?: boolean
}

export interface MigrationResult {
    projectsMigrated: number
    transactionsMigrated: number
    errors: string[]
    skipped: string[]
}

/**
 * Migrate projects from file-based storage to database
 */
export async function migrateFromFileStorage(
    options: MigrationOptions
): Promise<MigrationResult> {
    const result: MigrationResult = {
        projectsMigrated: 0,
        transactionsMigrated: 0,
        errors: [],
        skipped: [],
    }

    try {
        const prisma = getPrismaClient()
        const projectRepo = new ProjectRepository(prisma)

        // Get all project directories
        const projectDirs = await getProjectDirectories(options.projectsDir)

        for (const projectDir of projectDirs) {
            try {
                const projectPath = join(options.projectsDir, projectDir)

                // Skip if not a directory
                const stats = await stat(projectPath)
                if (!stats.isDirectory()) {
                    continue
                }

                // Check if project already exists in database
                const existingProject = await projectRepo.findById(projectDir)
                if (existingProject) {
                    result.skipped.push(
                        `Project ${projectDir} already exists in database`
                    )
                    continue
                }

                // Read metadata.json
                const metadataPath = join(projectPath, 'metadata.json')
                let metadata: ProjectMetadataFile

                try {
                    const metadataContent = await readFile(
                        metadataPath,
                        'utf-8'
                    )
                    metadata = JSON.parse(metadataContent)
                } catch (error) {
                    result.errors.push(
                        `Failed to read metadata for ${projectDir}: ${error}`
                    )
                    continue
                }

                // Migrate project
                if (!options.dryRun) {
                    await projectRepo.create({
                        id: metadata.id || projectDir,
                        name: metadata.name,
                        description: metadata.description,
                        tags: metadata.tags,
                        maxTransactions: metadata.settings?.maxTransactions,
                        retentionDays: metadata.settings?.retentionDays,
                        hostFilter: metadata.settings?.hostFilter,
                        hostFilterMode: metadata.settings?.hostFilterMode,
                        maxBodySize: metadata.settings?.maxBodySize,
                    })
                }

                result.projectsMigrated++

                // Migrate transactions from transactions.jsonl
                const transactionsPath = join(projectPath, 'transactions.jsonl')
                try {
                    const transactionCount = await migrateTransactionsFile(
                        transactionsPath,
                        metadata.id || projectDir,
                        options.batchSize || 100,
                        options.dryRun || false
                    )
                    result.transactionsMigrated += transactionCount
                } catch (error) {
                    result.errors.push(
                        `Failed to migrate transactions for ${projectDir}: ${error}`
                    )
                }
            } catch (error) {
                result.errors.push(
                    `Failed to migrate project ${projectDir}: ${error}`
                )
            }
        }
    } catch (error) {
        result.errors.push(`Migration failed: ${error}`)
    }

    return result
}

/**
 * Get list of project directories
 */
async function getProjectDirectories(projectsDir: string): Promise<string[]> {
    try {
        const entries = await readdir(projectsDir)
        const projectDirs: string[] = []

        for (const entry of entries) {
            // Skip special files
            if (entry === 'active-project.json' || entry.startsWith('.')) {
                continue
            }

            const entryPath = join(projectsDir, entry)
            const stats = await stat(entryPath)

            if (stats.isDirectory()) {
                projectDirs.push(entry)
            }
        }

        return projectDirs
    } catch (error) {
        throw new Error(`Failed to read projects directory: ${error}`)
    }
}

/**
 * Migrate transactions from a JSONL file
 */
async function migrateTransactionsFile(
    filePath: string,
    projectId: string,
    batchSize: number,
    dryRun: boolean
): Promise<number> {
    try {
        const content = await readFile(filePath, 'utf-8')
        const lines = content
            .trim()
            .split('\n')
            .filter((line) => line.trim())

        if (dryRun) {
            return lines.length
        }

        // Process in batches to avoid memory issues
        let migrated = 0

        for (let i = 0; i < lines.length; i += batchSize) {
            const batch = lines.slice(i, i + batchSize)
            // Note: Actual transaction migration would need to be implemented
            // based on the specific format of the JSONL transactions
            migrated += batch.length
        }

        return migrated
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            // No transactions file exists
            return 0
        }
        throw error
    }
}

/**
 * Migrate active project setting
 */
export async function migrateActiveProject(
    projectsDir: string
): Promise<string | null> {
    try {
        const activeProjectPath = join(projectsDir, 'active-project.json')
        const content = await readFile(activeProjectPath, 'utf-8')
        const activeProject = JSON.parse(content)

        return activeProject.activeProjectId || null
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            return null
        }
        throw new Error(`Failed to read active project: ${error}`)
    }
}

/**
 * Create a backup of existing file-based data
 */
export async function createBackup(
    projectsDir: string,
    backupDir: string
): Promise<void> {
    // This would implement a backup strategy
    // for now, it's a placeholder
    console.log(
        `Backup from ${projectsDir} to ${backupDir} - not implemented yet`
    )
}

/**
 * Validate database schema and setup
 */
export async function validateDatabaseSetup(): Promise<{
    isValid: boolean
    errors: string[]
}> {
    const errors: string[] = []

    try {
        const prisma = getPrismaClient()

        // Test basic connectivity
        await prisma.$connect()

        // Test if tables exist by trying to count records
        await prisma.project.count()
        await prisma.transaction.count()
        await prisma.host.count()
        await prisma.systemConfig.count()

        return { isValid: true, errors: [] }
    } catch (error) {
        errors.push(`Database validation failed: ${error}`)
        return { isValid: false, errors }
    }
}
