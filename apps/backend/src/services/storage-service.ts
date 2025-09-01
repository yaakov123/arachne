import type { TransactionCompleteEvent } from '@arachne/api-types'
import type {
    AuthMethodConfig,
    BearerAuthConfig,
    BasicAuthConfig,
    ApiKeyAuthConfig,
    JwtAuthConfig,
    CustomHeaderAuthConfig,
    AuthValueSource,
    AuthProfile,
} from '@arachne/database'
import { TransactionService } from './transaction-service'
import { AuthProfileRepository } from '@arachne/database'

export class StorageService {
    private authProfileRepository: AuthProfileRepository =
        new AuthProfileRepository()

    constructor(private transactionService: TransactionService) {}

    async handleTransactionComplete(
        projectId: string,
        event: TransactionCompleteEvent
    ) {
        try {
            return this.transactionService.addTransaction(projectId, event)
        } catch (error) {
            // Log error with more context but don't throw to prevent disrupting the event flow
            console.error(
                `Failed to store transaction ${event.id} for project ${projectId}:`,
                error
            )
        }
    }

    /**
     * Create a new auth profile from extracted authentication data
     */
    async createAuthProfile(
        projectId: string,
        method: string,
        config: AuthMethodConfig,
        options: {
            name?: string
            description?: string
            confidence?: number
            url?: string
        } = {}
    ): Promise<AuthProfile> {
        const name =
            options.name || this.generateAuthProfileName(method, options.url)
        const description =
            options.description ||
            this.generateAuthProfileDescription(method, config, options.url)

        return this.authProfileRepository.create({
            name,
            description,
            method,
            authConfig: JSON.parse(JSON.stringify(config)), // Serialize for JSON field
            enabled: true,
            priority: Math.round((options.confidence || 0.5) * 100), // Convert confidence to priority
            tags: ['auto-extracted'],
            createdBy: 'auth-extracter-plugin',
            project: {
                connect: { id: projectId },
            },
        })
    }

    /**
     * Check if an identical auth profile already exists (same method, placement, and values)
     */
    async findIdenticalAuthProfile(
        projectId: string,
        method: string,
        config: AuthMethodConfig
    ): Promise<AuthProfile | null> {
        const profiles = await this.authProfileRepository.findByMethod(
            projectId,
            method
        )

        // Check for exact match including values
        for (const profile of profiles) {
            if (
                this.authConfigsAreIdentical(
                    profile.authConfig as unknown as AuthMethodConfig,
                    config
                )
            ) {
                return profile
            }
        }

        return null
    }

    /**
     * Check if a similar auth profile exists (same method and placement, but potentially different values)
     */
    async findSimilarAuthProfile(
        projectId: string,
        method: string,
        config: AuthMethodConfig
    ): Promise<AuthProfile | null> {
        const profiles = await this.authProfileRepository.findByMethod(
            projectId,
            method
        )

        // Check for similar structure (method + placement) but different values
        for (const profile of profiles) {
            if (
                this.authConfigsAreSimilar(
                    profile.authConfig as unknown as AuthMethodConfig,
                    config
                )
            ) {
                return profile
            }
        }

        return null
    }

    /**
     * Get all auth profiles for a project
     */
    async getAuthProfiles(projectId: string): Promise<AuthProfile[]> {
        return this.authProfileRepository.findByProject(projectId)
    }

    private generateAuthProfileName(method: string, url?: string): string {
        const hostname = url ? new URL(url).hostname : 'unknown'
        const timestamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        return `${method}-${hostname}-${timestamp}`
    }

    private generateAuthProfileDescription(
        method: string,
        _config: AuthMethodConfig,
        url?: string
    ): string {
        const hostname = url ? new URL(url).hostname : 'unknown host'

        switch (method) {
            case 'bearer':
                return `Bearer token authentication detected on ${hostname}`
            case 'basic':
                return `Basic authentication detected on ${hostname}`
            case 'api-key':
                return `API key authentication detected on ${hostname}`
            case 'jwt':
                return `JWT token authentication detected on ${hostname}`
            case 'custom-header':
                return `Custom header authentication detected on ${hostname}`
            default:
                return `${method} authentication detected on ${hostname}`
        }
    }

    /**
     * Check if two auth configs are identical (same method, placement, and values)
     */
    private authConfigsAreIdentical(
        config1: AuthMethodConfig,
        config2: AuthMethodConfig
    ): boolean {
        // Must have same method
        if (config1.method !== config2.method) return false

        // Deep comparison based on method type
        switch (config1.method) {
            case 'bearer':
                return this.compareBearerConfigs(
                    config1 as BearerAuthConfig,
                    config2 as BearerAuthConfig
                )
            case 'basic':
                return this.compareBasicConfigs(
                    config1 as BasicAuthConfig,
                    config2 as BasicAuthConfig
                )
            case 'api-key':
                return this.compareApiKeyConfigs(
                    config1 as ApiKeyAuthConfig,
                    config2 as ApiKeyAuthConfig
                )
            case 'jwt':
                return this.compareJwtConfigs(
                    config1 as JwtAuthConfig,
                    config2 as JwtAuthConfig
                )
            case 'custom-header':
                return this.compareCustomHeaderConfigs(
                    config1 as CustomHeaderAuthConfig,
                    config2 as CustomHeaderAuthConfig
                )
            default:
                // For other methods, do a simple JSON comparison
                return JSON.stringify(config1) === JSON.stringify(config2)
        }
    }

    /**
     * Check if two auth configs are similar (same method and placement, but values may differ)
     */
    private authConfigsAreSimilar(
        config1: AuthMethodConfig,
        config2: AuthMethodConfig
    ): boolean {
        // Basic similarity check - same method and similar placement
        if (config1.method !== config2.method) return false

        // Use type-safe comparison functions
        switch (config1.method) {
            case 'bearer':
                return this.isBearerSimilar(
                    config1 as BearerAuthConfig,
                    config2 as BearerAuthConfig
                )
            case 'basic':
                return this.isBasicSimilar(
                    config1 as BasicAuthConfig,
                    config2 as BasicAuthConfig
                )
            case 'api-key':
                return this.isApiKeySimilar(
                    config1,
                    config2 as ApiKeyAuthConfig
                )
            case 'jwt':
                return this.isJwtSimilar(
                    config1 as JwtAuthConfig,
                    config2 as JwtAuthConfig
                )
            case 'custom-header':
                return this.isCustomHeaderSimilar(
                    config1 as CustomHeaderAuthConfig,
                    config2 as CustomHeaderAuthConfig
                )
            default:
                // For other methods, they're similar if they're the same method
                return true
        }
    }

    /**
     * Compare two Bearer auth configs for identical values
     */
    private compareBearerConfigs(
        config1: BearerAuthConfig,
        config2: BearerAuthConfig
    ): boolean {
        return (
            this.getStaticValue(config1.token) ===
            this.getStaticValue(config2.token)
        )
    }

    /**
     * Compare two Basic auth configs for identical values
     */
    private compareBasicConfigs(
        config1: BasicAuthConfig,
        config2: BasicAuthConfig
    ): boolean {
        return (
            this.getStaticValue(config1.username) ===
                this.getStaticValue(config2.username) &&
            this.getStaticValue(config1.password) ===
                this.getStaticValue(config2.password)
        )
    }

    /**
     * Compare two API key auth configs for identical values and placement
     */
    private compareApiKeyConfigs(
        config1: ApiKeyAuthConfig,
        config2: ApiKeyAuthConfig
    ): boolean {
        return (
            this.getStaticValue(config1.key) ===
                this.getStaticValue(config2.key) &&
            config1.placement.type === config2.placement.type &&
            this.comparePlacementNames(config1.placement, config2.placement)
        )
    }

    /**
     * Compare two JWT auth configs for identical values and placement
     */
    private compareJwtConfigs(
        config1: JwtAuthConfig,
        config2: JwtAuthConfig
    ): boolean {
        return (
            this.getStaticValue(config1.token) ===
                this.getStaticValue(config2.token) &&
            config1.placement.type === config2.placement.type &&
            this.comparePlacementNames(config1.placement, config2.placement)
        )
    }

    /**
     * Compare two Custom header auth configs for identical values and placement
     */
    private compareCustomHeaderConfigs(
        config1: CustomHeaderAuthConfig,
        config2: CustomHeaderAuthConfig
    ): boolean {
        return (
            this.getStaticValue(config1.value) ===
                this.getStaticValue(config2.value) &&
            config1.placement.name === config2.placement.name
        )
    }

    /**
     * Helper to get static value from AuthValueSource
     */
    private getStaticValue(source: AuthValueSource): string | null {
        if (source.type === 'static') {
            return source.value
        }
        // For non-static sources, we can't compare values directly
        return null
    }

    /**
     * Helper to compare placement names across different placement types
     */
    private comparePlacementNames(placement1: any, placement2: any): boolean {
        // Handle different placement types
        if (placement1.type !== placement2.type) return false

        switch (placement1.type) {
            case 'header':
            case 'query':
            case 'body-form':
                return placement1.name === placement2.name
            case 'body-json':
                return placement1.path === placement2.path
            case 'url-path':
                return (
                    placement1.template === placement2.template &&
                    placement1.placeholder === placement2.placeholder
                )
            case 'cookie':
                return placement1.name === placement2.name
            default:
                return true
        }
    }

    /**
     * Check if two Bearer auth configs have similar structure (same method)
     */
    private isBearerSimilar(
        _config1: BearerAuthConfig,
        _config2: BearerAuthConfig
    ): boolean {
        // Bearer tokens always use Authorization header, so they're similar by method
        return true
    }

    /**
     * Check if two Basic auth configs have similar structure (same method)
     */
    private isBasicSimilar(
        _config1: BasicAuthConfig,
        _config2: BasicAuthConfig
    ): boolean {
        // Basic auth always uses Authorization header, so they're similar by method
        return true
    }

    /**
     * Check if two API key auth configs have similar structure (same placement)
     */
    private isApiKeySimilar(
        config1: ApiKeyAuthConfig,
        config2: ApiKeyAuthConfig
    ): boolean {
        return (
            config1.placement.type === config2.placement.type &&
            this.comparePlacementNames(config1.placement, config2.placement)
        )
    }

    /**
     * Check if two JWT auth configs have similar structure (same placement)
     */
    private isJwtSimilar(
        config1: JwtAuthConfig,
        config2: JwtAuthConfig
    ): boolean {
        return (
            config1.placement.type === config2.placement.type &&
            this.comparePlacementNames(config1.placement, config2.placement)
        )
    }

    /**
     * Check if two Custom header auth configs have similar structure (same header)
     */
    private isCustomHeaderSimilar(
        config1: CustomHeaderAuthConfig,
        config2: CustomHeaderAuthConfig
    ): boolean {
        return config1.placement.name === config2.placement.name
    }
}
