<template>
    <div class="auth-value-source">
        <label v-if="label" class="form-label">{{ label }}</label>

        <div class="source-type-selector">
            <label class="form-label">Value Source</label>
            <select
                v-model="sourceType"
                class="form-select"
                @change="onSourceTypeChange"
            >
                <option value="static">Static Value</option>
                <option value="environment">Environment Variable</option>
                <option value="prompt">Prompt at Runtime</option>
                <option value="file">Read from File</option>
            </select>
        </div>

        <!-- Static Value -->
        <div v-if="sourceType === 'static'" class="form-group">
            <label class="form-label">Value</label>
            <input
                v-model="staticValue"
                type="text"
                class="form-input"
                :class="{ 'form-input-error': error }"
                :placeholder="placeholder"
                @input="updateValue"
            />
        </div>

        <!-- Environment Variable -->
        <div v-else-if="sourceType === 'environment'" class="form-group">
            <label class="form-label">Environment Variable</label>
            <input
                v-model="envVariable"
                type="text"
                class="form-input"
                :class="{ 'form-input-error': error }"
                placeholder="API_KEY"
                @input="updateValue"
            />
            <small class="form-help">Variable name (without $ prefix)</small>
        </div>

        <!-- Prompt at Runtime -->
        <div v-else-if="sourceType === 'prompt'" class="form-group">
            <label class="form-label">Prompt Message</label>
            <input
                v-model="promptMessage"
                type="text"
                class="form-input"
                placeholder="Enter your API key"
                @input="updateValue"
            />
            <small class="form-help"
                >Message shown when prompting user for value</small
            >
        </div>

        <!-- Read from File -->
        <div v-else-if="sourceType === 'file'" class="form-group">
            <label class="form-label">File Path</label>
            <input
                v-model="filePath"
                type="text"
                class="form-input"
                :class="{ 'form-input-error': error }"
                placeholder="/path/to/token.txt"
                @input="updateValue"
            />
            <div class="form-group">
                <label class="form-label">File Encoding</label>
                <select
                    v-model="fileEncoding"
                    class="form-select"
                    @change="updateValue"
                >
                    <option value="utf8">UTF-8</option>
                    <option value="base64">Base64</option>
                </select>
            </div>
        </div>

        <span v-if="error" class="form-error">{{ error }}</span>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AuthValueSource } from '@/types'

// Props
interface Props {
    modelValue?: AuthValueSource
    label?: string
    placeholder?: string
    error?: string
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: () => ({ type: 'static', value: '' }),
    placeholder: 'Enter value',
})

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: AuthValueSource]
}>()

// Local state
const sourceType = ref<AuthValueSource['type']>('static')
const staticValue = ref('')
const envVariable = ref('')
const promptMessage = ref('')
const filePath = ref('')
const fileEncoding = ref<'utf8' | 'base64'>('utf8')

// Initialize from modelValue
const initializeFromModel = () => {
    if (!props.modelValue) return

    sourceType.value = props.modelValue.type

    switch (props.modelValue.type) {
        case 'static':
            staticValue.value = props.modelValue.value || ''
            break
        case 'environment':
            envVariable.value = props.modelValue.variable || ''
            break
        case 'prompt':
            promptMessage.value = props.modelValue.message || ''
            break
        case 'file':
            filePath.value = props.modelValue.path || ''
            fileEncoding.value = props.modelValue.encoding || 'utf8'
            break
    }
}

// Watch for external changes
watch(() => props.modelValue, initializeFromModel, {
    immediate: true,
    deep: true,
})

// Methods
const onSourceTypeChange = () => {
    // Reset values when type changes
    staticValue.value = ''
    envVariable.value = ''
    promptMessage.value = ''
    filePath.value = ''
    fileEncoding.value = 'utf8'
    updateValue()
}

const updateValue = () => {
    let newValue: AuthValueSource

    switch (sourceType.value) {
        case 'static':
            newValue = { type: 'static', value: staticValue.value }
            break
        case 'environment':
            newValue = { type: 'environment', variable: envVariable.value }
            break
        case 'prompt':
            newValue = {
                type: 'prompt',
                message: promptMessage.value || undefined,
            }
            break
        case 'file':
            newValue = {
                type: 'file',
                path: filePath.value,
                encoding: fileEncoding.value,
            }
            break
        default:
            newValue = { type: 'static', value: '' }
    }

    emit('update:modelValue', newValue)
}
</script>

<style scoped>
.auth-value-source {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
}

.source-type-selector {
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
