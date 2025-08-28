<template>
    <div class="project-management">
        <div class="section-header">
            <h2>Project Management</h2>
            <p>Manage HTTP traffic recording projects and workspaces</p>
        </div>

        <div class="section-content">
            <!-- Projects Section -->
            <div class="projects-section">
                <div class="section-header-with-actions">
                    <div class="section-title">
                        <h3>Projects</h3>
                        <p>Create and manage your traffic recording projects</p>
                    </div>
                    <div class="section-actions">
                        <button
                            class="btn btn-primary"
                            @click="openCreateProject"
                            :disabled="loading"
                        >
                            New Project
                        </button>
                    </div>
                </div>

                <!-- Project List -->
                <div class="project-list-wrapper">
                    <div v-if="projectsLoading" class="loading-message">
                        Loading projects...
                    </div>
                    <div
                        v-else-if="projects.length === 0"
                        class="empty-message"
                    >
                        No projects found. Create your first project to get
                        started.
                    </div>
                    <div v-else class="project-list">
                        <ProjectItem
                            v-for="project in projects"
                            :key="project.id"
                            :project="project"
                            :is-active="isCurrentProject(project)"
                            @select="selectProject"
                            @edit="openEditProject"
                            @delete="deleteProject"
                        />
                    </div>
                </div>
            </div>

            <!-- Message Display -->
            <div v-if="message" class="message" :class="messageType">
                {{ message }}
            </div>
        </div>

        <!-- Project Modal -->
        <ProjectModal
            :show="showModal"
            :mode="modalMode"
            :project="editingProject"
            :loading="modalLoading"
            @close="closeModal"
            @submit="handleModalSubmit"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import ProjectItem from './ProjectItem.vue'
import ProjectModal from './ProjectModal.vue'
import type { Project } from '@arachne/database'
import type {
    ProjectFormMode,
    ProjectFormData,
} from '@/composables/useProjectForm'
import {
    isProjectCreateInput,
    isProjectUpdateInput,
    type ProjectCreateInput,
    type ProjectUpdateInput,
} from '@/services/trpc'

// Project store
const projectStore = useProjectStore()

// Modal state
const showModal = ref(false)
const modalMode = ref<ProjectFormMode>('create')
const editingProject = ref<Project | null>(null)
const modalLoading = ref(false)

// Message state
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')

// Use project store state
const currentProject = computed(() => projectStore.currentProject)
const projects = computed(() => projectStore.projects)
const loading = computed(() => projectStore.loading)
const projectsLoading = computed(() => projectStore.loading)

// Methods
async function loadProjects() {
    await projectStore.loadCurrentProject()
    await projectStore.loadProjects()
}

function isCurrentProject(project: Project): boolean {
    return currentProject.value?.id === project.id
}

function openCreateProject() {
    modalMode.value = 'create'
    editingProject.value = null
    showModal.value = true
}

function openEditProject(project: Project) {
    modalMode.value = 'edit'
    editingProject.value = project
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    modalLoading.value = false
    editingProject.value = null
}

async function handleModalSubmit(
    payload: ProjectCreateInput | ProjectUpdateInput
) {
    modalLoading.value = true

    try {
        if (modalMode.value === 'create') {
            if (!isProjectCreateInput(payload)) {
                console.error('Received unknown payload:', {
                    payload,
                    mode: modalMode.value,
                })
                return
            }
            const project = await projectStore.createProject(payload)
            if (project) {
                showMessage('Project created successfully', 'success')
                closeModal()
            } else {
                showMessage(
                    projectStore.error || 'Failed to create project',
                    'error'
                )
            }
        }

        if (modalMode.value === 'edit') {
            if (!isProjectUpdateInput(payload)) {
                console.error('Received unknown payload:', {
                    payload,
                    mode: modalMode.value,
                })
                return
            }
            const updatedProject = await projectStore.updateProject(payload)
            if (updatedProject) {
                showMessage('Project updated successfully', 'success')
                closeModal()
            } else {
                showMessage(
                    projectStore.error || 'Failed to update project',
                    'error'
                )
            }
        }
    } catch (error) {
        const errorMessage =
            error instanceof Error
                ? error.message
                : `Failed to ${modalMode.value} project`
        showMessage(errorMessage, 'error')
    } finally {
        modalLoading.value = false
    }
}

async function selectProject(project: Project) {
    const success = await projectStore.switchProject(project.id)
    if (success) {
        showMessage(`Switched to project: ${project.name}`, 'success')
    } else {
        showMessage(projectStore.error || 'Failed to switch project', 'error')
    }
}

async function deleteProject(project: Project) {
    if (
        !confirm(
            `Are you sure you want to delete project "${project.name}"? This action cannot be undone.`
        )
    ) {
        return
    }

    const success = await projectStore.deleteProject(project.id)
    if (success) {
        showMessage(`Project "${project.name}" deleted successfully`, 'success')
    } else {
        showMessage(projectStore.error || 'Failed to delete project', 'error')
    }
}

function showMessage(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    message.value = msg
    messageType.value = type
    setTimeout(() => {
        message.value = ''
    }, 2000)
}

// Load data on mount
onMounted(() => {
    loadProjects()
})
</script>

<style scoped>
.project-management {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
}

.section-header {
    margin-bottom: var(--space-xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--surface-border);
}

.section-header h2 {
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-sm) 0;
}

.section-header p {
    color: var(--text-color-secondary);
    margin: 0;
}

.section-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
}

.projects-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.section-header-with-actions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--surface-border);
}

.section-title h3 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-sm) 0;
}

.section-title p {
    color: var(--text-color-secondary);
    margin: 0;
    line-height: var(--leading-relaxed);
}

.section-actions {
    flex-shrink: 0;
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 120px;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-700);
}

/* Message */
.message {
    padding: var(--space-lg);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
}

.message.success {
    background-color: var(--color-success-50);
    color: var(--color-success-700);
    border: 1px solid var(--color-success-200);
}

.message.error {
    background-color: var(--color-error-50);
    color: var(--color-error-700);
    border: 1px solid var(--color-error-200);
}

.message.info {
    background-color: var(--color-info-50);
    color: var(--color-info-700);
    border: 1px solid var(--color-info-200);
}

/* Project List Wrapper */
.project-list-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.project-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.loading-message,
.empty-message {
    text-align: center;
    color: var(--text-color-secondary);
    padding: var(--space-3xl);
}

/* Responsive */
@media (max-width: 768px) {
    .section-header-with-actions {
        flex-direction: column;
        gap: var(--space-lg);
    }

    .section-actions {
        align-self: stretch;
    }

    .section-actions .btn {
        width: 100%;
    }
}
</style>
