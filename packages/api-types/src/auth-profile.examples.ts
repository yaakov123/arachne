/**
 * Auth Profile Examples
 *
 * This file demonstrates how to use the auth profile types
 * to create various authentication configurations.
 */

import type {
    AuthProfile,
    AuthProfileCollection,
    BearerAuthConfig,
    ApiKeyAuthConfig,
    BasicAuthConfig,
    JwtAuthConfig,
    CustomAuthConfig,
} from './auth-profile'

/**
 * Example 1: Simple Bearer Token Authentication
 * Places a bearer token in the Authorization header
 */
export const bearerTokenProfile: AuthProfile = {
    id: 'bearer-api-token',
    name: 'API Bearer Token',
    description: 'Standard bearer token authentication for API access',
    auth: {
        method: 'bearer',
        token: {
            type: 'environment',
            variable: 'API_TOKEN',
        },
    } satisfies BearerAuthConfig,
    conditions: {
        hostPattern: 'api.example.com',
    },
    enabled: true,
    tags: ['api', 'production'],
}

/**
 * Example 2: API Key in Header
 * Places an API key in a custom header
 */
export const apiKeyHeaderProfile: AuthProfile = {
    id: 'api-key-header',
    name: 'API Key Header',
    description: 'API key authentication via X-API-Key header',
    auth: {
        method: 'api-key',
        key: {
            type: 'environment',
            variable: 'API_KEY',
        },
        placement: {
            type: 'header',
            name: 'X-API-Key',
        },
    } satisfies ApiKeyAuthConfig,
    conditions: {
        urlPattern: 'https://api.service.com/v1/*',
    },
    priority: 100,
    enabled: true,
}

/**
 * Example 3: API Key in Query Parameter
 * Places an API key as a query parameter
 */
export const apiKeyQueryProfile: AuthProfile = {
    id: 'api-key-query',
    name: 'API Key Query',
    description: 'API key authentication via query parameter',
    auth: {
        method: 'api-key',
        key: {
            type: 'static',
            value: 'your-api-key-here',
        },
        placement: {
            type: 'query',
            name: 'apikey',
        },
    } satisfies ApiKeyAuthConfig,
    conditions: {
        hostPattern: 'legacy-api.example.com',
    },
    enabled: true,
}

/**
 * Example 4: Basic Authentication
 * Username and password in Authorization header
 */
export const basicAuthProfile: AuthProfile = {
    id: 'basic-auth',
    name: 'Basic Authentication',
    description: 'Username/password basic authentication',
    auth: {
        method: 'basic',
        username: {
            type: 'environment',
            variable: 'AUTH_USERNAME',
        },
        password: {
            type: 'environment',
            variable: 'AUTH_PASSWORD',
        },
    } satisfies BasicAuthConfig,
    conditions: {
        hostPattern: 'secure.internal.com',
        methods: ['GET', 'POST'],
    },
    enabled: true,
}

/**
 * Example 5: JWT Token in Custom Header
 * JWT token placed in a custom header location
 */
export const jwtCustomHeaderProfile: AuthProfile = {
    id: 'jwt-custom-header',
    name: 'JWT Custom Header',
    description: 'JWT authentication via custom X-Auth-Token header',
    auth: {
        method: 'jwt',
        token: {
            type: 'file',
            path: './jwt-token.txt',
            encoding: 'utf8',
        },
        placement: {
            type: 'header',
            name: 'X-Auth-Token',
            prefix: 'JWT ',
        },
        validation: {
            algorithm: 'HS256',
            expirationCheck: true,
        },
    } satisfies JwtAuthConfig,
    conditions: {
        urlPattern: 'https://microservice.internal/*',
    },
    enabled: true,
}

/**
 * Example 6: Complex Custom Authentication
 * Multiple auth values placed in different locations
 */
export const complexCustomProfile: AuthProfile = {
    id: 'complex-custom-auth',
    name: 'Complex Custom Auth',
    description: 'Multi-part authentication with timestamp and signature',
    auth: {
        method: 'custom',
        placements: [
            {
                type: 'header',
                name: 'X-API-Key',
            },
            {
                type: 'header',
                name: 'X-Timestamp',
            },
            {
                type: 'header',
                name: 'X-Signature',
            },
            {
                type: 'query',
                name: 'version',
            },
        ],
        values: {
            apiKey: {
                type: 'environment',
                variable: 'COMPLEX_API_KEY',
            },
            timestamp: {
                type: 'computed',
                expression: 'Date.now().toString()',
            },
            signature: {
                type: 'computed',
                expression: 'hmacSha256(apiKey + timestamp + requestBody)',
            },
            version: {
                type: 'static',
                value: 'v2',
            },
        },
    } satisfies CustomAuthConfig,
    conditions: {
        hostPattern: 'complex-api.example.com',
        headerConditions: [
            {
                name: 'Content-Type',
                value: /^application\/json/,
            },
        ],
    },
    priority: 200,
    enabled: true,
}

/**
 * Example 7: API Key in JSON Body
 * Places API key as a field in JSON request body
 */
export const apiKeyJsonBodyProfile: AuthProfile = {
    id: 'api-key-json-body',
    name: 'API Key in JSON Body',
    description: 'API key authentication embedded in JSON request body',
    auth: {
        method: 'api-key',
        key: {
            type: 'prompt',
            message: 'Enter your API key:',
        },
        placement: {
            type: 'body-json',
            path: 'auth.apiKey',
            merge: true,
        },
    } satisfies ApiKeyAuthConfig,
    conditions: {
        methods: ['POST', 'PUT', 'PATCH'],
        headerConditions: [
            {
                name: 'Content-Type',
                value: 'application/json',
            },
        ],
    },
    enabled: true,
}

/**
 * Example Collection: Complete auth profile workspace
 */
export const exampleAuthCollection: AuthProfileCollection = {
    name: 'My API Authentication Profiles',
    description: 'Collection of authentication profiles for various APIs',
    version: '1.0.0',
    profiles: [
        bearerTokenProfile,
        apiKeyHeaderProfile,
        apiKeyQueryProfile,
        basicAuthProfile,
        jwtCustomHeaderProfile,
        complexCustomProfile,
        apiKeyJsonBodyProfile,
    ],
    settings: {
        defaultProfile: 'bearer-api-token',
        autoApply: true,
        maxProfilesPerRequest: 1,
    },
}
