<template>
    <div class="jwt-auth-config">
        <AuthValueSourceInput
            v-model="config.token"
            label="JWT Token *"
            placeholder="Enter JWT token or configure source"
            :error="errors?.token"
            @update:model-value="updateConfig"
        />

        <AuthPlacementInput
            v-model="config.placement"
            label="Token Placement *"
            :error="errors?.placement"
            @update:model-value="updateConfig"
        />

        <!-- JWT Validation Options -->
        <div class="jwt-validation">
            <h5 class="validation-title">JWT Validation Options</h5>
            <div class="validation-grid">
                <div class="form-group">
                    <label class="form-label">Algorithm</label>
                    <input
                        v-model="validationOptions.algorithm"
                        type="text"
                        class="form-input"
                        placeholder="HS256, RS256, etc."
                        @input="updateValidation"
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">Issuer</label>
                    <input
                        v-model="validationOptions.issuer"
                        type="text"
                        class="form-input"
                        placeholder="https://issuer.example.com"
                        @input="updateValidation"
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">Audience</label>
                    <input
                        v-model="validationOptions.audience"
                        type="text"
                        class="form-input"
                        placeholder="my-api"
                        @input="updateValidation"
                    />
                </div>

                <div class="form-group">
                    <div class="form-toggle">
                        <input
                            id="jwt-expiration-check"
                            v-model="validationOptions.expirationCheck"
                            type="checkbox"
                            class="toggle-input"
                            @change="updateValidation"
                        />
                        <label for="jwt-expiration-check" class="toggle-label">
                            <span class="toggle-switch"></span>
                            <span class="toggle-text">Check Expiration</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { JwtAuthConfig } from '@arachne/database'
import type {
    JwtAuthConfigProps,
    JwtAuthConfigEmits,
} from '@/types/auth-components'
import {
    validateAuthValueSource,
    validateAuthPlacement,
} from '@/types/auth-components'
import AuthValueSourceInput from '../AuthValueSourceInput.vue'
import AuthPlacementInput from '../AuthPlacementInput.vue'

// Props
const props = withDefaults(defineProps<JwtAuthConfigProps>(), {
    errors: () => ({}),
})

// Emits
const emit = defineEmits<JwtAuthConfigEmits>()

// Local state for validation options
const validationOptions = ref({
    algorithm: '',
    issuer: '',
    audience: '',
    expirationCheck: false,
})

// Computed
const config = computed({
    get: () => props.modelValue,
    set: (value: JwtAuthConfig) => emit('update:modelValue', value),
})

// Initialize validation options from config
watch(
    () => props.modelValue.validation,
    (validation) => {
        if (validation) {
            validationOptions.value = {
                algorithm: validation.algorithm || '',
                issuer: validation.issuer || '',
                audience: validation.audience || '',
                expirationCheck: validation.expirationCheck || false,
            }
        }
    },
    { immediate: true }
)

// Methods
const updateConfig = () => {
    emit('update:modelValue', config.value)
}

const updateValidation = () => {
    const hasValidationOptions =
        validationOptions.value.algorithm ||
        validationOptions.value.issuer ||
        validationOptions.value.audience ||
        validationOptions.value.expirationCheck

    const updatedConfig: JwtAuthConfig = {
        ...config.value,
        validation: hasValidationOptions
            ? {
                  algorithm: validationOptions.value.algorithm || undefined,
                  issuer: validationOptions.value.issuer || undefined,
                  audience: validationOptions.value.audience || undefined,
                  expirationCheck:
                      validationOptions.value.expirationCheck || undefined,
              }
            : undefined,
    }

    emit('update:modelValue', updatedConfig)
}

// Validation
const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    const tokenError = validateAuthValueSource(config.value.token, 'JWT Token')
    if (tokenError) {
        errors.token = tokenError
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
.jwt-auth-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.jwt-validation {
    padding: var(--space-lg);
    background: var(--surface-section);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-border);
}

.validation-title {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-lg) 0;
}

.validation-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.form-input {
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
}

.form-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
}

.toggle-input {
    display: none;
}

.toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    cursor: pointer;
}

.toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--color-neutral-300);
    border-radius: var(--radius-full);
    transition: background-color var(--transition-fast);
}

.toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: var(--radius-full);
    transition: transform var(--transition-fast);
}

.toggle-input:checked + .toggle-label .toggle-switch {
    background: var(--primary-color);
}

.toggle-input:checked + .toggle-label .toggle-switch::after {
    transform: translateX(20px);
}

.toggle-text {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

@media (max-width: 768px) {
    .validation-grid {
        grid-template-columns: 1fr;
    }
}
</style>
