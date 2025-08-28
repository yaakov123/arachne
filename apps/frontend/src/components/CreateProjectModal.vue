<template>
    <div v-if="show" class="modal-overlay" @click="handleCancel">
        <div class="modal-content" @click.stop>
            <div class="modal-header">
                <h3>Create New Project</h3>
                <button class="modal-close" @click="handleCancel">
                    &times;
                </button>
            </div>
            <div class="modal-body">
                <ProjectForm
                    v-model="formData"
                    :loading="loading"
                    submit-text="Create Project"
                    id-prefix="create"
                    @submit="handleSubmit"
                    @cancel="handleCancel"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import ProjectForm from './ProjectForm.vue'
import type { ProjectCreateInput } from '@/services/trpc'
import type { Project } from '@arachne/database'

interface Props {
    show: boolean
    loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
})

const emit = defineEmits<{
    close: []
    submit: [data: ProjectCreateInput]
}>()

const formData = ref<Project>({
    id: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    name: '',
    description: '',
    tags: [],
    settings: {
        maxTransactions: 10000,
        retentionDays: 30,
        hostFilter: [],
        hostFilterMode: 'blacklist',
        maxBodySize: 10 * 1024 * 1024, // 10MB default
    },
})

// Reset form when modal is shown
watch(
    () => props.show,
    (newShow) => {
        if (newShow) {
            resetForm()
        }
    }
)

function resetForm() {
    formData.value = {
        id: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        name: '',
        description: '',
        tags: [],
        settings: {
            maxTransactions: 10000,
            retentionDays: 30,
            hostFilter: [],
            hostFilterMode: 'blacklist',
            maxBodySize: 10 * 1024 * 1024,
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
