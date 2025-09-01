// Auth configuration components
export { default as BearerAuthConfig } from './BearerAuthConfig.vue'
export { default as ApiKeyAuthConfig } from './ApiKeyAuthConfig.vue'
export { default as BasicAuthConfig } from './BasicAuthConfig.vue'
export { default as JwtAuthConfig } from './JwtAuthConfig.vue'
export { default as OAuth2AuthConfig } from './OAuth2AuthConfig.vue'
export { default as CustomHeaderAuthConfig } from './CustomHeaderAuthConfig.vue'
export { default as CustomAuthConfig } from './CustomAuthConfig.vue'

// Auth component types
export type {
    BaseAuthConfigProps,
    BaseAuthConfigEmits,
    BearerAuthConfigProps,
    BearerAuthConfigEmits,
    ApiKeyAuthConfigProps,
    ApiKeyAuthConfigEmits,
    BasicAuthConfigProps,
    BasicAuthConfigEmits,
    JwtAuthConfigProps,
    JwtAuthConfigEmits,
    OAuth2AuthConfigProps,
    OAuth2AuthConfigEmits,
    CustomHeaderAuthConfigProps,
    CustomHeaderAuthConfigEmits,
    CustomAuthConfigProps,
    CustomAuthConfigEmits,
} from '@/types/auth-components'

// Auth utility functions
export {
    validateAuthValueSource,
    validateAuthPlacement,
    createDefaultBearerConfig,
    createDefaultApiKeyConfig,
    createDefaultBasicConfig,
    createDefaultJwtConfig,
    createDefaultOAuth2Config,
    createDefaultCustomHeaderConfig,
    createDefaultCustomConfig,
} from '@/types/auth-components'
