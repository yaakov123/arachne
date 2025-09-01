<template>
    <div class="custom-auth-config">
        <div class="alert alert-info">
            <Info :size="16" />
            <span>
                Custom auth allows you to define multiple placement strategies
                and values. This is advanced functionality for complex
                authentication scenarios.
            </span>
        </div>

        <!-- Placements Section -->
        <div class="placements-section">
            <h5 class="section-title">Placement Strategies</h5>
            <div class="placements-list">
                <div
                    v-for="(placement, index) in config.placements"
                    :key="`placement-${index}`"
                    class="placement-item"
                >
                    <AuthPlacementInput
                        v-model="config.placements[index]"
                        :label="`Placement ${index + 1}`"
                        @update:model-value="updateConfig"
                    />
                    <button
                        type="button"
                        class="btn-remove"
                        @click="removePlacement(index)"
                    >
                        ×
                    </button>
                </div>
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="addPlacement"
                >
                    + Add Placement Strategy
                </button>
            </div>
        </div>

        <!-- Values Section -->
        <div class="values-section">
            <h5 class="section-title">Auth Values</h5>
            <div class="values-list">
                <div
                    v-for="(value, key) in config.values"
                    :key="`value-${key}`"
                    class="value-item"
                >
                    <div class="value-key">
                        <label class="form-label">Key</label>
                        <input
                            :value="key"
                            type="text"
                            class="form-input"
                            placeholder="value_key"
                            @input="(e) => updateValueKey(key, (e.target as HTMLInputElement).value)"
                        />
                    </div>
                    <div class="value-source">
                        <AuthValueSourceInput
                            v-model="config.values[key]"
                            :label="`Value for ${key}`"
                            @update:model-value="updateConfig"
                        />
                    </div>
                    <button
                        type="button"
                        class="btn-remove"
                        @click="removeValue(key)"
                    >
                        ×
                    </button>
                </div>
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="addValue"
                >
                    + Add Auth Value
                </button>
            </div>
        </div>

        <!-- Apply Logic Section -->
        <div class="apply-logic-section">
            <h5 class="section-title">Custom Apply Logic</h5>
            <div class="form-group">
                <label class="form-label">JavaScript Expression</label>
                <textarea
                    v-model="applyLogic"
                    class="form-textarea"
                    rows="6"
                    placeholder="// Custom logic for applying auth
// Available variables: request, values, placements
// Example:
// if (request.url.includes('/api/v2')) {
//   return placements[0]; // Use first placement for v2 API
// }
// return placements; // Use all placements"
                    @input="updateApplyLogic"
                />
                <small class="form-help">
                    Optional JavaScript expression to customize when and how
                    auth is applied
                </small>
            </div>
        </div>

        <!-- JSON Configuration View -->
        <div class="json-section">
            <h5 class="section-title">Configuration JSON</h5>
            <div class="form-group">
                <label class="form-label">Raw Configuration</label>
                <textarea
                    v-model="jsonConfig"
                    class="form-textarea"
                    rows="8"
                    placeholder='{"placements": [], "values": {}}'
                    @input="updateFromJson"
                />
                <small class="form-help">
                    Edit the raw JSON configuration directly (advanced users
                    only)
                </small>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Info } from 'lucide-vue-next'
import type {
    CustomAuthConfig,
    AuthPlacementConfig,
    AuthValueSource,
} from '@arachne/database'
import type {
    CustomAuthConfigProps,
    CustomAuthConfigEmits,
} from '@/types/auth-components'
import AuthValueSourceInput from '../AuthValueSourceInput.vue'
import AuthPlacementInput from '../AuthPlacementInput.vue'

// Props
const props = withDefaults(defineProps<CustomAuthConfigProps>(), {
    errors: () => ({}),
})

// Emits
const emit = defineEmits<CustomAuthConfigEmits>()

// Local state
const applyLogic = ref('')
const jsonConfig = ref('')

// Computed
const config = computed({
    get: () => props.modelValue,
    set: (value: CustomAuthConfig) => emit('update:modelValue', value),
})

// Initialize from config
watch(
    () => props.modelValue,
    (newConfig) => {
        applyLogic.value = newConfig.applyLogic || ''
        jsonConfig.value = JSON.stringify(
            {
                placements: newConfig.placements,
                values: newConfig.values,
                applyLogic: newConfig.applyLogic,
            },
            null,
            2
        )
    },
    { immediate: true }
)

// Methods
const updateConfig = () => {
    emit('update:modelValue', config.value)
    updateJsonConfig()
}

const updateJsonConfig = () => {
    jsonConfig.value = JSON.stringify(
        {
            placements: config.value.placements,
            values: config.value.values,
            applyLogic: config.value.applyLogic,
        },
        null,
        2
    )
}

const updateApplyLogic = () => {
    const updatedConfig: CustomAuthConfig = {
        ...config.value,
        applyLogic: applyLogic.value || undefined,
    }
    emit('update:modelValue', updatedConfig)
    updateJsonConfig()
}

const updateFromJson = () => {
    try {
        const parsed = JSON.parse(jsonConfig.value)
        const updatedConfig: CustomAuthConfig = {
            method: 'custom',
            placements: parsed.placements || [],
            values: parsed.values || {},
            applyLogic: parsed.applyLogic || undefined,
        }
        emit('update:modelValue', updatedConfig)
        applyLogic.value = parsed.applyLogic || ''
    } catch (e) {
        // Invalid JSON, ignore
    }
}

const addPlacement = () => {
    const newPlacement: AuthPlacementConfig = {
        type: 'header',
        name: '',
    }
    const updatedConfig = {
        ...config.value,
        placements: [...config.value.placements, newPlacement],
    }
    emit('update:modelValue', updatedConfig)
    updateJsonConfig()
}

const removePlacement = (index: number) => {
    const updatedConfig = {
        ...config.value,
        placements: config.value.placements.filter((_, i) => i !== index),
    }
    emit('update:modelValue', updatedConfig)
    updateJsonConfig()
}

const addValue = () => {
    const newKey = `value_${Object.keys(config.value.values).length + 1}`
    const newValue: AuthValueSource = { type: 'static', value: '' }
    const updatedConfig = {
        ...config.value,
        values: {
            ...config.value.values,
            [newKey]: newValue,
        },
    }
    emit('update:modelValue', updatedConfig)
    updateJsonConfig()
}

const removeValue = (key: string) => {
    const { [key]: removed, ...restValues } = config.value.values
    const updatedConfig = {
        ...config.value,
        values: restValues,
    }
    emit('update:modelValue', updatedConfig)
    updateJsonConfig()
}

const updateValueKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !newKey) return

    const value = config.value.values[oldKey]
    const { [oldKey]: removed, ...restValues } = config.value.values
    const updatedConfig = {
        ...config.value,
        values: {
            ...restValues,
            [newKey]: value,
        },
    }
    emit('update:modelValue', updatedConfig)
    updateJsonConfig()
}

// Validation
const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (config.value.placements.length === 0) {
        errors.placements = 'At least one placement strategy is required'
    }

    if (Object.keys(config.value.values).length === 0) {
        errors.values = 'At least one auth value is required'
    }

    // Validate JSON syntax if custom logic is provided
    if (jsonConfig.value) {
        try {
            JSON.parse(jsonConfig.value)
        } catch (e) {
            errors.json = 'Invalid JSON configuration'
        }
    }

    return errors
}

// Expose validation method
defineExpose({
    validate,
})
</script>

<style scoped>
.custom-auth-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
}

.alert {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-lg);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
}

.alert-info {
    background: var(--color-info-50);
    color: var(--color-info-700);
    border: 1px solid var(--color-info-200);
}

.placements-section,
.values-section,
.apply-logic-section,
.json-section {
    padding: var(--space-lg);
    background: var(--surface-section);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-border);
}

.section-title {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-lg) 0;
}

.placements-list,
.values-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.placement-item,
.value-item {
    display: flex;
    gap: var(--space-lg);
    align-items: flex-start;
    padding: var(--space-lg);
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
}

.placement-item > :first-child,
.value-item .value-source {
    flex: 1;
}

.value-item {
    align-items: flex-end;
}

.value-key {
    flex: 0 0 200px;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
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
.form-textarea {
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
    font-family: inherit;
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-help {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-decoration: none;
}

.btn-secondary {
    background: transparent;
    color: var(--text-color-secondary);
    border: 1px solid var(--surface-border);
}

.btn-secondary:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.btn-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-xs);
}

.btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-error-500);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-lg);
    font-weight: bold;
    transition: background-color var(--transition-fast);
    flex-shrink: 0;
}

.btn-remove:hover {
    background: var(--color-error-600);
}

@media (max-width: 768px) {
    .placement-item,
    .value-item {
        flex-direction: column;
        align-items: stretch;
    }

    .value-key {
        flex: 1;
    }

    .btn-remove {
        align-self: flex-end;
    }
}
</style>
