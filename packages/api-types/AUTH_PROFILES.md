# Authentication Profiles

Authentication Profiles provide a declarative way to specify where and how authentication data should be placed in HTTP requests. This system allows users to configure authentication strategies that can be automatically applied to requests based on conditions like URL patterns, hosts, or headers.

## Core Concepts

### Auth Profile

An auth profile is a complete configuration that defines:

-   **What** authentication method to use (Bearer token, API key, Basic auth, etc.)
-   **Where** to place the authentication data (headers, query params, body, etc.)
-   **When** to apply the authentication (URL patterns, host matching, etc.)
-   **How** to obtain the authentication values (static, environment variables, prompts, etc.)

### Auth Method

The type of authentication being used:

-   `bearer` - Bearer token in Authorization header
-   `api-key` - API key that can be placed anywhere
-   `basic` - Username/password basic authentication
-   `jwt` - JWT tokens with validation options
-   `oauth2` - OAuth 2.0 tokens
-   `custom-header` - Simple custom header authentication
-   `custom` - Fully customizable multi-placement authentication

### Auth Placement

Where the authentication data goes in the request:

-   `header` - HTTP headers (e.g., Authorization, X-API-Key)
-   `query` - URL query parameters
-   `body-form` - Form data in request body
-   `body-json` - JSON fields in request body
-   `body-raw` - Raw body content
-   `url-path` - Part of the URL path
-   `cookie` - HTTP cookies

### Auth Value Source

How to obtain the actual authentication values:

-   `static` - Hard-coded values
-   `environment` - Environment variables
-   `prompt` - Prompt the user at runtime
-   `file` - Read from a file
-   `computed` - Computed values (timestamps, signatures, etc.)
-   `derived` - Values derived from other fields

## Examples

### Simple Bearer Token

```typescript
const bearerProfile: AuthProfile = {
    id: 'api-bearer',
    name: 'API Bearer Token',
    auth: {
        method: 'bearer',
        token: {
            type: 'environment',
            variable: 'API_TOKEN',
        },
    },
    conditions: {
        hostPattern: 'api.example.com',
    },
}
```

### API Key in Header

```typescript
const apiKeyProfile: AuthProfile = {
    id: 'api-key-header',
    name: 'API Key Header',
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
    },
}
```

### API Key in Query Parameter

```typescript
const queryApiKeyProfile: AuthProfile = {
    id: 'query-api-key',
    name: 'Query API Key',
    auth: {
        method: 'api-key',
        key: {
            type: 'static',
            value: 'your-key-here',
        },
        placement: {
            type: 'query',
            name: 'apikey',
        },
    },
}
```

### Complex Multi-Part Authentication

```typescript
const complexProfile: AuthProfile = {
    id: 'complex-auth',
    name: 'Complex Authentication',
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
        ],
        values: {
            apiKey: { type: 'environment', variable: 'API_KEY' },
            timestamp: {
                type: 'computed',
                expression: 'Date.now().toString()',
            },
            signature: {
                type: 'computed',
                expression: 'hmacSha256(apiKey + timestamp)',
            },
        },
    },
}
```

## Conditional Application

Auth profiles can be conditionally applied based on:

-   **URL patterns** - Only apply to specific endpoints
-   **Host patterns** - Only apply to specific domains
-   **HTTP methods** - Only apply to certain methods
-   **Header conditions** - Apply based on existing headers
-   **Query conditions** - Apply based on query parameters

Example:

```typescript
const conditionalProfile: AuthProfile = {
    // ... other config
    conditions: {
        urlPattern: 'https://api.example.com/v1/*',
        hostPattern: 'api.example.com',
        methods: ['GET', 'POST'],
        headerConditions: [
            {
                name: 'Content-Type',
                value: /^application\/json/,
            },
        ],
    },
}
```

## Profile Collections

Multiple auth profiles can be organized into collections:

```typescript
const authCollection: AuthProfileCollection = {
    name: 'My API Profiles',
    profiles: [bearerProfile, apiKeyProfile, complexProfile],
    settings: {
        defaultProfile: 'api-bearer',
        autoApply: true,
        maxProfilesPerRequest: 1,
    },
}
```

## Integration Points

These types are designed to integrate with:

1. **Proxy System** - Automatically apply auth to intercepted requests
2. **Request Builder** - Manual application of auth profiles
3. **Test Runners** - Authentication for automated testing
4. **API Exploration** - Dynamic auth configuration for API discovery
5. **Configuration UI** - Visual auth profile management

## Type Safety

The type system provides:

-   **Compile-time validation** of auth profile structures
-   **Type guards** for runtime type checking
-   **Utility types** for extracting specific configurations
-   **IntelliSense support** for IDE autocompletion

## Security Considerations

-   Sensitive values should use `environment` or `prompt` sources
-   Avoid `static` values for secrets in production
-   Use `file` sources with proper file permissions
-   Consider encryption for stored auth profiles
-   Validate computed expressions to prevent code injection
