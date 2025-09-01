<template>
    <div class="select-wrapper" :class="wrapperClasses">
        <!-- Label -->
        <label
            v-if="label"
            :for="selectId"
            class="select-label"
            :class="{ 'select-label-required': required }"
        >
            {{ label }}
        </label>

        <!-- Select container -->
        <div class="select-container" :class="containerClasses">
            <!-- Left icon slot -->
            <slot name="left-icon" />

            <!-- Select element -->
            <select
                :id="selectId"
                ref="selectRef"
                :value="modelValue"
                :disabled="disabled"
                :required="required"
                :multiple="multiple"
                class="select-element"
                :class="selectClasses"
                v-bind="$attrs"
                @change="handleChange"
                @focus="handleFocus"
                @blur="handleBlur"
            >
                <option
                    v-if="placeholder && !multiple"
                    value=""
                    disabled
                    :selected="!modelValue"
                >
                    {{ placeholder }}
                </option>

                <slot>
                    <option
                        v-for="option in options"
                        :key="getOptionValue(option)"
                        :value="getOptionValue(option)"
                        :disabled="getOptionDisabled(option)"
                    >
                        {{ getOptionLabel(option) }}
                    </option>
                </slot>
            </select>

            <!-- Chevron icon -->
            <div v-if="!multiple" class="select-chevron">
                <ChevronDown :size="16" />
            </div>
        </div>

        <!-- Help text -->
        <div v-if="helpText && !error" class="select-help">
            {{ helpText }}
        </div>

        <!-- Error message -->
        <div v-if="error" class="select-error">
            {{ error }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

export interface SelectOption {
    label: string
    value: string | number
    disabled?: boolean
}

export interface SelectProps {
    /** Select value (v-model) */
    modelValue?: string | number | string[] | number[]
    /** Select options */
    options?: (SelectOption | string | number)[]
    /** Select label */
    label?: string
    /** Select placeholder */
    placeholder?: string
    /** Help text displayed below select */
    helpText?: string
    /** Error message */
    error?: string
    /** Select size */
    size?: 'sm' | 'md' | 'lg'
    /** Whether select is disabled */
    disabled?: boolean
    /** Whether select is required */
    required?: boolean
    /** Whether select allows multiple selection */
    multiple?: boolean
    /** Custom select ID */
    id?: string
}

const props = withDefaults(defineProps<SelectProps>(), {
    size: 'md',
    disabled: false,
    required: false,
    multiple: false,
    options: () => [],
})

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur'])

const selectRef = ref<HTMLSelectElement>()
const isFocused = ref(false)

const selectId = computed(
    () => props.id || `select-${Math.random().toString(36).substr(2, 9)}`
)

const wrapperClasses = computed(() => [
    'select-wrapper',
    `select-wrapper-${props.size}`,
    {
        'select-wrapper-disabled': props.disabled,
        'select-wrapper-error': props.error,
        'select-wrapper-focused': isFocused.value,
        'select-wrapper-multiple': props.multiple,
    },
])

const containerClasses = computed(() => [
    'select-container',
    `select-container-${props.size}`,
    {
        'select-container-disabled': props.disabled,
        'select-container-error': props.error,
        'select-container-focused': isFocused.value,
        'select-container-multiple': props.multiple,
        'select-container-has-left-icon': !!slots['left-icon'],
    },
])

const selectClasses = computed(() => [
    'select-element',
    `select-element-${props.size}`,
    {
        'select-element-disabled': props.disabled,
        'select-element-error': props.error,
        'select-element-multiple': props.multiple,
    },
])

// Option helpers
const getOptionValue = (
    option: SelectOption | string | number
): string | number => {
    if (typeof option === 'object' && option !== null) {
        return option.value
    }
    return option
}

const getOptionLabel = (option: SelectOption | string | number): string => {
    if (typeof option === 'object' && option !== null) {
        return option.label
    }
    return String(option)
}

const getOptionDisabled = (option: SelectOption | string | number): boolean => {
    if (typeof option === 'object' && option !== null) {
        return option.disabled || false
    }
    return false
}

const handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement

    if (props.multiple) {
        const values = Array.from(target.selectedOptions).map((option) => {
            const value = option.value
            // Try to convert to number if it looks like a number
            return isNaN(Number(value)) ? value : Number(value)
        }) as (string | number)[]
        emit('update:modelValue', values)
    } else {
        let value: string | number = target.value
        // Try to convert to number if it looks like a number
        if (!isNaN(Number(value)) && value !== '') {
            value = Number(value)
        }
        emit('update:modelValue', value)
    }

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
    selectRef.value?.focus()
}

// Expose focus method
defineExpose({
    focus,
    selectRef,
})

// Get slots for checking if icons exist
const slots = defineSlots<{
    default?: any
    'left-icon'?: any
}>()
</script>

<style scoped>
.select-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.select-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
    line-height: var(--leading-tight);
}

.select-label-required::after {
    content: ' *';
    color: var(--color-error-500);
}

.select-container {
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    transition: all var(--transition-fast);
}

.select-container:hover:not(.select-container-disabled) {
    border-color: var(--color-neutral-400);
}

.select-container-focused {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.select-container-error {
    border-color: var(--color-error-500);
}

.select-container-error.select-container-focused {
    box-shadow: 0 0 0 3px var(--color-error-100);
}

.select-container-disabled {
    background: var(--color-neutral-100);
    opacity: 0.6;
    cursor: not-allowed;
}

.select-element {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-family: inherit;
    line-height: var(--leading-normal);
    appearance: none;
    cursor: pointer;
}

.select-element:disabled {
    cursor: not-allowed;
}

.select-element-multiple {
    min-height: 80px;
}

/* Sizes */
.select-container-sm {
    min-height: 32px;
}

.select-container-md {
    min-height: 40px;
}

.select-container-lg {
    min-height: 48px;
}

.select-element-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-xs);
}

.select-element-md {
    padding: var(--space-md) var(--space-lg);
    font-size: var(--text-sm);
}

.select-element-lg {
    padding: var(--space-lg) var(--space-xl);
    font-size: var(--text-base);
}

/* Multiple select adjustments */
.select-element-multiple.select-element-sm {
    padding: var(--space-xs) var(--space-md);
}

.select-element-multiple.select-element-md {
    padding: var(--space-sm) var(--space-lg);
}

.select-element-multiple.select-element-lg {
    padding: var(--space-md) var(--space-xl);
}

/* Icon adjustments */
.select-container-has-left-icon .select-element {
    padding-left: var(--space-sm);
}

.select-container:not(.select-container-multiple) .select-element {
    padding-right: var(--space-3xl);
}

/* Icon containers */
.select-container :deep(.select-icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-md);
    color: var(--text-color-secondary);
    flex-shrink: 0;
}

.select-container-sm :deep(.select-icon) {
    padding: 0 var(--space-sm);
}

.select-container-lg :deep(.select-icon) {
    padding: 0 var(--space-lg);
}

/* Chevron */
.select-chevron {
    position: absolute;
    right: var(--space-md);
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--text-color-secondary);
    transition: transform var(--transition-fast);
}

.select-container-sm .select-chevron {
    right: var(--space-sm);
}

.select-container-lg .select-chevron {
    right: var(--space-lg);
}

.select-container-focused .select-chevron {
    transform: translateY(-50%) rotate(180deg);
}

/* Help and error text */
.select-help {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
    line-height: var(--leading-tight);
}

.select-error {
    font-size: var(--text-xs);
    color: var(--color-error-600);
    font-weight: var(--font-medium);
    line-height: var(--leading-tight);
}

/* Focus within for container with icons */
.select-container:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.select-container-error:focus-within {
    border-color: var(--color-error-500);
    box-shadow: 0 0 0 3px var(--color-error-100);
}

/* Option styling (limited browser support) */
.select-element option {
    padding: var(--space-sm);
    background: var(--surface-card);
    color: var(--text-color);
}

.select-element option:disabled {
    color: var(--text-color-muted);
    background: var(--color-neutral-100);
}

/* Dark theme adjustments */
[data-theme='dark'] .select-container-disabled {
    background: var(--color-neutral-800);
}

[data-theme='dark'] .select-element option {
    background: var(--color-neutral-800);
}

[data-theme='dark'] .select-element option:disabled {
    background: var(--color-neutral-700);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .select-container-md {
        min-height: 36px;
    }

    .select-container-lg {
        min-height: 44px;
    }
}
</style>
