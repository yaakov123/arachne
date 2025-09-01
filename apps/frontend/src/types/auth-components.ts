import type {
    BearerAuthConfig,
    ApiKeyAuthConfig,
    BasicAuthConfig,
    JwtAuthConfig,
    OAuth2AuthConfig,
    CustomHeaderAuthConfig,
    CustomAuthConfig,
    AuthValueSource,
    AuthPlacementConfig,
} from '@arachne/database'

/**
 * Base interface for all auth configuration components
 */
export interface BaseAuthConfigProps {
    /** Current configuration value */
    modelValue: any
    /** Validation errors for specific fields */
    errors?: Record<string, string>
}

/**
 * Base interface for auth configuration component emits
 */
export interface BaseAuthConfigEmits {
    'update:modelValue': [value: any]
}

/**
 * Bearer token auth component props
 */
export interface BearerAuthConfigProps extends BaseAuthConfigProps {
    modelValue: BearerAuthConfig
}

export interface BearerAuthConfigEmits extends BaseAuthConfigEmits {
    'update:modelValue': [value: BearerAuthConfig]
}

/**
 * API Key auth component props
 */
export interface ApiKeyAuthConfigProps extends BaseAuthConfigProps {
    modelValue: ApiKeyAuthConfig
}

export interface ApiKeyAuthConfigEmits extends BaseAuthConfigEmits {
    'update:modelValue': [value: ApiKeyAuthConfig]
}

/**
 * Basic auth component props
 */
export interface BasicAuthConfigProps extends BaseAuthConfigProps {
    modelValue: BasicAuthConfig
}

export interface BasicAuthConfigEmits extends BaseAuthConfigEmits {
    'update:modelValue': [value: BasicAuthConfig]
}

/**
 * JWT auth component props
 */
export interface JwtAuthConfigProps extends BaseAuthConfigProps {
    modelValue: JwtAuthConfig
}

export interface JwtAuthConfigEmits extends BaseAuthConfigEmits {
    'update:modelValue': [value: JwtAuthConfig]
}

/**
 * OAuth2 auth component props
 */
export interface OAuth2AuthConfigProps extends BaseAuthConfigProps {
    modelValue: OAuth2AuthConfig
}

export interface OAuth2AuthConfigEmits extends BaseAuthConfigEmits {
    'update:modelValue': [value: OAuth2AuthConfig]
}

/**
 * Custom Header auth component props
 */
export interface CustomHeaderAuthConfigProps extends BaseAuthConfigProps {
    modelValue: CustomHeaderAuthConfig
}

export interface CustomHeaderAuthConfigEmits extends BaseAuthConfigEmits {
    'update:modelValue': [value: CustomHeaderAuthConfig]
}

/**
 * Custom auth component props
 */
export interface CustomAuthConfigProps extends BaseAuthConfigProps {
    modelValue: CustomAuthConfig
}

export interface CustomAuthConfigEmits extends BaseAuthConfigEmits {
    'update:modelValue': [value: CustomAuthConfig]
}

/**
 * Validation utility functions
 */
export const validateAuthValueSource = (
    source: AuthValueSource,
    fieldName: string
): string | undefined => {
    switch (source.type) {
        case 'static':
            return !source.value ? `${fieldName} value is required` : undefined
        case 'environment':
            return !source.variable
                ? `${fieldName} environment variable is required`
                : undefined
        case 'file':
            return !source.path
                ? `${fieldName} file path is required`
                : undefined
        default:
            return undefined
    }
}

export const validateAuthPlacement = (
    placement: AuthPlacementConfig,
    fieldName: string
): string | undefined => {
    switch (placement.type) {
        case 'header':
            return !placement.name
                ? `${fieldName} header name is required`
                : undefined
        case 'query':
            return !placement.name
                ? `${fieldName} query parameter name is required`
                : undefined
        case 'body-form':
            return !placement.name
                ? `${fieldName} form field name is required`
                : undefined
        case 'body-json':
            return !placement.path
                ? `${fieldName} JSON path is required`
                : undefined
        case 'url-path':
            return !placement.template || !placement.placeholder
                ? `${fieldName} template and placeholder are required`
                : undefined
        case 'cookie':
            return !placement.name
                ? `${fieldName} cookie name is required`
                : undefined
        default:
            return undefined
    }
}

/**
 * Default value factories
 */
export const createDefaultBearerConfig = (): BearerAuthConfig => ({
    method: 'bearer',
    token: { type: 'static', value: '' },
})

export const createDefaultApiKeyConfig = (): ApiKeyAuthConfig => ({
    method: 'api-key',
    key: { type: 'static', value: '' },
    placement: { type: 'header', name: 'X-API-Key' },
})

export const createDefaultBasicConfig = (): BasicAuthConfig => ({
    method: 'basic',
    username: { type: 'static', value: '' },
    password: { type: 'static', value: '' },
})

export const createDefaultJwtConfig = (): JwtAuthConfig => ({
    method: 'jwt',
    token: { type: 'static', value: '' },
    placement: {
        type: 'header',
        name: 'Authorization',
        prefix: 'Bearer ',
    },
})

export const createDefaultOAuth2Config = (): OAuth2AuthConfig => ({
    method: 'oauth2',
    accessToken: { type: 'static', value: '' },
    placement: {
        type: 'header',
        name: 'Authorization',
        prefix: 'Bearer ',
    },
})

export const createDefaultCustomHeaderConfig = (): CustomHeaderAuthConfig => ({
    method: 'custom-header',
    value: { type: 'static', value: '' },
    placement: { type: 'header', name: '', prefix: '' },
})

export const createDefaultCustomConfig = (): CustomAuthConfig => ({
    method: 'custom',
    placements: [],
    values: {},
})
