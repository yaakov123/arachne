export type { AppRouter } from '@arachne/backend'

// Re-export auth profile types for convenience
export type {
    AuthMethod,
    AuthPlacement,
    AuthPlacementConfig,
    HeaderAuthPlacement,
    QueryAuthPlacement,
    FormAuthPlacement,
    JsonAuthPlacement,
    RawBodyAuthPlacement,
    PathAuthPlacement,
    CookieAuthPlacement,
    AuthValueSource,
    AuthMethodConfig,
    BasicAuthConfig,
    BearerAuthConfig,
    ApiKeyAuthConfig,
    JwtAuthConfig,
    OAuth2AuthConfig,
    CustomHeaderAuthConfig,
    CustomAuthConfig,
    AuthCondition,
    AuthProfile,
} from '@arachne/database'
