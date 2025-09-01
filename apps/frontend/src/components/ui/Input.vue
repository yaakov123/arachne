<template>
    <div class="input-wrapper" :class="wrapperClasses">
        <!-- Label -->
        <label
            v-if="label"
            :for="inputId"
            class="input-label"
            :class="{ 'input-label-required': required }"
        >
            {{ label }}
        </label>

        <!-- Input container -->
        <div class="input-container" :class="containerClasses">
            <!-- Left icon slot -->
            <slot name="left-icon" />

            <!-- Input element -->
            <component
                :is="tag"
                :id="inputId"
                ref="inputRef"
                :value="modelValue"
                :type="type"
                :placeholder="placeholder"
                :disabled="disabled"
                :readonly="readonly"
                :required="required"
                :rows="rows"
                :cols="cols"
                :maxlength="maxlength"
                :minlength="minlength"
                :min="min"
                :max="max"
                :step="step"
                :autocomplete="autocomplete"
                class="input-element"
                :class="inputClasses"
                v-bind="$attrs"
                @input="handleInput"
                @change="handleChange"
                @focus="handleFocus"
                @blur="handleBlur"
            />

            <!-- Right icon slot -->
            <slot name="right-icon" />
        </div>

        <!-- Help text -->
        <div v-if="helpText && !error" class="input-help">
            {{ helpText }}
        </div>

        <!-- Error message -->
        <div v-if="error" class="input-error">
            {{ error }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'

export interface InputProps {
    /** Input value (v-model) */
    modelValue?: string | number
    /** Input type */
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
    /** Component to render (input or textarea) */
    variant?: 'input' | 'textarea' | 'select'
    /** Input label */
    label?: string
    /** Input placeholder */
    placeholder?: string
    /** Help text displayed below input */
    helpText?: string
    /** Error message */
    error?: string
    /** Input size */
    size?: 'sm' | 'md' | 'lg'
    /** Whether input is disabled */
    disabled?: boolean
    /** Whether input is readonly */
    readonly?: boolean
    /** Whether input is required */
    required?: boolean
    /** Textarea rows (when variant="textarea") */
    rows?: number
    /** Textarea cols (when variant="textarea") */
    cols?: number
    /** Max length */
    maxlength?: number
    /** Min length */
    minlength?: number
    /** Min value (for number inputs) */
    min?: number | string
    /** Max value (for number inputs) */
    max?: number | string
    /** Step value (for number inputs) */
    step?: number | string
    /** Autocomplete attribute */
    autocomplete?: string
    /** Custom input ID */
    id?: string
}

const props = withDefaults(defineProps<InputProps>(), {
    type: 'text',
    variant: 'input',
    size: 'md',
    disabled: false,
    readonly: false,
    required: false,
    rows: 3,
})

const emit = defineEmits<{
    'update:modelValue': [value: string | number]
    input: [event: Event]
    change: [event: Event]
    focus: [event: FocusEvent]
    blur: [event: FocusEvent]
}>()

const inputRef = ref<HTMLInputElement | HTMLTextAreaElement>()
const isFocused = ref(false)

const inputId = computed(
    () => props.id || `input-${Math.random().toString(36).substr(2, 9)}`
)

const tag = computed(() => {
    return props.variant === 'textarea' ? 'textarea' : 'input'
})

const wrapperClasses = computed(() => [
    'input-wrapper',
    `input-wrapper-${props.size}`,
    {
        'input-wrapper-disabled': props.disabled,
        'input-wrapper-error': props.error,
        'input-wrapper-focused': isFocused.value,
    },
])

const containerClasses = computed(() => [
    'input-container',
    `input-container-${props.size}`,
    {
        'input-container-disabled': props.disabled,
        'input-container-error': props.error,
        'input-container-focused': isFocused.value,
        'input-container-has-left-icon': !!slots['left-icon'],
        'input-container-has-right-icon': !!slots['right-icon'],
    },
])

const inputClasses = computed(() => [
    'input-element',
    `input-element-${props.size}`,
    {
        'input-element-disabled': props.disabled,
        'input-element-error': props.error,
    },
])

const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement
    let value: string | number = target.value

    // Convert to number for number inputs
    if (props.type === 'number' && value !== '') {
        value = parseFloat(value)
        if (isNaN(value)) {
            value = target.value // Keep original string if not a valid number
        }
    }

    emit('update:modelValue', value)
    emit('input', event)
}

const handleChange = (event: Event) => {
    emit('change', event)
}

const handleFocus = (event: FocusEvent) => {
    isFocused.value = true
    emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
    isFocused.value = false
    emit('blur', event)
}

// Focus method for parent components
const focus = async () => {
    await nextTick()
    inputRef.value?.focus()
}

// Expose focus method
defineExpose({
    focus,
    inputRef,
})

// Get slots for checking if icons exist
const slots = defineSlots<{
    'left-icon'?: any
    'right-icon'?: any
}>()
</script>

<style scoped>
.input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.input-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
    line-height: var(--leading-tight);
}

.input-label-required::after {
    content: ' *';
    color: var(--color-error-500);
}

.input-container {
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    transition: all var(--transition-fast);
}

.input-container:hover:not(.input-container-disabled) {
    border-color: var(--color-neutral-400);
}

.input-container-focused {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.input-container-error {
    border-color: var(--color-error-500);
}

.input-container-error.input-container-focused {
    box-shadow: 0 0 0 3px var(--color-error-100);
}

.input-container-disabled {
    background: var(--color-neutral-100);
    opacity: 0.6;
    cursor: not-allowed;
}

.input-element {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-family: inherit;
    line-height: var(--leading-normal);
}

.input-element::placeholder {
    color: var(--text-color-secondary);
}

.input-element:disabled {
    cursor: not-allowed;
}

/* Sizes */
.input-container-sm {
    min-height: 32px;
}

.input-container-md {
    min-height: 40px;
}

.input-container-lg {
    min-height: 48px;
}

.input-element-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-xs);
}

.input-element-md {
    padding: var(--space-md) var(--space-lg);
    font-size: var(--text-sm);
}

.input-element-lg {
    padding: var(--space-lg) var(--space-xl);
    font-size: var(--text-base);
}

/* Icon adjustments */
.input-container-has-left-icon .input-element {
    padding-left: var(--space-sm);
}

.input-container-has-right-icon .input-element {
    padding-right: var(--space-sm);
}

/* Icon containers */
.input-container :deep(.input-icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-md);
    color: var(--text-color-secondary);
    flex-shrink: 0;
}

.input-container-sm :deep(.input-icon) {
    padding: 0 var(--space-sm);
}

.input-container-lg :deep(.input-icon) {
    padding: 0 var(--space-lg);
}

/* Textarea specific */
textarea.input-element {
    resize: vertical;
    min-height: 80px;
    line-height: var(--leading-relaxed);
}

/* Help and error text */
.input-help {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
    line-height: var(--leading-tight);
}

.input-error {
    font-size: var(--text-xs);
    color: var(--color-error-600);
    font-weight: var(--font-medium);
    line-height: var(--leading-tight);
}

/* Focus within for container with icons */
.input-container:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.input-container-error:focus-within {
    border-color: var(--color-error-500);
    box-shadow: 0 0 0 3px var(--color-error-100);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .input-container-md {
        min-height: 36px;
    }

    .input-container-lg {
        min-height: 44px;
    }
}
</style>
