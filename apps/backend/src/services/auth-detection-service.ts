import type {
    AuthMethodConfig,
    BearerAuthConfig,
    ApiKeyAuthConfig,
    BasicAuthConfig,
    CustomHeaderAuthConfig,
    HeaderAuthPlacement,
    QueryAuthPlacement,
} from '@arachne/database'
import type { DetectedAuthMethod } from '@arachne/api-types'

/**
 * Unified input format for auth detection
 */
export interface AuthDetectionInput {
    /** Request headers in key-value format */
    headers: Record<string, string | string[]>
    /** URL object with search params */
    url: URL
    /** Display headers format (for API inventory compatibility) */
    displayHeaders?: Array<{ name: string; value: string }>
    /** Query string (alternative to URL.search) */
    queryString?: string
}

/**
 * Extended auth result for plugin use (includes full config)
 */
export interface ExtractedAuth {
    method: string
    config: AuthMethodConfig
    placement?: any
    value?: string
    confidence: number // 0-1, how confident we are this is auth
}

/**
 * Shared service for detecting authentication methods from HTTP requests
 */
export class AuthDetectionService {
    /**
     * Detect authentication methods for API inventory (simplified format)
     */
    detectAuthMethods(input: AuthDetectionInput): DetectedAuthMethod[] {
        const extracted = this.extractAuthFromRequest(input)

        // Convert to DetectedAuthMethod format
        const detected = extracted.map((auth) => ({
            method: auth.method as DetectedAuthMethod['method'],
            placement: this.getPlacementFromConfig(auth.config),
            fieldName: this.getFieldNameFromConfig(auth.config),
            confidence: auth.confidence,
            exampleValue: this.sanitizeAuthValue(auth.value || ''),
            config: auth.config,
        }))

        // Deduplicate by fieldName and placement, keeping highest confidence
        return this.deduplicateAuthMethods(detected)
    }

    /**
     * Extract full authentication details for plugin use
     */
    extractAuthFromRequest(input: AuthDetectionInput): ExtractedAuth[] {
        const extracted: ExtractedAuth[] = []

        // Extract Bearer tokens
        const bearerAuth = this.extractBearerAuth(input.headers)
        if (bearerAuth) extracted.push(bearerAuth)

        // Extract Basic auth
        const basicAuth = this.extractBasicAuth(input.headers)
        if (basicAuth) extracted.push(basicAuth)

        // Extract API keys from headers
        const headerApiKeys = this.extractHeaderApiKeys(input.headers)
        extracted.push(...headerApiKeys)

        // Extract API keys from query parameters
        const queryApiKeys = this.extractQueryApiKeys(
            input.url,
            input.queryString
        )
        extracted.push(...queryApiKeys)

        // Extract JWT tokens (if not already caught by Bearer)
        const jwtTokens = this.extractJwtTokens(input.headers, input.url)
        extracted.push(...jwtTokens)

        // Extract custom auth headers
        const customHeaders = this.extractCustomAuthHeaders(input.headers)
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

    private extractQueryApiKeys(
        url: URL,
        queryString?: string
    ): ExtractedAuth[] {
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

        // Use URL.searchParams if available, otherwise parse queryString
        let searchParams: URLSearchParams
        if (url.searchParams && url.searchParams.size > 0) {
            searchParams = url.searchParams
        } else if (queryString) {
            searchParams = new URLSearchParams(queryString)
        } else {
            return extracted
        }

        for (const [paramName, paramValue] of searchParams.entries()) {
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

    private sanitizeAuthValue(value: string): string {
        const parts = value.split(' ')
        if (parts.length === 2) {
            return `${parts[0]} [REDACTED]`
        }
        return '[REDACTED]'
    }

    private getPlacementFromConfig(
        config: AuthMethodConfig
    ): DetectedAuthMethod['placement'] {
        if ('placement' in config && config.placement) {
            const placementType = config.placement.type
            // Map the detailed placement types to the simplified DetectedAuthMethod placement types
            switch (placementType) {
                case 'header':
                    return 'header'
                case 'query':
                    return 'query'
                case 'cookie':
                    return 'cookie'
                case 'body-form':
                case 'body-json':
                case 'body-raw':
                    return 'body'
                case 'url-path':
                    return 'query' // Treat URL path params as query-like
                default:
                    return 'header'
            }
        }
        return 'header' // Default fallback
    }

    private getFieldNameFromConfig(config: AuthMethodConfig): string {
        if ('placement' in config && config.placement) {
            // Try to get the name field from the placement config
            const placement = config.placement as any
            if (placement.name) {
                return placement.name
            }
            if (placement.key) {
                return placement.key
            }
            if (placement.field) {
                return placement.field
            }
            return placement.type
        }
        if (config.method === 'bearer' || config.method === 'basic') {
            return 'authorization'
        }
        return config.method
    }

    /**
     * Deduplicate authentication methods by field name and placement,
     * keeping the method with the highest confidence
     */
    private deduplicateAuthMethods(
        methods: DetectedAuthMethod[]
    ): DetectedAuthMethod[] {
        const methodMap = new Map<string, DetectedAuthMethod>()

        for (const method of methods) {
            const key = `${method.placement}:${method.fieldName}`
            const existing = methodMap.get(key)

            if (!existing || method.confidence > existing.confidence) {
                methodMap.set(key, method)
            }
        }

        // Return methods sorted by confidence (highest first)
        return Array.from(methodMap.values()).sort(
            (a, b) => b.confidence - a.confidence
        )
    }
}
