<template>
    <div class="oauth2-auth-config">
        <AuthValueSourceInput
            v-model="config.accessToken"
            label="Access Token *"
            placeholder="Enter access token or configure source"
            :error="errors?.accessToken"
            @update:model-value="updateConfig"
        />

        <AuthValueSourceInput
            v-model="config.refreshToken"
            label="Refresh Token"
            placeholder="Enter refresh token or configure source"
            :error="errors?.refreshToken"
            @update:model-value="updateConfig"
        />

        <AuthPlacementInput
            v-model="config.placement"
            label="Token Placement *"
            :error="errors?.placement"
            @update:model-value="updateConfig"
        />

        <!-- OAuth2 Options -->
        <div class="oauth2-options">
            <h5 class="options-title">OAuth 2.0 Options</h5>
            <div class="options-grid">
                <div class="form-group">
                    <label class="form-label">Token Type</label>
                    <select
                        v-model="tokenType"
                        class="form-select"
                        @change="updateOptions"
                    >
                        <option value="bearer">Bearer</option>
                        <option value="mac">MAC</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Scope</label>
                    <input
                        v-model="oauthOptions.scope"
                        type="text"
                        class="form-input"
                        placeholder="read write"
                        @input="updateOptions"
                    />
                    <small class="form-help"
                        >Space-separated list of scopes</small
                    >
                </div>

                <div class="form-group">
                    <label class="form-label">Token Endpoint</label>
                    <input
                        v-model="oauthOptions.tokenEndpoint"
                        type="url"
                        class="form-input"
                        placeholder="https://auth.example.com/oauth/token"
                        @input="updateOptions"
                    />
                    <small class="form-help">URL for token refresh</small>
                </div>

                <div class="form-group">
                    <label class="form-label">Expires At</label>
                    <input
                        v-model.number="oauthOptions.expiresAt"
                        type="number"
                        class="form-input"
                        placeholder="1640995200"
                        @input="updateOptions"
                    />
                    <small class="form-help"
                        >Unix timestamp when token expires</small
                    >
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { OAuth2AuthConfig } from '@arachne/database'
import type {
    OAuth2AuthConfigProps,
    OAuth2AuthConfigEmits,
} from '@/types/auth-components'
import {
    validateAuthValueSource,
    validateAuthPlacement,
} from '@/types/auth-components'
import AuthValueSourceInput from '../AuthValueSourceInput.vue'
import AuthPlacementInput from '../AuthPlacementInput.vue'

// Props
const props = withDefaults(defineProps<OAuth2AuthConfigProps>(), {
    errors: () => ({}),
})

// Emits
const emit = defineEmits<OAuth2AuthConfigEmits>()

// Local state for OAuth2 options
const tokenType = ref<'bearer' | 'mac'>('bearer')
const oauthOptions = ref({
    scope: '',
    expiresAt: undefined as number | undefined,
    tokenEndpoint: '',
})

// Computed
const config = computed({
    get: () => props.modelValue,
    set: (value: OAuth2AuthConfig) => emit('update:modelValue', value),
})

// Initialize options from config
watch(
    () => props.modelValue,
    (newConfig) => {
        tokenType.value = newConfig.tokenType || 'bearer'
        if (newConfig.options) {
            oauthOptions.value = {
                scope: newConfig.options.scope || '',
                expiresAt: newConfig.options.expiresAt,
                tokenEndpoint: newConfig.options.tokenEndpoint || '',
            }
        }
    },
    { immediate: true }
)

// Methods
const updateConfig = () => {
    emit('update:modelValue', config.value)
}

const updateOptions = () => {
    const hasOptions =
        oauthOptions.value.scope ||
        oauthOptions.value.expiresAt ||
        oauthOptions.value.tokenEndpoint

    const updatedConfig: OAuth2AuthConfig = {
        ...config.value,
        tokenType: tokenType.value,
        options: hasOptions
            ? {
                  scope: oauthOptions.value.scope || undefined,
                  expiresAt: oauthOptions.value.expiresAt,
                  tokenEndpoint: oauthOptions.value.tokenEndpoint || undefined,
              }
            : undefined,
    }

    emit('update:modelValue', updatedConfig)
}

// Validation
const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    const accessTokenError = validateAuthValueSource(
        config.value.accessToken,
        'Access Token'
    )
    if (accessTokenError) {
        errors.accessToken = accessTokenError
    }

    if (config.value.refreshToken) {
        const refreshTokenError = validateAuthValueSource(
            config.value.refreshToken,
            'Refresh Token'
        )
        if (refreshTokenError) {
            errors.refreshToken = refreshTokenError
        }
    }

    const placementError = validateAuthPlacement(
        config.value.placement,
        'Placement'
    )
    if (placementError) {
        errors.placement = placementError
    }

    return errors
}

// Expose validation method
defineExpose({
    validate,
})
</script>

<style scoped>
.oauth2-auth-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.oauth2-options {
    padding: var(--space-lg);
    background: var(--surface-section);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-border);
}

.options-title {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-lg) 0;
}

.options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-lg);
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.form-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

.form-input,
.form-select {
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
}

.form-input:focus,
.form-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-help {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
}

@media (max-width: 768px) {
    .options-grid {
        grid-template-columns: 1fr;
    }
}
</style>
