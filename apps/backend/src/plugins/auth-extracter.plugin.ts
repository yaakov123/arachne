import { AfterRequestContext, ProxyPlugin } from '@arachne/proxy'
import { StorageService } from '../services/storage-service'
import { ProjectService } from '../services/project-service'
import type {
    AuthMethodConfig,
    BearerAuthConfig,
    ApiKeyAuthConfig,
    BasicAuthConfig,
    CustomHeaderAuthConfig,
    HeaderAuthPlacement,
    QueryAuthPlacement,
} from '@arachne/database'
import { logger } from '../logger'

interface ExtractedAuth {
    method: string
    config: AuthMethodConfig
    placement?: any
    value?: string
    confidence: number // 0-1, how confident we are this is auth
}

export class AuthExtracterPlugin implements ProxyPlugin {
    readonly name = 'auth-extracter'

    constructor(
        private storageService: StorageService,
        private projectService: ProjectService
    ) {}

    async afterRequest(ctx: AfterRequestContext): Promise<void> {
        logger.info('After request', { id: ctx.id })
        try {
            const projectId = this.projectService.getCurrentProjectId()
            if (!projectId) {
                // No active project, skip auth extraction
                return
            }

            const extractedAuths = this.extractAuthFromRequest(ctx)

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

    private extractAuthFromRequest(ctx: AfterRequestContext): ExtractedAuth[] {
        const extracted: ExtractedAuth[] = []
        const headers = ctx.finalHeaders
        const url = ctx.finalUrl

        // Extract Bearer tokens
        const bearerAuth = this.extractBearerAuth(headers)
        if (bearerAuth) extracted.push(bearerAuth)

        // Extract Basic auth
        const basicAuth = this.extractBasicAuth(headers)
        if (basicAuth) extracted.push(basicAuth)

        // Extract API keys from headers
        const headerApiKeys = this.extractHeaderApiKeys(headers)
        extracted.push(...headerApiKeys)

        // Extract API keys from query parameters
        const queryApiKeys = this.extractQueryApiKeys(url)
        extracted.push(...queryApiKeys)

        // Extract JWT tokens (if not already caught by Bearer)
        const jwtTokens = this.extractJwtTokens(headers, url)
        extracted.push(...jwtTokens)

        // Extract custom auth headers
        const customHeaders = this.extractCustomAuthHeaders(headers)
        extracted.push(...customHeaders)

        return extracted
    }

    private extractBearerAuth(
        headers: Record<string, string | string[]>
    ): ExtractedAuth | null {
        const authHeader = this.getHeaderValue(headers, 'authorization')
        if (!authHeader) return null

        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
        if (!bearerMatch) return null

        const token = bearerMatch[1]

        return {
            method: 'bearer',
            config: {
                method: 'bearer',
                token: { type: 'static', value: token },
            } as BearerAuthConfig,
            value: token,
            confidence: 0.95, // High confidence for standard Bearer tokens
        }
    }

    private extractBasicAuth(
        headers: Record<string, string | string[]>
    ): ExtractedAuth | null {
        const authHeader = this.getHeaderValue(headers, 'authorization')
        if (!authHeader) return null

        const basicMatch = authHeader.match(/^Basic\s+(.+)$/i)
        if (!basicMatch) return null

        const encoded = basicMatch[1]
        try {
            const decoded = Buffer.from(encoded, 'base64').toString('utf8')
            const [username, password] = decoded.split(':', 2)

            if (username && password) {
                return {
                    method: 'basic',
                    config: {
                        method: 'basic',
                        username: { type: 'static', value: username },
                        password: { type: 'static', value: password },
                    } as BasicAuthConfig,
                    value: decoded,
                    confidence: 0.95, // High confidence for standard Basic auth
                }
            }
        } catch {
            // Invalid base64 or format
        }

        return null
    }

    private extractHeaderApiKeys(
        headers: Record<string, string | string[]>
    ): ExtractedAuth[] {
        const extracted: ExtractedAuth[] = []
        const apiKeyPatterns = [
            /^x-api-key$/i,
            /^api-key$/i,
            /^apikey$/i,
            /^x-auth-token$/i,
            /^auth-token$/i,
            /^token$/i,
            /^x-access-token$/i,
            /^access-token$/i,
            /^x-secret$/i,
            /^secret$/i,
            /^x-key$/i,
            /^key$/i,
        ]

        for (const [headerName, headerValue] of Object.entries(headers)) {
            const value = Array.isArray(headerValue)
                ? headerValue[0]
                : headerValue
            if (!value || typeof value !== 'string') continue

            // Check if header name matches API key patterns
            const isApiKeyHeader = apiKeyPatterns.some((pattern) =>
                pattern.test(headerName)
            )

            if (isApiKeyHeader) {
                const placement: HeaderAuthPlacement = {
                    type: 'header',
                    name: headerName,
                }

                extracted.push({
                    method: 'api-key',
                    config: {
                        method: 'api-key',
                        key: { type: 'static', value },
                        placement,
                    } as ApiKeyAuthConfig,
                    placement,
                    value,
                    confidence: 0.8, // Good confidence for recognized patterns
                })
            }
        }

        return extracted
    }

    private extractQueryApiKeys(url: URL): ExtractedAuth[] {
        const extracted: ExtractedAuth[] = []
        const apiKeyParams = [
            'api_key',
            'apikey',
            'key',
            'token',
            'access_token',
            'auth_token',
            'secret',
            'auth',
        ]

        for (const [paramName, paramValue] of url.searchParams.entries()) {
            if (apiKeyParams.includes(paramName.toLowerCase()) && paramValue) {
                const placement: QueryAuthPlacement = {
                    type: 'query',
                    name: paramName,
                }

                extracted.push({
                    method: 'api-key',
                    config: {
                        method: 'api-key',
                        key: { type: 'static', value: paramValue },
                        placement,
                    } as ApiKeyAuthConfig,
                    placement,
                    value: paramValue,
                    confidence: 0.7, // Moderate confidence for query params
                })
            }
        }

        return extracted
    }

    private extractJwtTokens(
        headers: Record<string, string | string[]>,
        url: URL
    ): ExtractedAuth[] {
        const extracted: ExtractedAuth[] = []

        // Check for JWT in non-standard headers
        const jwtHeaders = ['x-jwt-token', 'jwt', 'x-token', 'authorization']

        for (const headerName of jwtHeaders) {
            const value = this.getHeaderValue(headers, headerName)
            if (value && this.looksLikeJwt(value)) {
                const placement: HeaderAuthPlacement = {
                    type: 'header',
                    name: headerName,
                }

                extracted.push({
                    method: 'jwt',
                    config: {
                        method: 'jwt',
                        token: { type: 'static', value },
                        placement,
                    },
                    placement,
                    value,
                    confidence: 0.8,
                })
            }
        }

        // Check for JWT in query parameters
        for (const [paramName, paramValue] of url.searchParams.entries()) {
            if (
                paramName.toLowerCase().includes('jwt') &&
                this.looksLikeJwt(paramValue)
            ) {
                const placement: QueryAuthPlacement = {
                    type: 'query',
                    name: paramName,
                }

                extracted.push({
                    method: 'jwt',
                    config: {
                        method: 'jwt',
                        token: { type: 'static', value: paramValue },
                        placement,
                    },
                    placement,
                    value: paramValue,
                    confidence: 0.7,
                })
            }
        }

        return extracted
    }

    private extractCustomAuthHeaders(
        headers: Record<string, string | string[]>
    ): ExtractedAuth[] {
        const extracted: ExtractedAuth[] = []

        // Look for headers that might contain auth but aren't standard
        const suspiciousHeaders = [
            /^x-.*auth/i,
            /^x-.*token/i,
            /^x-.*key/i,
            /^x-.*secret/i,
            /^.*-auth$/i,
            /^.*-token$/i,
            /^.*-key$/i,
        ]

        for (const [headerName, headerValue] of Object.entries(headers)) {
            const value = Array.isArray(headerValue)
                ? headerValue[0]
                : headerValue
            if (!value || typeof value !== 'string') continue

            // Skip standard auth headers (already processed)
            if (headerName.toLowerCase() === 'authorization') continue

            const isSuspicious = suspiciousHeaders.some((pattern) =>
                pattern.test(headerName)
            )

            if (isSuspicious && value.length > 10) {
                // Arbitrary minimum length
                const placement: HeaderAuthPlacement = {
                    type: 'header',
                    name: headerName,
                }

                extracted.push({
                    method: 'custom-header',
                    config: {
                        method: 'custom-header',
                        placement,
                        value: { type: 'static', value },
                    } as CustomHeaderAuthConfig,
                    placement,
                    value,
                    confidence: 0.5, // Lower confidence for custom patterns
                })
            }
        }

        return extracted
    }

    private getHeaderValue(
        headers: Record<string, string | string[]>,
        name: string
    ): string | null {
        const value = headers[name] || headers[name.toLowerCase()]
        return Array.isArray(value) ? value[0] : value || null
    }

    private looksLikeJwt(value: string): boolean {
        // JWT tokens have 3 parts separated by dots
        const parts = value.split('.')
        if (parts.length !== 3) return false

        // Each part should be base64-like (no spaces, reasonable length)
        return parts.every(
            (part) =>
                part.length > 0 &&
                /^[A-Za-z0-9_-]+$/.test(part) &&
                part.length > 10
        )
    }
}
