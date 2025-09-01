<template>
    <Teleport to="body">
        <Transition
            name="modal"
            @enter="onEnter"
            @after-enter="onAfterEnter"
            @before-leave="onBeforeLeave"
            @after-leave="onAfterLeave"
        >
            <div
                v-if="show"
                class="modal-overlay"
                :class="overlayClasses"
                @click="handleOverlayClick"
                @keydown.escape="handleEscape"
                tabindex="-1"
                role="dialog"
                :aria-modal="true"
                :aria-labelledby="titleId"
                :aria-describedby="descriptionId"
            >
                <div
                    ref="modalRef"
                    class="modal-container"
                    :class="containerClasses"
                    @click.stop
                >
                    <!-- Header -->
                    <header v-if="showHeader" class="modal-header">
                        <div class="modal-title-section">
                            <h3
                                v-if="title || $slots.title"
                                :id="titleId"
                                class="modal-title"
                            >
                                <slot name="title">{{ title }}</slot>
                            </h3>
                            <p
                                v-if="description || $slots.description"
                                :id="descriptionId"
                                class="modal-description"
                            >
                                <slot name="description">{{
                                    description
                                }}</slot>
                            </p>
                        </div>

                        <button
                            v-if="showCloseButton"
                            type="button"
                            class="modal-close-button"
                            :disabled="loading"
                            @click="handleClose"
                            aria-label="Close modal"
                        >
                            <slot name="close-icon">
                                <X :size="20" />
                            </slot>
                        </button>
                    </header>

                    <!-- Content -->
                    <div class="modal-content" :class="contentClasses">
                        <slot />
                    </div>

                    <!-- Footer -->
                    <footer v-if="$slots.footer" class="modal-footer">
                        <slot name="footer" />
                    </footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

export interface ModalProps {
    /** Whether modal is visible */
    show: boolean
    /** Modal title */
    title?: string
    /** Modal description */
    description?: string
    /** Modal size */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
    /** Whether to show header */
    showHeader?: boolean
    /** Whether to show close button */
    showCloseButton?: boolean
    /** Whether to close on overlay click */
    closeOnOverlayClick?: boolean
    /** Whether to close on escape key */
    closeOnEscape?: boolean
    /** Whether modal is in loading state */
    loading?: boolean
    /** Whether to prevent body scroll when open */
    preventBodyScroll?: boolean
    /** Z-index for modal */
    zIndex?: number
    /** Whether to focus modal on open */
    autoFocus?: boolean
    /** Whether to trap focus within modal */
    trapFocus?: boolean
}

const props = withDefaults(defineProps<ModalProps>(), {
    size: 'md',
    showHeader: true,
    showCloseButton: true,
    closeOnOverlayClick: true,
    closeOnEscape: true,
    loading: false,
    preventBodyScroll: true,
    zIndex: 1050,
    autoFocus: true,
    trapFocus: true,
})

const emit = defineEmits<{
    'update:show': [show: boolean]
    close: []
    open: []
    'before-open': []
    'after-open': []
    'before-close': []
    'after-close': []
}>()

const modalRef = ref<HTMLElement>()
const previousActiveElement = ref<Element | null>(null)

const titleId = computed(
    () => `modal-title-${Math.random().toString(36).substr(2, 9)}`
)
const descriptionId = computed(
    () => `modal-desc-${Math.random().toString(36).substr(2, 9)}`
)

const overlayClasses = computed(() => [
    'modal-overlay',
    {
        'modal-overlay-loading': props.loading,
    },
])

const containerClasses = computed(() => [
    'modal-container',
    `modal-container-${props.size}`,
    {
        'modal-container-loading': props.loading,
    },
])

const contentClasses = computed(() => [
    'modal-content',
    {
        'modal-content-no-header': !props.showHeader,
        'modal-content-no-footer': !slots.footer,
    },
])

// Handle body scroll prevention
watch(
    () => props.show,
    (newShow) => {
        if (props.preventBodyScroll) {
            if (newShow) {
                document.body.style.overflow = 'hidden'
            } else {
                document.body.style.overflow = ''
            }
        }
    }
)

// Handle escape key
const handleEscape = () => {
    if (props.closeOnEscape && !props.loading) {
        handleClose()
    }
}

// Handle overlay click
const handleOverlayClick = () => {
    if (props.closeOnOverlayClick && !props.loading) {
        handleClose()
    }
}

// Handle close
const handleClose = () => {
    if (!props.loading) {
        emit('update:show', false)
        emit('close')
    }
}

// Focus management
const focusModal = async () => {
    if (props.autoFocus) {
        await nextTick()
        modalRef.value?.focus()
    }
}

const restoreFocus = () => {
    if (previousActiveElement.value && 'focus' in previousActiveElement.value) {
        ;(previousActiveElement.value as HTMLElement).focus()
    }
}

// Focus trap functionality
const trapFocusInModal = (event: KeyboardEvent) => {
    if (!props.trapFocus || !modalRef.value) return

    const focusableElements = modalRef.value.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[
        focusableElements.length - 1
    ] as HTMLElement

    if (event.key === 'Tab') {
        if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                event.preventDefault()
                lastElement?.focus()
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                event.preventDefault()
                firstElement?.focus()
            }
        }
    }
}

// Transition events
const onEnter = () => {
    emit('before-open')
    if (props.show) {
        previousActiveElement.value = document.activeElement
    }
}

const onAfterEnter = () => {
    emit('after-open')
    emit('open')
    focusModal()
    if (props.trapFocus) {
        document.addEventListener('keydown', trapFocusInModal)
    }
}

const onBeforeLeave = () => {
    emit('before-close')
    if (props.trapFocus) {
        document.removeEventListener('keydown', trapFocusInModal)
    }
}

const onAfterLeave = () => {
    emit('after-close')
    restoreFocus()
}

// Cleanup on unmount
onUnmounted(() => {
    if (props.preventBodyScroll) {
        document.body.style.overflow = ''
    }
    if (props.trapFocus) {
        document.removeEventListener('keydown', trapFocusInModal)
    }
})

// Get slots
const slots = defineSlots<{
    default?: any
    title?: any
    description?: any
    footer?: any
    'close-icon'?: any
}>()
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: v-bind(zIndex);
    padding: var(--space-lg);
    overflow-y: auto;
}

.modal-overlay-loading {
    cursor: wait;
}

.modal-container {
    background: var(--surface-card);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
}

.modal-container:focus {
    outline: none;
}

/* Sizes */
.modal-container-xs {
    max-width: 320px;
}

.modal-container-sm {
    max-width: 480px;
}

.modal-container-md {
    max-width: 640px;
}

.modal-container-lg {
    max-width: 800px;
}

.modal-container-xl {
    max-width: 1024px;
}

.modal-container-2xl {
    max-width: 1280px;
}

.modal-container-full {
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 2rem);
}

/* Header */
.modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    padding: var(--space-xl);
    border-bottom: 1px solid var(--surface-border);
    background: var(--surface-ground);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.modal-title-section {
    flex: 1;
    min-width: 0;
}

.modal-title {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-xs) 0;
    line-height: var(--leading-tight);
}

.modal-description {
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
    margin: 0;
    line-height: var(--leading-normal);
}

.modal-close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    color: var(--text-color-secondary);
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
    flex-shrink: 0;
}

.modal-close-button:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-color);
}

.modal-close-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Content */
.modal-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-xl);
}

.modal-content-no-header {
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.modal-content-no-footer {
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

.modal-content-no-header.modal-content-no-footer {
    border-radius: var(--radius-xl);
}

/* Footer */
.modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-md);
    padding: var(--space-xl);
    border-top: 1px solid var(--surface-border);
    background: var(--surface-ground);
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
    transition: opacity var(--transition-normal);
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
    transition: all var(--transition-normal);
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
    transform: scale(0.95) translateY(-20px);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .modal-overlay {
        padding: var(--space-md);
        align-items: flex-end;
    }

    .modal-container {
        max-height: 95vh;
        width: 100%;
    }

    .modal-container-xs,
    .modal-container-sm,
    .modal-container-md,
    .modal-container-lg,
    .modal-container-xl,
    .modal-container-2xl {
        max-width: 100%;
    }

    .modal-header,
    .modal-content,
    .modal-footer {
        padding: var(--space-lg);
    }

    .modal-title {
        font-size: var(--text-lg);
    }
}

@media (max-width: 480px) {
    .modal-header,
    .modal-content,
    .modal-footer {
        padding: var(--space-md);
    }

    .modal-header {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-md);
    }

    .modal-close-button {
        align-self: flex-end;
        order: -1;
    }
}
</style>
