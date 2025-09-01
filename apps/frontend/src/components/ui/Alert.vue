<template>
    <div
        v-if="show"
        class="alert"
        :class="alertClasses"
        role="alert"
        :aria-live="variant === 'error' ? 'assertive' : 'polite'"
    >
        <!-- Icon -->
        <div v-if="showIcon || $slots.icon" class="alert-icon">
            <slot name="icon">
                <component :is="defaultIcon" :size="iconSize" />
            </slot>
        </div>

        <!-- Content -->
        <div class="alert-content">
            <!-- Title -->
            <div v-if="title || $slots.title" class="alert-title">
                <slot name="title">{{ title }}</slot>
            </div>

            <!-- Message -->
            <div v-if="message || $slots.default" class="alert-message">
                <slot>{{ message }}</slot>
            </div>
        </div>

        <!-- Actions -->
        <div v-if="$slots.actions || closeable" class="alert-actions">
            <slot name="actions" />

            <button
                v-if="closeable"
                type="button"
                class="alert-close"
                @click="handleClose"
                :aria-label="closeLabel"
            >
                <X :size="16" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Info,
    X,
} from 'lucide-vue-next'

export interface AlertProps {
    /** Whether to show alert */
    show?: boolean
    /** Alert variant */
    variant?: 'info' | 'success' | 'warning' | 'error'
    /** Alert size */
    size?: 'sm' | 'md' | 'lg'
    /** Alert title */
    title?: string
    /** Alert message */
    message?: string
    /** Whether to show icon */
    showIcon?: boolean
    /** Whether alert is closeable */
    closeable?: boolean
    /** Close button aria-label */
    closeLabel?: string
    /** Whether to auto-dismiss */
    autoDismiss?: boolean
    /** Auto-dismiss delay in ms */
    dismissDelay?: number
}

const props = withDefaults(defineProps<AlertProps>(), {
    show: true,
    variant: 'info',
    size: 'md',
    showIcon: true,
    closeable: false,
    closeLabel: 'Close alert',
    autoDismiss: false,
    dismissDelay: 5000,
})

const emit = defineEmits<{
    'update:show': [show: boolean]
    close: []
    dismiss: []
}>()

const internalShow = ref(props.show)

const alertClasses = computed(() => [
    'alert',
    `alert-${props.variant}`,
    `alert-${props.size}`,
])

const defaultIcon = computed(() => {
    const icons = {
        info: Info,
        success: CheckCircle,
        warning: AlertTriangle,
        error: AlertCircle,
    }
    return icons[props.variant]
})

const iconSize = computed(() => {
    const sizes = { sm: 16, md: 20, lg: 24 }
    return sizes[props.size] || 20
})

const handleClose = () => {
    internalShow.value = false
    emit('update:show', false)
    emit('close')
}

// Auto-dismiss functionality
if (props.autoDismiss && props.dismissDelay > 0) {
    setTimeout(() => {
        if (internalShow.value) {
            internalShow.value = false
            emit('update:show', false)
            emit('dismiss')
        }
    }, props.dismissDelay)
}
</script>

<style scoped>
.alert {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    border-radius: var(--radius-lg);
    border: 1px solid;
    transition: all var(--transition-fast);
}

/* Sizes */
.alert-sm {
    padding: var(--space-md);
    gap: var(--space-sm);
}

.alert-md {
    padding: var(--space-lg);
    gap: var(--space-md);
}

.alert-lg {
    padding: var(--space-xl);
    gap: var(--space-lg);
}

/* Variants */
.alert-info {
    background-color: var(--color-info-50);
    border-color: var(--color-info-200);
    color: var(--color-info-700);
}

.alert-success {
    background-color: var(--color-success-50);
    border-color: var(--color-success-200);
    color: var(--color-success-700);
}

.alert-warning {
    background-color: var(--color-warning-50);
    border-color: var(--color-warning-200);
    color: var(--color-warning-700);
}

.alert-error {
    background-color: var(--color-error-50);
    border-color: var(--color-error-200);
    color: var(--color-error-700);
}

/* Icon */
.alert-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px; /* Slight alignment adjustment */
}

.alert-info .alert-icon {
    color: var(--color-info-500);
}

.alert-success .alert-icon {
    color: var(--color-success-500);
}

.alert-warning .alert-icon {
    color: var(--color-warning-500);
}

.alert-error .alert-icon {
    color: var(--color-error-500);
}

/* Content */
.alert-content {
    flex: 1;
    min-width: 0;
}

.alert-title {
    font-weight: var(--font-semibold);
    margin-bottom: var(--space-xs);
    line-height: var(--leading-tight);
}

.alert-sm .alert-title {
    font-size: var(--text-sm);
}

.alert-md .alert-title {
    font-size: var(--text-base);
}

.alert-lg .alert-title {
    font-size: var(--text-lg);
}

.alert-message {
    line-height: var(--leading-relaxed);
}

.alert-sm .alert-message {
    font-size: var(--text-xs);
}

.alert-md .alert-message {
    font-size: var(--text-sm);
}

.alert-lg .alert-message {
    font-size: var(--text-base);
}

/* Actions */
.alert-actions {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    flex-shrink: 0;
}

.alert-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: currentColor;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    opacity: 0.7;
}

.alert-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
}

.alert-sm .alert-close {
    width: 20px;
    height: 20px;
}

.alert-lg .alert-close {
    width: 28px;
    height: 28px;
}

/* Dark theme adjustments */
[data-theme='dark'] .alert-info {
    background-color: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
    color: var(--color-info-300);
}

[data-theme='dark'] .alert-success {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.2);
    color: var(--color-success-300);
}

[data-theme='dark'] .alert-warning {
    background-color: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.2);
    color: var(--color-warning-300);
}

[data-theme='dark'] .alert-error {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
    color: var(--color-error-300);
}

[data-theme='dark'] .alert-close:hover {
    background: rgba(255, 255, 255, 0.1);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .alert-md {
        padding: var(--space-md);
    }

    .alert-lg {
        padding: var(--space-lg);
    }

    .alert {
        gap: var(--space-sm);
    }
}
</style>
