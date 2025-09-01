# Auth Configuration Components

This directory contains modular, type-safe components for different authentication methods in the auth profile form.

## Components

### `BearerAuthConfig.vue`

Configuration component for Bearer token authentication.

-   **Props**: `modelValue: BearerAuthConfig`, `errors?: Record<string, string>`
-   **Emits**: `update:modelValue`
-   **Features**: Token value source configuration

### `ApiKeyAuthConfig.vue`

Configuration component for API key authentication.

-   **Props**: `modelValue: ApiKeyAuthConfig`, `errors?: Record<string, string>`
-   **Emits**: `update:modelValue`
-   **Features**: API key value source + placement configuration

### `BasicAuthConfig.vue`

Configuration component for basic authentication (username/password).

-   **Props**: `modelValue: BasicAuthConfig`, `errors?: Record<string, string>`
-   **Emits**: `update:modelValue`
-   **Features**: Username and password value source configuration

### `JwtAuthConfig.vue`

Configuration component for JWT authentication.

-   **Props**: `modelValue: JwtAuthConfig`, `errors?: Record<string, string>`
-   **Emits**: `update:modelValue`
-   **Features**: JWT token value source + placement + validation options (algorithm, issuer, audience, expiration check)

### `OAuth2AuthConfig.vue`

Configuration component for OAuth 2.0 authentication.

-   **Props**: `modelValue: OAuth2AuthConfig`, `errors?: Record<string, string>`
-   **Emits**: `update:modelValue`
-   **Features**: Access token + refresh token value sources + placement + OAuth options (scope, expires, token endpoint)

### `CustomHeaderAuthConfig.vue`

Configuration component for custom header authentication.

-   **Props**: `modelValue: CustomHeaderAuthConfig`, `errors?: Record<string, string>`
-   **Emits**: `update:modelValue`
-   **Features**: Header value source + header configuration (name, prefix, suffix, encoding)

### `CustomAuthConfig.vue`

Configuration component for fully custom authentication strategies.

-   **Props**: `modelValue: CustomAuthConfig`, `errors?: Record<string, string>`
-   **Emits**: `update:modelValue`
-   **Features**: Multiple placement strategies + value sources + custom apply logic + JSON editor

## Usage

```vue
<template>
    <BearerAuthConfig v-model="authConfig" :errors="validationErrors" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BearerAuthConfig, createDefaultBearerConfig } from '@/components/auth'

const authConfig = ref(createDefaultBearerConfig())
const validationErrors = ref({})
</script>
```

## Validation

Each component exposes a `validate()` method that returns validation errors:

```ts
const authConfigRef = ref<InstanceType<typeof BearerAuthConfig>>()

// Validate the component
const errors = authConfigRef.value?.validate() || {}
```

## Types

All components are fully type-safe and use the auth configuration types from `@arachne/database`:

-   `BearerAuthConfig`
-   `ApiKeyAuthConfig`
-   `BasicAuthConfig`
-   `JwtAuthConfig`
-   `OAuth2AuthConfig`
-   `CustomHeaderAuthConfig`
-   `CustomAuthConfig`

## Design Benefits

1. **Modularity**: Each auth method has its own focused component
2. **Type Safety**: Full TypeScript support with proper type inference
3. **Reusability**: Components can be used independently or within forms
4. **Validation**: Built-in validation with consistent error handling
5. **Maintainability**: Easier to modify individual auth methods without affecting others
6. **Testing**: Each component can be tested in isolation
