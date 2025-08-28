import { logger } from '../logger'
import { EventEmitter } from 'events'
import {
    ProjectCreateInput,
    ProjectRepository,
    ProjectUpdateInput,
    SystemConfigService,
} from '@arachne/database'

export interface ProjectServiceOptions {
    baseDir: string // Base directory where projects are stored
    maxTransactions?: number // Max transactions per project
    retentionDays?: number // Default retention period
}

interface ProjectServiceEvents {
    projectChanged: [id: string]
}

export class ProjectService extends EventEmitter<ProjectServiceEvents> {
    private currentProject: string | null = null
    private projectRepository: ProjectRepository = new ProjectRepository()
    private systemConfigService: SystemConfigService = new SystemConfigService()
    constructor() {
        super()
    }

    /**
     * Initialize the project service, creating base directory if needed
     */
    async initialize() {
        return this.ensureDefaultProject()
    }

    async ensureDefaultProject() {
        let project = await this.projectRepository.findById('default')
        if (!project) {
            project = await this.projectRepository.create({
                id: 'default',
                name: 'Default Project',
                description: 'Default project for the application',
                createdAt: new Date(),
                updatedAt: new Date(),
                settings: {
                    maxTransactions: 10000,
                    retentionDays: 30,
                    hostFilterMode: 'whitelist',
                    maxBodySize: 10485760,
                },
            })
        }

        await this.saveActiveProject(project.id)
        return project
    }

    /**
     * Save the active project to metadata file
     */
    async saveActiveProject(projectId: string | null): Promise<void> {
        try {
            await this.systemConfigService.updateSystemConfig({
                activeProjectId: projectId,
                lastUpdated: new Date().toISOString(),
            })

            logger.info('Active project saved', { projectId })

            if (projectId) {
                this.emit('projectChanged', projectId)
            }

            this.setCurrentProject(projectId)
        } catch (error) {
            logger.error('Failed to save active project metadata', { error })
        }
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
            return this.projectRepository.exists(projectId)
        } catch {
            return false
        }
    }

    /**
     * Create a new project
     */
    async createProject(request: ProjectCreateInput) {
        this.validateProjectName(request.name)

        return this.projectRepository.create(request)
    }

    /**
     * Get project metadata
     */
    async getProject(projectId: string) {
        return this.projectRepository.findById(projectId)
    }

    /**
     * Update project metadata
     */
    async updateProject(projectId: string, project: ProjectUpdateInput) {
        const updatedProject = await this.projectRepository.update(
            projectId,
            project
        )

        // Emit projectChanged event to notify listeners of the update
        this.emit('projectChanged', projectId)

        return updatedProject
    }

    /**
     * Delete a project
     */
    async deleteProject(projectId: string) {
        await this.projectRepository.delete(projectId)
    }

    /**
     * List all projects
     */
    async listProjects() {
        return this.projectRepository.findMany()
    }

    /**
     * Set the current active project
     */
    async setCurrentProject(projectId: string | null): Promise<void> {
        this.currentProject = projectId
    }

    /**
     * Get the current active project
     */
    async getCurrentProject() {
        if (!this.currentProject) {
            return null
        }
        return this.getProject(this.currentProject)
    }

    getCurrentProjectId() {
        return this.currentProject
    }

    cleanup(): void {
        this.removeAllListeners()
    }
}
