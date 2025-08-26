<template>
    <div v-if="show" class="modal-overlay" @click="handleCancel">
        <div class="modal-content" @click.stop>
            <div class="modal-header">
                <h3>Edit Project</h3>
                <button class="modal-close" @click="handleCancel">
                    &times;
                </button>
            </div>
            <div class="modal-body">
                <ProjectForm
                    v-model="formData"
                    :loading="loading"
                    submit-text="Save Changes"
                    id-prefix="edit"
                    @submit="handleSubmit"
                    @cancel="handleCancel"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ProjectInfo, UpdateProjectRequest } from '@arachne/api-types'
import ProjectForm from './ProjectForm.vue'

interface Props {
    show: boolean
    project?: ProjectInfo | null
    loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    project: null,
    loading: false,
})

const emit = defineEmits<{
    close: []
    submit: [data: UpdateProjectRequest]
}>()

const formData = ref<UpdateProjectRequest>({
    name: '',
    description: '',
    tags: [],
    settings: {
        maxTransactions: 10000,
        retentionDays: 30,
        ignoredHosts: [],
        maxBodySize: 10 * 1024 * 1024,
    },
})

// Reset form when modal is shown or project changes
watch([() => props.show, () => props.project], ([newShow, newProject]) => {
    if (newShow && newProject) {
        populateForm(newProject)
    }
})

function populateForm(project: ProjectInfo) {
    formData.value = {
        name: project.metadata.name,
        description: project.metadata.description || '',
        tags: project.metadata.tags || [],
        settings: {
            maxTransactions:
                project.metadata.settings?.maxTransactions ?? 10000,
            retentionDays: project.metadata.settings?.retentionDays ?? 30,
            ignoredHosts: project.metadata.settings?.ignoredHosts ?? [],
            maxBodySize:
                project.metadata.settings?.maxBodySize ?? 10 * 1024 * 1024,
        },
    }
}

function handleSubmit() {
    emit('submit', formData.value)
}

function handleCancel() {
    emit('close')
}
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
    z-index: var(--z-modal);
    padding: var(--space-lg);
}

.modal-content {
    background: var(--surface-card);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    max-width: 600px;
    width: 100%;
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
}

.modal-header h3 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0;
}

.modal-close {
    background: none;
    border: none;
    font-size: var(--text-2xl);
    color: var(--text-color-secondary);
    cursor: pointer;
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
}

.modal-close:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.modal-body {
    padding: var(--space-xl);
    overflow-y: auto;
    flex: 1;
}

/* Responsive */
@media (max-width: 768px) {
    .modal-content {
        margin: var(--space-lg);
        max-width: calc(100vw - 2 * var(--space-lg));
    }
}
</style>
