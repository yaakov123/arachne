<template>
    <div class="toggle-wrapper" :class="wrapperClasses">
        <label v-if="label" :for="toggleId" class="toggle-label-text">
            {{ label }}
        </label>

        <label
            :for="toggleId"
            class="toggle"
            :class="toggleClasses"
            :title="title"
        >
            <input
                :id="toggleId"
                ref="inputRef"
                type="checkbox"
                :checked="isChecked"
                :disabled="disabled"
                :required="required"
                class="toggle-input"
                @change="handleChange"
                @focus="handleFocus"
                @blur="handleBlur"
            />

            <span class="toggle-track" :class="trackClasses">
                <span v-if="showIcons" class="toggle-icon toggle-icon-off">
                    <slot name="icon-off">
                        <component
                            :is="iconOff"
                            v-if="iconOff"
                            :size="iconSize"
                        />
                    </slot>
                </span>

                <span v-if="showIcons" class="toggle-icon toggle-icon-on">
                    <slot name="icon-on">
                        <component
                            :is="iconOn"
                            v-if="iconOn"
                            :size="iconSize"
                        />
                    </slot>
                </span>

                <span class="toggle-thumb" :class="thumbClasses">
                    <span v-if="loading" class="toggle-loading"></span>
                </span>
            </span>
        </label>

        <div v-if="description" class="toggle-description">
            {{ description }}
        </div>

        <div v-if="error" class="toggle-error">
            {{ error }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

export interface ToggleProps {
    /** Toggle value (v-model) */
    modelValue?: boolean
    /** Toggle label */
    label?: string
    /** Toggle description */
    description?: string
    /** Toggle size */
    size?: 'sm' | 'md' | 'lg'
    /** Toggle variant */
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
    /** Whether toggle is disabled */
    disabled?: boolean
    /** Whether toggle is required */
    required?: boolean
    /** Whether toggle is in loading state */
    loading?: boolean
    /** Title attribute for accessibility */
    title?: string
    /** Custom toggle ID */
    id?: string
    /** Error message */
    error?: string
    /** Whether to show icons */
    showIcons?: boolean
    /** Icon component for off state */
    iconOff?: any
    /** Icon component for on state */
    iconOn?: any
}

const props = withDefaults(defineProps<ToggleProps>(), {
    modelValue: false,
    size: 'md',
    variant: 'default',
    disabled: false,
    required: false,
    loading: false,
    showIcons: false,
})

const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    change: [value: boolean, event: Event]
    focus: [event: FocusEvent]
    blur: [event: FocusEvent]
}>()

const inputRef = ref<HTMLInputElement>()
const isFocused = ref(false)

const toggleId = computed(
    () => props.id || `toggle-${Math.random().toString(36).substr(2, 9)}`
)

const isChecked = computed(() => props.modelValue)

const wrapperClasses = computed(() => [
    'toggle-wrapper',
    `toggle-wrapper-${props.size}`,
    {
        'toggle-wrapper-disabled': props.disabled,
        'toggle-wrapper-error': props.error,
        'toggle-wrapper-loading': props.loading,
    },
])

const toggleClasses = computed(() => [
    'toggle',
    `toggle-${props.size}`,
    `toggle-${props.variant}`,
    {
        'toggle-checked': isChecked.value,
        'toggle-disabled': props.disabled,
        'toggle-loading': props.loading,
        'toggle-focused': isFocused.value,
        'toggle-with-icons': props.showIcons,
    },
])

const trackClasses = computed(() => [
    'toggle-track',
    `toggle-track-${props.size}`,
    `toggle-track-${props.variant}`,
    {
        'toggle-track-checked': isChecked.value,
        'toggle-track-disabled': props.disabled,
        'toggle-track-loading': props.loading,
    },
])

const thumbClasses = computed(() => [
    'toggle-thumb',
    `toggle-thumb-${props.size}`,
    {
        'toggle-thumb-checked': isChecked.value,
        'toggle-thumb-disabled': props.disabled,
        'toggle-thumb-loading': props.loading,
    },
])

const iconSize = computed(() => {
    const sizes = { sm: 10, md: 12, lg: 14 }
    return sizes[props.size] || 12
})

const handleChange = (event: Event) => {
    if (props.disabled || props.loading) return

    const target = event.target as HTMLInputElement
    const value = target.checked

    emit('update:modelValue', value)
    emit('change', value, event)
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
const focus = () => {
    inputRef.value?.focus()
}

// Expose methods
defineExpose({
    focus,
    inputRef,
})
</script>

<style scoped>
.toggle-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.toggle-wrapper-disabled {
    opacity: 0.6;
}

.toggle-label-text {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
    cursor: pointer;
}

.toggle {
    position: relative;
    display: inline-block;
    cursor: pointer;
    user-select: none;
}

.toggle-disabled {
    cursor: not-allowed;
}

.toggle-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-track {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: var(--radius-full);
    transition: all var(--transition-fast);
    overflow: hidden;
}

.toggle-thumb {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
    z-index: 2;
}

/* Sizes */
.toggle-sm {
    width: 32px;
    height: 18px;
}

.toggle-track-sm {
    width: 32px;
    height: 18px;
}

.toggle-thumb-sm {
    width: 14px;
    height: 14px;
    left: 2px;
}

.toggle-thumb-sm.toggle-thumb-checked {
    transform: translateX(14px);
}

.toggle-md {
    width: 44px;
    height: 24px;
}

.toggle-track-md {
    width: 44px;
    height: 24px;
}

.toggle-thumb-md {
    width: 20px;
    height: 20px;
    left: 2px;
}

.toggle-thumb-md.toggle-thumb-checked {
    transform: translateX(20px);
}

.toggle-lg {
    width: 56px;
    height: 32px;
}

.toggle-track-lg {
    width: 56px;
    height: 32px;
}

.toggle-thumb-lg {
    width: 28px;
    height: 28px;
    left: 2px;
}

.toggle-thumb-lg.toggle-thumb-checked {
    transform: translateX(24px);
}

/* Variants - Default/Unchecked */
.toggle-track-default {
    background: var(--color-neutral-300);
}

.toggle-track-primary {
    background: var(--color-neutral-300);
}

.toggle-track-success {
    background: var(--color-neutral-300);
}

.toggle-track-warning {
    background: var(--color-neutral-300);
}

.toggle-track-danger {
    background: var(--color-neutral-300);
}

/* Variants - Checked */
.toggle-track-default.toggle-track-checked {
    background: var(--primary-color);
}

.toggle-track-primary.toggle-track-checked {
    background: var(--color-primary-500);
}

.toggle-track-success.toggle-track-checked {
    background: var(--color-success-500);
}

.toggle-track-warning.toggle-track-checked {
    background: var(--color-warning-500);
}

.toggle-track-danger.toggle-track-checked {
    background: var(--color-error-500);
}

/* Hover states */
.toggle:hover:not(.toggle-disabled) .toggle-track {
    filter: brightness(1.1);
}

/* Focus states */
.toggle-focused .toggle-track {
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.toggle-focused.toggle-checked .toggle-track-primary {
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.toggle-focused.toggle-checked .toggle-track-success {
    box-shadow: 0 0 0 3px var(--color-success-100);
}

.toggle-focused.toggle-checked .toggle-track-warning {
    box-shadow: 0 0 0 3px var(--color-warning-100);
}

.toggle-focused.toggle-checked .toggle-track-danger {
    box-shadow: 0 0 0 3px var(--color-error-100);
}

/* Loading state */
.toggle-loading .toggle-thumb {
    cursor: wait;
}

.toggle-loading {
    width: 10px;
    height: 10px;
    border: 1px solid transparent;
    border-top: 1px solid var(--color-neutral-400);
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
}

/* Icons */
.toggle-icon {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 1;
    transition: opacity var(--transition-fast);
}

.toggle-icon-off {
    left: 6px;
    opacity: 1;
}

.toggle-icon-on {
    right: 6px;
    opacity: 0;
}

.toggle-checked .toggle-icon-off {
    opacity: 0;
}

.toggle-checked .toggle-icon-on {
    opacity: 1;
}

/* Icon adjustments for sizes */
.toggle-sm .toggle-icon-off {
    left: 4px;
}

.toggle-sm .toggle-icon-on {
    right: 4px;
}

.toggle-lg .toggle-icon-off {
    left: 8px;
}

.toggle-lg .toggle-icon-on {
    right: 8px;
}

/* Description and error */
.toggle-description {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
    line-height: var(--leading-tight);
}

.toggle-error {
    font-size: var(--text-xs);
    color: var(--color-error-600);
    font-weight: var(--font-medium);
    line-height: var(--leading-tight);
}

/* Disabled state */
.toggle-disabled .toggle-track {
    background: var(--color-neutral-200) !important;
    cursor: not-allowed;
}

.toggle-disabled .toggle-thumb {
    background: var(--color-neutral-300);
    cursor: not-allowed;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* Dark theme adjustments */
[data-theme='dark'] .toggle-track-default,
[data-theme='dark'] .toggle-track-primary,
[data-theme='dark'] .toggle-track-success,
[data-theme='dark'] .toggle-track-warning,
[data-theme='dark'] .toggle-track-danger {
    background: var(--color-neutral-600);
}

[data-theme='dark'] .toggle-thumb {
    background: var(--color-neutral-100);
}

[data-theme='dark'] .toggle-disabled .toggle-track {
    background: var(--color-neutral-700) !important;
}

[data-theme='dark'] .toggle-disabled .toggle-thumb {
    background: var(--color-neutral-500);
}
</style>
