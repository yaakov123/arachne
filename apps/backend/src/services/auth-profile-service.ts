import { AuthProfileRepository } from '@arachne/database'
import type {
    AuthProfile,
    AuthProfileCreateInput,
    AuthProfileUpdateInput,
} from '@arachne/database'

/**
 * Service for managing authentication profiles
 */
export class AuthProfileService {
    private authProfileRepository: AuthProfileRepository

    constructor() {
        this.authProfileRepository = new AuthProfileRepository()
    }

    /**
     * Create a new auth profile
     */
    async createAuthProfile(
        data: AuthProfileCreateInput
    ): Promise<AuthProfile> {
        // Check if name already exists in the project
        if (data.project?.connect?.id) {
            const exists = await this.authProfileRepository.existsByName(
                data.project.connect.id,
                data.name
            )
            if (exists) {
                throw new Error(
                    `Auth profile with name "${data.name}" already exists in this project`
                )
            }
        }

        return this.authProfileRepository.create(data)
    }

    /**
     * Get auth profile by ID
     */
    async getAuthProfile(id: string): Promise<AuthProfile | null> {
        return this.authProfileRepository.findById(id)
    }

    /**
     * List auth profiles with optional filtering
     */
    async listAuthProfiles(
        filters: {
            projectId?: string
            method?: string
            enabled?: boolean
            tags?: string[]
            limit?: number
            offset?: number
        } = {}
    ): Promise<{
        profiles: AuthProfile[]
        total: number
    }> {
        const {
            projectId,
            method,
            enabled,
            tags,
            limit = 20,
            offset = 0,
        } = filters

        // Build where clause
        const where: any = {}

        if (projectId) {
            where.projectId = projectId
        }

        if (method) {
            where.method = method
        }

        if (enabled !== undefined) {
            where.enabled = enabled
        }

        if (tags && tags.length > 0) {
            // For SQLite JSON queries, we need to check if any of the provided tags exist
            where.tags = {
                path: '$',
                array_contains: tags[0], // Simplified - in real implementation might need more complex logic
            }
        }

        const profiles = await this.authProfileRepository.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        })

        // Get total count for pagination
        const total = await this.authProfileRepository.countByProject(
            projectId || ''
        )

        return { profiles, total }
    }

    /**
     * Get auth profiles for a specific project
     */
    async getAuthProfilesByProject(
        projectId: string,
        options?: {
            enabled?: boolean
            method?: string
            limit?: number
            offset?: number
        }
    ): Promise<AuthProfile[]> {
        const { enabled, method, limit, offset } = options || {}

        if (enabled !== undefined && enabled) {
            if (method) {
                return this.authProfileRepository.findByMethod(
                    projectId,
                    method
                )
            }
            return this.authProfileRepository.findEnabledByProject(projectId)
        }

        const queryOptions: any = {}
        if (limit) queryOptions.take = limit
        if (offset) queryOptions.skip = offset

        return this.authProfileRepository.findByProject(projectId, queryOptions)
    }

    /**
     * Update auth profile
     */
    async updateAuthProfile(
        id: string,
        data: AuthProfileUpdateInput
    ): Promise<AuthProfile> {
        // Check if profile exists
        const existing = await this.authProfileRepository.findById(id)
        if (!existing) {
            throw new Error(`Auth profile with ID "${id}" not found`)
        }

        // Check if name conflict exists (if name is being updated)
        if (
            data.name &&
            typeof data.name === 'string' &&
            data.name !== existing.name
        ) {
            const exists = await this.authProfileRepository.existsByName(
                existing.projectId,
                data.name,
                id
            )
            if (exists) {
                throw new Error(
                    `Auth profile with name "${data.name}" already exists in this project`
                )
            }
        }

        return this.authProfileRepository.update(id, data)
    }

    /**
     * Delete auth profile
     */
    async deleteAuthProfile(id: string): Promise<void> {
        // Check if profile exists
        const existing = await this.authProfileRepository.findById(id)
        if (!existing) {
            throw new Error(`Auth profile with ID "${id}" not found`)
        }

        await this.authProfileRepository.delete(id)
    }

    /**
     * Toggle auth profile enabled status
     */
    async toggleAuthProfile(id: string): Promise<AuthProfile> {
        const existing = await this.authProfileRepository.findById(id)
        if (!existing) {
            throw new Error(`Auth profile with ID "${id}" not found`)
        }

        return this.authProfileRepository.update(id, {
            enabled: !existing.enabled,
        })
    }

    /**
     * Duplicate an auth profile
     */
    async duplicateAuthProfile(
        id: string,
        newName?: string
    ): Promise<AuthProfile> {
        const existing = await this.authProfileRepository.findById(id)
        if (!existing) {
            throw new Error(`Auth profile with ID "${id}" not found`)
        }

        const name = newName || `${existing.name} (Copy)`

        // Check if the new name already exists
        const exists = await this.authProfileRepository.existsByName(
            existing.projectId,
            name
        )
        if (exists) {
            throw new Error(
                `Auth profile with name "${name}" already exists in this project`
            )
        }

        // Create duplicate with new name
        return this.authProfileRepository.create({
            name,
            description: existing.description,
            method: existing.method,
            authConfig: existing.authConfig as any,
            conditions: existing.conditions as any,
            priority: existing.priority,
            enabled: false, // Start disabled by default
            tags: existing.tags as any,
            project: {
                connect: { id: existing.projectId },
            },
        })
    }

    /**
     * Get auth profiles count by project
     */
    async getAuthProfilesCount(projectId: string): Promise<number> {
        return this.authProfileRepository.countByProject(projectId)
    }

    /**
     * Validate auth profile configuration
     */
    validateAuthProfile(data: any): { valid: boolean; errors: string[] } {
        const errors: string[] = []

        if (!data.name || data.name.trim().length === 0) {
            errors.push('Name is required')
        }

        if (!data.method) {
            errors.push('Authentication method is required')
        }

        if (!data.authConfig) {
            errors.push('Authentication configuration is required')
        } else {
            // Validate auth config based on method
            switch (data.method) {
                case 'bearer':
                    if (!data.authConfig.token) {
                        errors.push('Bearer token is required')
                    }
                    break
                case 'api-key':
                    if (!data.authConfig.key) {
                        errors.push('API key is required')
                    }
                    if (!data.authConfig.placement) {
                        errors.push('API key placement is required')
                    }
                    break
                case 'basic':
                    if (!data.authConfig.username) {
                        errors.push('Username is required for basic auth')
                    }
                    if (!data.authConfig.password) {
                        errors.push('Password is required for basic auth')
                    }
                    break
                // Add more validation as needed
            }
        }

        if (
            data.priority !== undefined &&
            (data.priority < 0 || data.priority > 1000)
        ) {
            errors.push('Priority must be between 0 and 1000')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }
}
