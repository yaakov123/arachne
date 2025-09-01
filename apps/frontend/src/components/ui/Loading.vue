<template>
    <div v-if="show" class="loading" :class="loadingClasses">
        <div class="loading-content">
            <!-- Spinner -->
            <div class="loading-spinner" :class="spinnerClasses">
                <slot name="spinner">
                    <component :is="spinnerComponent" />
                </slot>
            </div>

            <!-- Text -->
            <div v-if="text || $slots.default" class="loading-text">
                <slot>{{ text }}</slot>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface LoadingProps {
    /** Whether to show loading */
    show?: boolean
    /** Loading text */
    text?: string
    /** Loading size */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Loading variant */
    variant?: 'spinner' | 'dots' | 'pulse' | 'bars'
    /** Loading color */
    color?: 'primary' | 'secondary' | 'white' | 'gray'
    /** Whether to center the loading */
    center?: boolean
    /** Whether to show as overlay */
    overlay?: boolean
    /** Whether to show backdrop */
    backdrop?: boolean
}

const props = withDefaults(defineProps<LoadingProps>(), {
    show: true,
    size: 'md',
    variant: 'spinner',
    color: 'primary',
    center: false,
    overlay: false,
    backdrop: false,
})

const loadingClasses = computed(() => [
    'loading',
    `loading-${props.size}`,
    `loading-${props.color}`,
    {
        'loading-center': props.center,
        'loading-overlay': props.overlay,
        'loading-backdrop': props.backdrop,
    },
])

const spinnerClasses = computed(() => [
    'loading-spinner',
    `loading-spinner-${props.variant}`,
    `loading-spinner-${props.size}`,
    `loading-spinner-${props.color}`,
])

const spinnerComponent = computed(() => {
    switch (props.variant) {
        case 'dots':
            return 'div'
        case 'pulse':
            return 'div'
        case 'bars':
            return 'div'
        default:
            return 'div'
    }
})
</script>

<style scoped>
.loading {
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-modal);
}

.loading-backdrop {
    background: rgba(255, 255, 255, 0.8);
}

[data-theme='dark'] .loading-backdrop {
    background: rgba(0, 0, 0, 0.8);
}

.loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
}

.loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Spinner variant */
.loading-spinner-spinner {
    border-radius: var(--radius-full);
    border: 2px solid transparent;
    border-top-color: currentColor;
    animation: spin 1s linear infinite;
}

/* Dots variant */
.loading-spinner-dots {
    display: flex;
    gap: var(--space-xs);
}

.loading-spinner-dots::before,
.loading-spinner-dots::after,
.loading-spinner-dots {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: currentColor;
    animation: dot-pulse 1.4s ease-in-out infinite both;
}

.loading-spinner-dots::before {
    animation-delay: -0.32s;
}

.loading-spinner-dots::after {
    animation-delay: -0.16s;
}

/* Pulse variant */
.loading-spinner-pulse {
    border-radius: var(--radius-full);
    background: currentColor;
    animation: pulse 1.5s ease-in-out infinite;
}

/* Bars variant */
.loading-spinner-bars {
    display: flex;
    gap: 2px;
    align-items: center;
}

.loading-spinner-bars::before,
.loading-spinner-bars::after,
.loading-spinner-bars {
    content: '';
    width: 4px;
    background: currentColor;
    animation: bar-scale 1.2s ease-in-out infinite;
}

.loading-spinner-bars::before {
    animation-delay: -0.24s;
}

.loading-spinner-bars::after {
    animation-delay: -0.12s;
}

/* Sizes */
.loading-xs .loading-spinner-spinner {
    width: 16px;
    height: 16px;
    border-width: 1.5px;
}

.loading-sm .loading-spinner-spinner {
    width: 20px;
    height: 20px;
    border-width: 2px;
}

.loading-md .loading-spinner-spinner {
    width: 24px;
    height: 24px;
    border-width: 2px;
}

.loading-lg .loading-spinner-spinner {
    width: 32px;
    height: 32px;
    border-width: 3px;
}

.loading-xl .loading-spinner-spinner {
    width: 40px;
    height: 40px;
    border-width: 3px;
}

/* Pulse sizes */
.loading-xs .loading-spinner-pulse {
    width: 16px;
    height: 16px;
}

.loading-sm .loading-spinner-pulse {
    width: 20px;
    height: 20px;
}

.loading-md .loading-spinner-pulse {
    width: 24px;
    height: 24px;
}

.loading-lg .loading-spinner-pulse {
    width: 32px;
    height: 32px;
}

.loading-xl .loading-spinner-pulse {
    width: 40px;
    height: 40px;
}

/* Bars sizes */
.loading-xs .loading-spinner-bars::before,
.loading-xs .loading-spinner-bars::after,
.loading-xs .loading-spinner-bars {
    height: 12px;
}

.loading-sm .loading-spinner-bars::before,
.loading-sm .loading-spinner-bars::after,
.loading-sm .loading-spinner-bars {
    height: 16px;
}

.loading-md .loading-spinner-bars::before,
.loading-md .loading-spinner-bars::after,
.loading-md .loading-spinner-bars {
    height: 20px;
}

.loading-lg .loading-spinner-bars::before,
.loading-lg .loading-spinner-bars::after,
.loading-lg .loading-spinner-bars {
    height: 28px;
}

.loading-xl .loading-spinner-bars::before,
.loading-xl .loading-spinner-bars::after,
.loading-xl .loading-spinner-bars {
    height: 36px;
}

/* Colors */
.loading-primary {
    color: var(--primary-color);
}

.loading-secondary {
    color: var(--text-color-secondary);
}

.loading-white {
    color: white;
}

.loading-gray {
    color: var(--color-neutral-500);
}

/* Text */
.loading-text {
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
    text-align: center;
    font-weight: var(--font-medium);
}

.loading-xs .loading-text {
    font-size: var(--text-xs);
}

.loading-lg .loading-text,
.loading-xl .loading-text {
    font-size: var(--text-base);
}

/* Animations */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes dot-pulse {
    0%,
    80%,
    100% {
        transform: scale(0.6);
        opacity: 0.5;
    }
    40% {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.5;
        transform: scale(0.8);
    }
}

@keyframes bar-scale {
    0%,
    40%,
    100% {
        transform: scaleY(0.4);
    }
    20% {
        transform: scaleY(1);
    }
}
</style>
