import * as fs from 'fs/promises'
import * as path from 'path'
import { randomBytes } from 'crypto'
import type {
    ProjectMetadata,
    ProjectInfo,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '@arachne/api-types'
import type { TransactionCompleteEvent } from '@arachne/api-types'
import { logger } from '../logger'

export interface ProjectServiceOptions {
    baseDir: string // Base directory where projects are stored
    maxTransactions?: number // Max transactions per project
    retentionDays?: number // Default retention period
}

export class ProjectService {
    private baseDir: string
    private maxTransactions: number
    private retentionDays: number
    private currentProject: string | null = null
    private activeProjectMetadataFile: string

    constructor(options: ProjectServiceOptions) {
        this.baseDir = options.baseDir
        this.maxTransactions = options.maxTransactions ?? 10000
        this.retentionDays = options.retentionDays ?? 30
        this.activeProjectMetadataFile = path.join(
            this.baseDir,
            'active-project.json'
        )
    }

    /**
     * Initialize the project service, creating base directory if needed
     */
    async initialize(): Promise<void> {
        try {
            await fs.mkdir(this.baseDir, { recursive: true })

            // Load current project from metadata file
            await this.loadActiveProject()

            logger.info('ProjectService initialized', {
                baseDir: this.baseDir,
                currentProject: this.currentProject,
            })
        } catch (error) {
            logger.error('Failed to initialize ProjectService', {
                error,
                baseDir: this.baseDir,
            })
            throw error
        }
    }

    /**
     * Load the active project from metadata file
     */
    private async loadActiveProject(): Promise<void> {
        try {
            const content = await fs.readFile(
                this.activeProjectMetadataFile,
                'utf8'
            )
            const metadata = JSON.parse(content)

            if (
                metadata.activeProjectId &&
                typeof metadata.activeProjectId === 'string'
            ) {
                // Verify the project still exists
                if (await this.projectExists(metadata.activeProjectId)) {
                    this.currentProject = metadata.activeProjectId
                    logger.info('Loaded active project from metadata', {
                        projectId: metadata.activeProjectId,
                    })
                } else {
                    logger.warn(
                        'Active project from metadata no longer exists',
                        {
                            projectId: metadata.activeProjectId,
                        }
                    )
                    // Clear the invalid metadata file
                    await this.saveActiveProject()
                }
            }
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                logger.debug(
                    'No active project metadata file found, starting fresh'
                )
            } else {
                logger.warn('Failed to load active project metadata', { error })
            }
        }
    }

    /**
     * Save the active project to metadata file
     */
    private async saveActiveProject(): Promise<void> {
        try {
            const metadata = {
                activeProjectId: this.currentProject,
                lastUpdated: new Date().toISOString(),
            }

            await fs.writeFile(
                this.activeProjectMetadataFile,
                JSON.stringify(metadata, null, 2),
                'utf8'
            )

            logger.debug('Saved active project metadata', {
                projectId: this.currentProject,
            })
        } catch (error) {
            logger.error('Failed to save active project metadata', { error })
        }
    }

    /**
     * Ensure a default project exists and set it as current if no projects exist
     */
    async ensureDefaultProject(): Promise<ProjectInfo> {
        try {
            const projects = await this.listProjects()

            if (projects.length === 0) {
                logger.info('No projects found, creating default project')
                const defaultProject = await this.createProject({
                    name: 'Default Project',
                    description:
                        'Automatically created default project for capturing HTTP traffic',
                    tags: ['default'],
                    settings: {
                        maxTransactions: this.maxTransactions,
                        retentionDays: this.retentionDays,
                        hostFilter: [],
                        hostFilterMode: 'blacklist',
                        maxBodySize: 10 * 1024 * 1024, // 10MB default
                    },
                })

                // Set as current project
                this.setCurrentProject(defaultProject.metadata.id)
                logger.info('Default project created and activated', {
                    projectId: defaultProject.metadata.id,
                    projectName: defaultProject.metadata.name,
                })

                return defaultProject
            }

            // If projects exist but no current project is set, set the most recent one as current
            if (!this.currentProject) {
                const mostRecent = projects[0] // Already sorted by creation date (newest first)
                this.setCurrentProject(mostRecent.metadata.id)
                logger.info('Set most recent project as current', {
                    projectId: mostRecent.metadata.id,
                    projectName: mostRecent.metadata.name,
                })
                return mostRecent
            }

            // Verify current project still exists
            if (
                this.currentProject &&
                !(await this.projectExists(this.currentProject))
            ) {
                logger.warn(
                    'Current project no longer exists, setting most recent project as current',
                    {
                        missingProjectId: this.currentProject,
                    }
                )
                const mostRecent = projects[0]
                this.setCurrentProject(mostRecent.metadata.id)
                return mostRecent
            }

            // Current project exists, return it
            if (this.currentProject) {
                return await this.getProject(this.currentProject)
            }

            // Fallback to most recent project
            const mostRecent = projects[0]
            this.setCurrentProject(mostRecent.metadata.id)
            return mostRecent
        } catch (error) {
            logger.error('Failed to ensure default project', { error })
            throw error
        }
    }

    /**
     * Get the directory path for a specific project
     */
    private getProjectDir(projectId: string): string {
        return path.join(this.baseDir, projectId)
    }

    /**
     * Get the metadata file path for a project
     */
    private getMetadataPath(projectId: string): string {
        return path.join(this.getProjectDir(projectId), 'metadata.json')
    }

    /**
     * Get the transactions file path for a project
     */
    private getTransactionsPath(projectId: string): string {
        return path.join(this.getProjectDir(projectId), 'transactions.jsonl')
    }

    /**
     * Generate a unique project ID
     */
    private generateProjectId(): string {
        return randomBytes(16).toString('hex')
    }

    /**
     * Validate project name
     */
    private validateProjectName(name: string): void {
        if (!name || name.trim().length === 0) {
            throw new Error('Project name cannot be empty')
        }
        if (name.length > 100) {
            throw new Error('Project name cannot exceed 100 characters')
        }
        // Check for invalid characters that could cause filesystem issues
        if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(name)) {
            throw new Error('Project name contains invalid characters')
        }
    }

    /**
     * Check if a project exists
     */
    async projectExists(projectId: string): Promise<boolean> {
        try {
            const metadataPath = this.getMetadataPath(projectId)
            await fs.access(metadataPath)
            return true
        } catch {
            return false
        }
    }

    /**
     * Create a new project
     */
    async createProject(request: CreateProjectRequest): Promise<ProjectInfo> {
        this.validateProjectName(request.name)

        const projectId = this.generateProjectId()
        const now = new Date().toISOString()

        const metadata: ProjectMetadata = {
            id: projectId,
            name: request.name.trim(),
            description: request.description?.trim(),
            createdAt: now,
            updatedAt: now,
            tags: request.tags || [],
            settings: {
                maxTransactions:
                    request.settings?.maxTransactions ?? this.maxTransactions,
                retentionDays:
                    request.settings?.retentionDays ?? this.retentionDays,
                hostFilter: request.settings?.hostFilter ?? [],
                hostFilterMode: request.settings?.hostFilterMode ?? 'blacklist',
                maxBodySize: request.settings?.maxBodySize ?? 10 * 1024 * 1024, // 10MB default
            },
        }

        const projectDir = this.getProjectDir(projectId)
        const metadataPath = this.getMetadataPath(projectId)
        const transactionsPath = this.getTransactionsPath(projectId)

        try {
            // Create project directory
            await fs.mkdir(projectDir, { recursive: true })

            // Write metadata file
            await fs.writeFile(
                metadataPath,
                JSON.stringify(metadata, null, 2),
                'utf8'
            )

            // Create empty transactions file
            await fs.writeFile(transactionsPath, '', 'utf8')

            logger.info('Project created', { projectId, name: request.name })

            return {
                metadata,
                transactionCount: 0,
                sizeBytes: 0,
                lastActivity: now,
            }
        } catch (error) {
            // Cleanup on failure
            try {
                await fs.rm(projectDir, { recursive: true, force: true })
            } catch {
                // Ignore cleanup errors
            }
            logger.error('Failed to create project', {
                error,
                projectId,
                name: request.name,
            })
            throw error
        }
    }

    /**
     * Get project metadata
     */
    async getProject(projectId: string): Promise<ProjectInfo> {
        if (!(await this.projectExists(projectId))) {
            throw new Error(`Project not found: ${projectId}`)
        }

        const metadataPath = this.getMetadataPath(projectId)
        const transactionsPath = this.getTransactionsPath(projectId)

        try {
            // Read metadata
            const metadataJson = await fs.readFile(metadataPath, 'utf8')
            const metadata: ProjectMetadata = JSON.parse(metadataJson)

            // Get transaction count and file size
            const stats = await fs.stat(transactionsPath)
            const transactionCount = await this.getTransactionCount(projectId)

            return {
                metadata,
                transactionCount,
                sizeBytes: stats.size,
                lastActivity: metadata.updatedAt,
            }
        } catch (error) {
            logger.error('Failed to get project', { error, projectId })
            throw error
        }
    }

    /**
     * Update project metadata
     */
    async updateProject(
        projectId: string,
        request: UpdateProjectRequest
    ): Promise<ProjectInfo> {
        if (!(await this.projectExists(projectId))) {
            throw new Error(`Project not found: ${projectId}`)
        }

        if (request.name !== undefined) {
            this.validateProjectName(request.name)
        }

        const metadataPath = this.getMetadataPath(projectId)

        try {
            // Read current metadata
            const metadataJson = await fs.readFile(metadataPath, 'utf8')
            const metadata: ProjectMetadata = JSON.parse(metadataJson)

            // Update fields
            const updatedMetadata: ProjectMetadata = {
                ...metadata,
                name: request.name?.trim() ?? metadata.name,
                description:
                    request.description?.trim() ?? metadata.description,
                tags: request.tags ?? metadata.tags,
                settings: request.settings
                    ? { ...metadata.settings, ...request.settings }
                    : metadata.settings,
                updatedAt: new Date().toISOString(),
            }

            // Write updated metadata
            await fs.writeFile(
                metadataPath,
                JSON.stringify(updatedMetadata, null, 2),
                'utf8'
            )

            logger.info('Project updated', {
                projectId,
                changes: Object.keys(request),
            })

            return this.getProject(projectId)
        } catch (error) {
            logger.error('Failed to update project', { error, projectId })
            throw error
        }
    }

    /**
     * Delete a project
     */
    async deleteProject(projectId: string): Promise<void> {
        if (!(await this.projectExists(projectId))) {
            throw new Error(`Project not found: ${projectId}`)
        }

        const projectDir = this.getProjectDir(projectId)

        try {
            await fs.rm(projectDir, { recursive: true })

            // If this was the current project, clear it
            if (this.currentProject === projectId) {
                this.setCurrentProject(null)
                logger.info('Cleared current project after deletion', {
                    projectId,
                })
            }

            logger.info('Project deleted', { projectId })
        } catch (error) {
            logger.error('Failed to delete project', { error, projectId })
            throw error
        }
    }

    /**
     * List all projects
     */
    async listProjects(): Promise<ProjectInfo[]> {
        try {
            const entries = await fs.readdir(this.baseDir, {
                withFileTypes: true,
            })
            const projectDirs = entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)

            const projects: ProjectInfo[] = []

            for (const projectId of projectDirs) {
                try {
                    const project = await this.getProject(projectId)
                    projects.push(project)
                } catch (error) {
                    logger.warn('Failed to load project during listing', {
                        projectId,
                        error,
                    })
                    // Continue with other projects
                }
            }

            // Sort by creation date (newest first)
            projects.sort(
                (a, b) =>
                    new Date(b.metadata.createdAt).getTime() -
                    new Date(a.metadata.createdAt).getTime()
            )

            return projects
        } catch (error) {
            logger.error('Failed to list projects', { error })
            throw error
        }
    }

    /**
     * Add a transaction to a project
     */
    async addTransaction(
        projectId: string,
        transaction: TransactionCompleteEvent
    ): Promise<void> {
        try {
            if (!(await this.projectExists(projectId))) {
                throw new Error(`Project not found: ${projectId}`)
            }
        } catch (error) {
            logger.error('Failed to add transaction to project', {
                error,
                projectId,
                transactionId: transaction.id,
            })
            return
        }

        const transactionsPath = this.getTransactionsPath(projectId)

        try {
            // Append transaction as JSONL
            const jsonLine = JSON.stringify(transaction) + '\n'
            await fs.appendFile(transactionsPath, jsonLine, 'utf8')

            // Update metadata timestamp
            await this.updateProjectTimestamp(projectId)

            logger.debug('Transaction added to project', {
                projectId,
                transactionId: transaction.id,
            })
        } catch (error) {
            logger.error('Failed to add transaction to project', {
                error,
                projectId,
                transactionId: transaction.id,
            })
        }
    }

    async addTransactionToCurrentProject(
        transaction: TransactionCompleteEvent
    ): Promise<void> {
        if (!this.currentProject) {
            logger.debug(
                'No current project selected, skipping transaction save',
                {
                    transactionId: transaction.id,
                }
            )
            return
        }

        try {
            await this.addTransaction(this.currentProject, transaction)
        } catch (error) {
            logger.warn('Failed to save transaction to current project', {
                error,
                projectId: this.currentProject,
                transactionId: transaction.id,
            })
        }
    }

    /**
     * Get transaction count for a project
     */
    async getTransactionCount(projectId: string): Promise<number> {
        if (!(await this.projectExists(projectId))) {
            return 0
        }

        const transactionsPath = this.getTransactionsPath(projectId)

        try {
            const content = await fs.readFile(transactionsPath, 'utf8')
            if (!content.trim()) {
                return 0
            }
            return content.trim().split('\n').length
        } catch (error) {
            logger.error('Failed to get transaction count', {
                error,
                projectId,
            })
            return 0
        }
    }

    /**
     * Get all transactions for a project
     */
    async getTransactions(
        projectId: string
    ): Promise<TransactionCompleteEvent[]> {
        if (!(await this.projectExists(projectId))) {
            throw new Error(`Project not found: ${projectId}`)
        }

        const transactionsPath = this.getTransactionsPath(projectId)

        try {
            const content = await fs.readFile(transactionsPath, 'utf8')
            if (!content.trim()) {
                return []
            }

            const lines = content.trim().split('\n')
            const transactions: TransactionCompleteEvent[] = []

            // Parse all transactions (newest first)
            for (let i = lines.length - 1; i >= 0; i--) {
                try {
                    const transaction = JSON.parse(lines[i])
                    transactions.push(transaction)
                } catch (parseError) {
                    logger.warn('Failed to parse transaction line', {
                        projectId,
                        lineIndex: i,
                        parseError,
                    })
                }
            }

            return transactions
        } catch (error) {
            logger.error('Failed to get transactions', { error, projectId })
            throw error
        }
    }

    /**
     * Set the current active project
     */
    setCurrentProject(projectId: string | null): void {
        this.currentProject = projectId
        logger.info('Current project changed', { projectId })

        // Save to metadata file asynchronously (don't await to avoid blocking)
        this.saveActiveProject().catch((error) => {
            logger.error(
                'Failed to save active project metadata after change',
                { error, projectId }
            )
        })
    }

    /**
     * Get the current active project
     */
    getCurrentProject(): string | null {
        return this.currentProject
    }

    /**
     * Update project timestamp
     */
    private async updateProjectTimestamp(projectId: string): Promise<void> {
        try {
            const metadataPath = this.getMetadataPath(projectId)
            const metadataJson = await fs.readFile(metadataPath, 'utf8')
            const metadata: ProjectMetadata = JSON.parse(metadataJson)

            metadata.updatedAt = new Date().toISOString()

            await fs.writeFile(
                metadataPath,
                JSON.stringify(metadata, null, 2),
                'utf8'
            )
        } catch (error) {
            logger.warn('Failed to update project timestamp', {
                error,
                projectId,
            })
        }
    }
}
