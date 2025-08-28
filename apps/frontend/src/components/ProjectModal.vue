<template>
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal-content" @click.stop>
            <div class="modal-header">
                <h3>
                    {{
                        mode === 'create'
                            ? 'Create New Project'
                            : 'Edit Project'
                    }}
                </h3>
                <button
                    class="modal-close"
                    @click="handleCancel"
                    :disabled="loading"
                >
                    &times;
                </button>
            </div>
            <div class="modal-body">
                <ProjectForm
                    v-model="formData"
                    :loading="loading"
                    :submit-text="
                        mode === 'create' ? 'Create Project' : 'Save Changes'
                    "
                    :id-prefix="mode"
                    @submit="handleSubmit"
                    @cancel="handleCancel"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue'
import ProjectForm from './ProjectForm.vue'
import {
    useProjectForm,
    type ProjectFormMode,
} from '@/composables/useProjectForm'
import type { Project } from '@arachne/database'
import type { ProjectCreateInput, ProjectUpdateInput } from '@/services/trpc'

interface Props {
    show: boolean
    mode: ProjectFormMode
    project?: Project | null
    loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    project: null,
    loading: false,
})

const emit = defineEmits<{
    close: []
    submit: [payload: ProjectCreateInput | ProjectUpdateInput]
}>()

const {
    formData,
    isValid,
    hasChanges,
    populateForm,
    resetForm,
    createProjectPayload,
    createUpdatePayload,
} = useProjectForm(props.mode)

// Use loading from props
const loading = computed(() => props.loading)

// Watch for modal show/hide and project changes
watch(
    [() => props.show, () => props.project, () => props.mode],
    ([newShow, newProject, newMode]) => {
        if (newShow) {
            if (newMode === 'edit' && newProject) {
                populateForm(newProject)
            } else if (newMode === 'create') {
                resetForm()
            }
        }
    }
)

function handleSubmit() {
    if (!isValid.value) return

    try {
        const payload =
            props.mode === 'create'
                ? createProjectPayload()
                : createUpdatePayload()

        emit('submit', payload)
    } catch (error) {
        console.error('Error creating form payload:', error)
    }
}

function handleCancel() {
    if (loading.value) return

    if (props.mode === 'edit' && hasChanges.value) {
        if (
            !confirm(
                'You have unsaved changes. Are you sure you want to cancel?'
            )
        ) {
            return
        }
    }

    resetForm()
    emit('close')
}

function handleOverlayClick() {
    if (!loading.value) {
        handleCancel()
    }
}

// Component is controlled by parent loading state
</script>

<style scoped>
/* Modal Styles */
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
    z-index: var(--z-modal, 1000);
    padding: var(--space-lg);
}

.modal-content {
    background: var(--surface-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xl);
    border-bottom: 1px solid var(--surface-border);
    background: var(--surface-ground);
}

.modal-header h3 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0;
}

.modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    color: var(--text-color-secondary);
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 24px;
    font-weight: bold;
    line-height: 1;
    transition: all var(--transition-fast);
}

.modal-close:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-color);
}

.modal-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.modal-body {
    padding: var(--space-xl);
    overflow-y: auto;
    flex: 1;
}

/* Responsive */
@media (max-width: 768px) {
    .modal-overlay {
        padding: var(--space-md);
    }

    .modal-content {
        max-height: 95vh;
    }

    .modal-header,
    .modal-body {
        padding: var(--space-lg);
    }
}
</style>
