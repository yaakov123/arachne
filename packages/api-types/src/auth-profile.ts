/**
 * Authentication Profile Types
 *
 * Defines a declarative format for specifying where authentication data
 * should be placed in HTTP requests. This allows users to configure
 * authentication strategies that can be automatically applied to requests.
 */

/**
 * Supported authentication methods
 */
export type AuthMethod =
    | 'bearer' // Bearer token in Authorization header
    | 'api-key' // API key in header, query, or body
    | 'basic' // Basic auth (username:password base64 encoded)
    | 'digest' // Digest authentication
    | 'oauth1' // OAuth 1.0a signature
    | 'oauth2' // OAuth 2.0 token
    | 'jwt' // JWT token (can be in various locations)
    | 'custom-header' // Custom header with arbitrary value
    | 'custom' // Fully custom auth strategy

/**
 * Where authentication data can be placed in a request
 */
export type AuthPlacement =
    | 'header' // HTTP header
    | 'query' // URL query parameter
    | 'body-form' // Form data in request body
    | 'body-json' // JSON field in request body
    | 'body-raw' // Raw body content
    | 'url-path' // Part of the URL path
    | 'cookie' // HTTP cookie

/**
 * Header-specific auth placement configuration
 */
export interface HeaderAuthPlacement {
    type: 'header'
    /** Header name (e.g., 'Authorization', 'X-API-Key') */
    name: string
    /** Optional prefix for the value (e.g., 'Bearer ', 'Token ') */
    prefix?: string
    /** Optional suffix for the value */
    suffix?: string
    /** Whether to encode the value (base64, url, etc.) */
    encoding?: 'base64' | 'url' | 'none'
}

/**
 * Query parameter auth placement configuration
 */
export interface QueryAuthPlacement {
    type: 'query'
    /** Query parameter name (e.g., 'api_key', 'token') */
    name: string
    /** Whether to encode the value */
    encoding?: 'url' | 'none'
}

/**
 * Form data auth placement configuration
 */
export interface FormAuthPlacement {
    type: 'body-form'
    /** Form field name */
    name: string
    /** Whether to encode the value */
    encoding?: 'url' | 'none'
}

/**
 * JSON body auth placement configuration
 */
export interface JsonAuthPlacement {
    type: 'body-json'
    /** JSON path to the field (e.g., 'auth.token', 'credentials.apiKey') */
    path: string
    /** Whether to merge with existing JSON or replace entire body */
    merge?: boolean
}

/**
 * Raw body auth placement configuration
 */
export interface RawBodyAuthPlacement {
    type: 'body-raw'
    /** Content type to set for the body */
    contentType?: string
    /** Whether to encode the value */
    encoding?: 'base64' | 'none'
}

/**
 * URL path auth placement configuration
 */
export interface PathAuthPlacement {
    type: 'url-path'
    /** Path template with placeholder (e.g., '/api/{token}/users') */
    template: string
    /** Placeholder name in the template */
    placeholder: string
}

/**
 * Cookie auth placement configuration
 */
export interface CookieAuthPlacement {
    type: 'cookie'
    /** Cookie name */
    name: string
    /** Cookie options */
    options?: {
        domain?: string
        path?: string
        secure?: boolean
        httpOnly?: boolean
        sameSite?: 'strict' | 'lax' | 'none'
    }
}

/**
 * Union type for all auth placement configurations
 */
export type AuthPlacementConfig =
    | HeaderAuthPlacement
    | QueryAuthPlacement
    | FormAuthPlacement
    | JsonAuthPlacement
    | RawBodyAuthPlacement
    | PathAuthPlacement
    | CookieAuthPlacement

/**
 * Auth value source - where the actual auth data comes from
 */
export type AuthValueSource =
    | { type: 'static'; value: string } // Static value
    | { type: 'environment'; variable: string } // Environment variable
    | { type: 'prompt'; message?: string } // Prompt user at runtime
    | { type: 'file'; path: string; encoding?: 'utf8' | 'base64' } // Read from file
    | { type: 'computed'; expression: string } // Computed value (e.g., timestamp, nonce)
    | { type: 'derived'; sourceField: string; transform?: string } // Derived from another field

/**
 * Conditional auth application rules
 */
export interface AuthCondition {
    /** Only apply auth if URL matches pattern */
    urlPattern?: string | RegExp
    /** Only apply auth if host matches */
    hostPattern?: string | RegExp
    /** Only apply auth if method matches */
    methods?: string[]
    /** Only apply auth if header is present/absent */
    headerConditions?: {
        name: string
        exists?: boolean
        value?: string | RegExp
    }[]
    /** Only apply auth if query param is present/absent */
    queryConditions?: {
        name: string
        exists?: boolean
        value?: string | RegExp
    }[]
}

/**
 * Basic authentication configuration
 */
export interface BasicAuthConfig {
    method: 'basic'
    username: AuthValueSource
    password: AuthValueSource
}

/**
 * Bearer token authentication configuration
 */
export interface BearerAuthConfig {
    method: 'bearer'
    token: AuthValueSource
}

/**
 * API key authentication configuration
 */
export interface ApiKeyAuthConfig {
    method: 'api-key'
    key: AuthValueSource
    placement: AuthPlacementConfig
}

/**
 * JWT authentication configuration
 */
export interface JwtAuthConfig {
    method: 'jwt'
    token: AuthValueSource
    placement: AuthPlacementConfig
    /** JWT validation options */
    validation?: {
        algorithm?: string
        issuer?: string
        audience?: string
        expirationCheck?: boolean
    }
}

/**
 * OAuth 2.0 authentication configuration
 */
export interface OAuth2AuthConfig {
    method: 'oauth2'
    tokenType?: 'bearer' | 'mac'
    accessToken: AuthValueSource
    refreshToken?: AuthValueSource
    placement: AuthPlacementConfig
    /** OAuth 2.0 specific options */
    options?: {
        scope?: string
        expiresAt?: number
        tokenEndpoint?: string
    }
}

/**
 * Custom header authentication configuration
 */
export interface CustomHeaderAuthConfig {
    method: 'custom-header'
    placement: HeaderAuthPlacement
    value: AuthValueSource
}

/**
 * Fully custom authentication configuration
 */
export interface CustomAuthConfig {
    method: 'custom'
    placements: AuthPlacementConfig[]
    values: Record<string, AuthValueSource>
    /** Custom logic for applying auth (JavaScript expression) */
    applyLogic?: string
}

/**
 * Union type for all auth method configurations
 */
export type AuthMethodConfig =
    | BasicAuthConfig
    | BearerAuthConfig
    | ApiKeyAuthConfig
    | JwtAuthConfig
    | OAuth2AuthConfig
    | CustomHeaderAuthConfig
    | CustomAuthConfig

/**
 * Complete authentication profile
 */
export interface AuthProfile {
    /** Unique identifier for the profile */
    id: string
    /** Human-readable name */
    name: string
    /** Optional description */
    description?: string
    /** Authentication method and configuration */
    auth: AuthMethodConfig
    /** Conditions for when to apply this auth */
    conditions?: AuthCondition
    /** Priority when multiple profiles match (higher = more priority) */
    priority?: number
    /** Whether this profile is enabled */
    enabled?: boolean
    /** Tags for organization */
    tags?: string[]
    /** Creation and modification timestamps */
    metadata?: {
        createdAt?: string
        updatedAt?: string
        createdBy?: string
    }
}

/**
 * Auth profile collection/workspace
 */
export interface AuthProfileCollection {
    /** Collection metadata */
    name: string
    description?: string
    version?: string
    /** List of auth profiles */
    profiles: AuthProfile[]
    /** Global settings */
    settings?: {
        /** Default auth profile to use */
        defaultProfile?: string
        /** Whether to auto-apply matching profiles */
        autoApply?: boolean
        /** Maximum number of profiles to apply per request */
        maxProfilesPerRequest?: number
    }
}

/**
 * Runtime auth application result
 */
export interface AuthApplicationResult {
    /** Applied profile ID */
    profileId: string
    /** Profile name */
    profileName: string
    /** Success status */
    success: boolean
    /** Error message if failed */
    error?: string
    /** Applied modifications */
    modifications?: {
        headers?: Record<string, string>
        queryParams?: Record<string, string>
        bodyChanges?: any
        urlChanges?: string
    }
}

/**
 * Auth profile validation result
 */
export interface AuthProfileValidation {
    /** Whether the profile is valid */
    valid: boolean
    /** Validation errors */
    errors: Array<{
        field: string
        message: string
        code: string
    }>
    /** Validation warnings */
    warnings: Array<{
        field: string
        message: string
        code: string
    }>
}

/**
 * Utility types for working with auth profiles
 */

/** Extract auth method from auth config */
export type ExtractAuthMethod<T extends AuthMethodConfig> = T['method']

/** Get placement types for a specific auth method */
export type AuthMethodPlacements<T extends AuthMethod> = T extends 'bearer'
    ? HeaderAuthPlacement
    : T extends 'basic'
    ? HeaderAuthPlacement
    : T extends 'api-key' | 'jwt' | 'oauth2' | 'custom-header'
    ? AuthPlacementConfig
    : T extends 'custom'
    ? AuthPlacementConfig[]
    : never

/** Type guard functions */
export function isHeaderPlacement(
    placement: AuthPlacementConfig
): placement is HeaderAuthPlacement {
    return placement.type === 'header'
}

export function isQueryPlacement(
    placement: AuthPlacementConfig
): placement is QueryAuthPlacement {
    return placement.type === 'query'
}

export function isJsonPlacement(
    placement: AuthPlacementConfig
): placement is JsonAuthPlacement {
    return placement.type === 'body-json'
}

export function isBearerAuth(
    config: AuthMethodConfig
): config is BearerAuthConfig {
    return config.method === 'bearer'
}

export function isApiKeyAuth(
    config: AuthMethodConfig
): config is ApiKeyAuthConfig {
    return config.method === 'api-key'
}

export function isCustomAuth(
    config: AuthMethodConfig
): config is CustomAuthConfig {
    return config.method === 'custom'
}
