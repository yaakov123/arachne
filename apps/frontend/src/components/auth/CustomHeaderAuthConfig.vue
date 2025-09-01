<template>
    <div class="custom-header-auth-config">
        <AuthValueSourceInput
            v-model="config.value"
            label="Header Value *"
            placeholder="Enter header value or configure source"
            :error="errors?.value"
            @update:model-value="updateConfig"
        />

        <div class="header-config">
            <h5 class="config-title">Header Configuration</h5>

            <div class="form-group">
                <label class="form-label">Header Name *</label>
                <input
                    v-model="headerName"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': errors?.headerName }"
                    placeholder="X-API-Key"
                    @input="updatePlacement"
                />
                <span v-if="errors?.headerName" class="form-error">
                    {{ errors.headerName }}
                </span>
            </div>

            <div class="form-group">
                <label class="form-label">Header Prefix</label>
                <input
                    v-model="headerPrefix"
                    type="text"
                    class="form-input"
                    placeholder="Bearer "
                    @input="updatePlacement"
                />
                <small class="form-help">
                    Optional prefix to add before the value (e.g., "Bearer ")
                </small>
            </div>

            <div class="form-group">
                <label class="form-label">Header Suffix</label>
                <input
                    v-model="headerSuffix"
                    type="text"
                    class="form-input"
                    placeholder=""
                    @input="updatePlacement"
                />
                <small class="form-help">
                    Optional suffix to add after the value
                </small>
            </div>

            <div class="form-group">
                <label class="form-label">Encoding</label>
                <select
                    v-model="headerEncoding"
                    class="form-select"
                    @change="updatePlacement"
                >
                    <option value="none">None</option>
                    <option value="base64">Base64</option>
                    <option value="url">URL Encoding</option>
                </select>
                <small class="form-help">
                    How to encode the header value
                </small>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CustomHeaderAuthConfig } from '@arachne/database'
import type {
    CustomHeaderAuthConfigProps,
    CustomHeaderAuthConfigEmits,
} from '@/types/auth-components'
import { validateAuthValueSource } from '@/types/auth-components'
import AuthValueSourceInput from '../AuthValueSourceInput.vue'

// Props
const props = withDefaults(defineProps<CustomHeaderAuthConfigProps>(), {
    errors: () => ({}),
})

// Emits
const emit = defineEmits<CustomHeaderAuthConfigEmits>()

// Local state for header configuration
const headerName = ref('')
const headerPrefix = ref('')
const headerSuffix = ref('')
const headerEncoding = ref<'base64' | 'url' | 'none'>('none')

// Computed
const config = computed({
    get: () => props.modelValue,
    set: (value: CustomHeaderAuthConfig) => emit('update:modelValue', value),
})

// Initialize header config from placement
watch(
    () => props.modelValue.placement,
    (placement) => {
        if (placement.type === 'header') {
            headerName.value = placement.name || ''
            headerPrefix.value = placement.prefix || ''
            headerSuffix.value = placement.suffix || ''
            headerEncoding.value = placement.encoding || 'none'
        }
    },
    { immediate: true }
)

// Methods
const updateConfig = () => {
    emit('update:modelValue', config.value)
}

const updatePlacement = () => {
    const updatedConfig: CustomHeaderAuthConfig = {
        ...config.value,
        placement: {
            type: 'header',
            name: headerName.value,
            prefix: headerPrefix.value || undefined,
            suffix: headerSuffix.value || undefined,
            encoding:
                headerEncoding.value !== 'none'
                    ? headerEncoding.value
                    : undefined,
        },
    }

    emit('update:modelValue', updatedConfig)
}

// Validation
const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    const valueError = validateAuthValueSource(
        config.value.value,
        'Header Value'
    )
    if (valueError) {
        errors.value = valueError
    }

    if (!headerName.value) {
        errors.headerName = 'Header name is required'
    }

    return errors
}

// Expose validation method
defineExpose({
    validate,
})
</script>

<style scoped>
.custom-header-auth-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.header-config {
    padding: var(--space-lg);
    background: var(--surface-section);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-border);
}

.config-title {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-lg) 0;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
}

.form-group:last-child {
    margin-bottom: 0;
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

.form-input-error {
    border-color: var(--color-error-500);
}

.form-input-error:focus {
    box-shadow: 0 0 0 3px var(--color-error-100);
}

.form-error {
    font-size: var(--text-xs);
    color: var(--color-error-600);
    font-weight: var(--font-medium);
}

.form-help {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
}
</style>
