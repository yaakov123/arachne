import { AfterRequestContext, ProxyPlugin } from '@arachne/proxy'
import { StorageService } from '../services/storage-service'
import { ProjectService } from '../services/project-service'
import {
    AuthDetectionService,
    type ExtractedAuth,
} from '../services/auth-detection-service'
import { logger } from '../logger'

export class AuthExtracterPlugin implements ProxyPlugin {
    readonly name = 'auth-extracter'
    private readonly authDetectionService: AuthDetectionService

    constructor(
        private storageService: StorageService,
        private projectService: ProjectService
    ) {
        this.authDetectionService = new AuthDetectionService()
    }

    async afterRequest(ctx: AfterRequestContext): Promise<void> {
        logger.info('After request', { id: ctx.id })
        try {
            const projectId = this.projectService.getCurrentProjectId()
            if (!projectId) {
                // No active project, skip auth extraction
                return
            }

            const extractedAuths =
                this.authDetectionService.extractAuthFromRequest({
                    headers: ctx.finalHeaders,
                    url: ctx.finalUrl,
                })

            // Only process if we found potential auth patterns
            if (extractedAuths.length > 0) {
                logger.info(
                    `[AuthExtracter] Found ${extractedAuths.length} potential auth patterns for project ${projectId}`
                )

                // Process each extracted auth pattern
                for (const auth of extractedAuths) {
                    await this.processExtractedAuth(
                        projectId,
                        auth,
                        ctx.finalUrl.toString()
                    )
                }
            }
        } catch (error) {
            logger.error('[AuthExtracter] Error extracting auth:', error)
        }
    }

    private async processExtractedAuth(
        projectId: string,
        auth: ExtractedAuth,
        url: string
    ): Promise<void> {
        try {
            // First check if an identical auth profile already exists (same values)
            const identicalProfile =
                await this.storageService.findIdenticalAuthProfile(
                    projectId,
                    auth.method,
                    auth.config
                )

            if (identicalProfile) {
                logger.info(
                    `[AuthExtracter] Identical ${auth.method} profile already exists: ${identicalProfile.name}`
                )
                return
            }

            // Check if a similar profile exists (same method/placement, different values)
            const similarProfile =
                await this.storageService.findSimilarAuthProfile(
                    projectId,
                    auth.method,
                    auth.config
                )

            // Only auto-create profiles with high confidence
            if (auth.confidence >= 0.8) {
                const profileOptions: any = {
                    confidence: auth.confidence,
                    url,
                }

                // If similar profile exists, create a more descriptive name
                if (similarProfile) {
                    profileOptions.name = this.generateVariantProfileName(
                        auth.method,
                        url,
                        similarProfile.name
                    )
                    profileOptions.description =
                        this.generateVariantProfileDescription(
                            auth.method,
                            url,
                            similarProfile.name
                        )
                }

                const profile = await this.storageService.createAuthProfile(
                    projectId,
                    auth.method,
                    auth.config,
                    profileOptions
                )

                if (similarProfile) {
                    logger.info(
                        `[AuthExtracter] Created variant auth profile: ${profile.name} (similar to ${similarProfile.name}, confidence: ${auth.confidence})`
                    )
                } else {
                    logger.info(
                        `[AuthExtracter] Created new auth profile: ${profile.name} (confidence: ${auth.confidence})`
                    )
                }
            } else {
                const similarText = similarProfile
                    ? ` (similar to ${similarProfile.name})`
                    : ''
                logger.info(
                    `[AuthExtracter] Found potential ${auth.method} auth${similarText} but confidence too low (${auth.confidence}) - skipping auto-creation`
                )
            }
        } catch (error) {
            logger.error(
                `[AuthExtracter] Error processing ${auth.method} auth:`,
                error
            )
        }
    }

    private generateVariantProfileName(
        method: string,
        url: string,
        _existingName: string
    ): string {
        const hostname = new URL(url).hostname
        const timestamp = new Date()
            .toISOString()
            .slice(11, 19)
            .replace(/:/g, '') // HHMMSS
        const shortValue = this.getShortValueIdentifier(method)
        return `${method}-${hostname}-${shortValue}-${timestamp}`
    }

    private generateVariantProfileDescription(
        method: string,
        url: string,
        existingName: string
    ): string {
        const hostname = new URL(url).hostname
        return `${method} authentication variant detected on ${hostname} (different credentials from ${existingName})`
    }

    private getShortValueIdentifier(method: string): string {
        // Generate a short identifier to help distinguish between different credential values
        const randomId = Math.random().toString(36).substring(2, 6)
        return `${method.substring(0, 3)}${randomId}`
    }
}
