<template>
    <button
        :type="type"
        :disabled="disabled || loading"
        :class="buttonClasses"
        v-bind="$attrs"
        @click="handleClick"
    >
        <span v-if="loading" class="loading-spinner"></span>
        <slot v-if="!loading" name="icon-left" />
        <span v-if="$slots.default || text" class="button-content">
            <slot>{{ text }}</slot>
        </span>
        <slot v-if="!loading" name="icon-right" />
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ButtonProps {
    /** Button variant */
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    /** Button size */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Button type attribute */
    type?: 'button' | 'submit' | 'reset'
    /** Whether button is disabled */
    disabled?: boolean
    /** Whether button is in loading state */
    loading?: boolean
    /** Button text (alternative to slot) */
    text?: string
    /** Full width button */
    fullWidth?: boolean
    /** Icon only button (no padding for text) */
    iconOnly?: boolean
}

const props = withDefaults(defineProps<ButtonProps>(), {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
    fullWidth: false,
    iconOnly: false,
})

const emit = defineEmits<{
    click: [event: MouseEvent]
}>()

const buttonClasses = computed(() => [
    'btn',
    `btn-${props.variant}`,
    `btn-${props.size}`,
    {
        'btn-loading': props.loading,
        'btn-disabled': props.disabled,
        'btn-full-width': props.fullWidth,
        'btn-icon-only': props.iconOnly,
    },
])

const handleClick = (event: MouseEvent) => {
    if (!props.disabled && !props.loading) {
        emit('click', event)
    }
}
</script>

<style scoped>
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-decoration: none;
    position: relative;
    white-space: nowrap;
}

.btn:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

.btn:disabled,
.btn-disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Variants */
.btn-primary {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.btn-primary:hover:not(:disabled):not(.btn-loading) {
    background-color: var(--color-primary-700);
}

.btn-secondary {
    background-color: var(--surface-card);
    color: var(--text-color);
    border-color: var(--surface-border);
}

.btn-secondary:hover:not(:disabled):not(.btn-loading) {
    background-color: var(--surface-hover);
}

.btn-outline {
    background-color: transparent;
    color: var(--primary-color);
    border-color: var(--primary-color);
}

.btn-outline:hover:not(:disabled):not(.btn-loading) {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.btn-ghost {
    background-color: transparent;
    color: var(--text-color);
    border-color: transparent;
}

.btn-ghost:hover:not(:disabled):not(.btn-loading) {
    background-color: var(--surface-hover);
}

.btn-danger {
    background-color: var(--color-error-500);
    color: white;
}

.btn-danger:hover:not(:disabled):not(.btn-loading) {
    background-color: var(--color-error-600);
}

/* Sizes */
.btn-xs {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--text-xs);
    min-height: 28px;
}

.btn-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-sm);
    min-height: 32px;
}

.btn-md {
    padding: var(--space-md) var(--space-xl);
    font-size: var(--text-sm);
    min-height: 40px;
}

.btn-lg {
    padding: var(--space-lg) var(--space-2xl);
    font-size: var(--text-base);
    min-height: 48px;
}

.btn-xl {
    padding: var(--space-xl) var(--space-3xl);
    font-size: var(--text-lg);
    min-height: 56px;
}

/* Icon only buttons */
.btn-icon-only {
    padding: var(--space-sm);
    aspect-ratio: 1;
}

.btn-icon-only.btn-xs {
    padding: var(--space-xs);
    min-height: 28px;
    width: 28px;
}

.btn-icon-only.btn-sm {
    padding: var(--space-sm);
    min-height: 32px;
    width: 32px;
}

.btn-icon-only.btn-md {
    padding: var(--space-md);
    min-height: 40px;
    width: 40px;
}

.btn-icon-only.btn-lg {
    padding: var(--space-lg);
    min-height: 48px;
    width: 48px;
}

.btn-icon-only.btn-xl {
    padding: var(--space-xl);
    min-height: 56px;
    width: 56px;
}

/* Full width */
.btn-full-width {
    width: 100%;
}

/* Loading state */
.btn-loading {
    cursor: wait;
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
}

.btn-xs .loading-spinner {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
}

.btn-sm .loading-spinner {
    width: 14px;
    height: 14px;
    border-width: 1.5px;
}

.btn-lg .loading-spinner,
.btn-xl .loading-spinner {
    width: 18px;
    height: 18px;
    border-width: 2px;
}

.button-content {
    display: flex;
    align-items: center;
    justify-content: center;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .btn-md {
        padding: var(--space-sm) var(--space-lg);
        min-height: 36px;
    }

    .btn-lg {
        padding: var(--space-md) var(--space-xl);
        min-height: 44px;
    }
}
</style>
