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
                    <div class="section-title"></div>
                    <div class="section-actions">
                        <button
                            class="btn btn-primary"
                            @click="toggleCreateProject"
                            :disabled="loading"
                        >
                            {{ showCreateProject ? 'Cancel' : 'New Project' }}
                        </button>
                    </div>
                </div>

                <!-- Inline Create Project Form -->
                <div v-if="showCreateProject" class="inline-form-section">
                    <div class="inline-form-header">
                        <h3>Create New Project</h3>
                    </div>
                    <div class="inline-form-content">
                        <ProjectForm
                            v-model="createFormData"
                            :loading="createLoading"
                            submit-text="Create Project"
                            id-prefix="create"
                            @submit="createProject"
                            @cancel="cancelCreateProject"
                        />
                    </div>
                </div>

                <!-- Project List with inline edit -->
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
                        <div
                            v-for="project in projects"
                            :key="project.id"
                            class="project-item-wrapper"
                        >
                            <!-- Project Item (normal view) -->
                            <ProjectItem
                                v-if="editingProjectId !== project.id"
                                :project="project"
                                :is-active="isCurrentProject(project)"
                                @select="selectProject"
                                @edit="openEditProject"
                                @delete="deleteProject"
                            />

                            <!-- Inline Edit Form -->
                            <div v-else class="inline-form-section">
                                <div class="inline-form-header">
                                    <h3>Edit Project</h3>
                                </div>
                                <div class="inline-form-content">
                                    <ProjectForm
                                        v-model="editFormData"
                                        :loading="editLoading"
                                        submit-text="Save Changes"
                                        id-prefix="edit"
                                        @submit="saveEditProject"
                                        @cancel="cancelEditProject"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Message Display -->
            <div v-if="message" class="message" :class="messageType">
                {{ message }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProjectStore } from '@/stores/project'

import ProjectItem from './ProjectItem.vue'
import ProjectForm from './ProjectForm.vue'
import type { Project } from '@arachne/database'

// Project store
const projectStore = useProjectStore()

// Local state
const showCreateProject = ref(false)
const editingProjectId = ref<string | null>(null)
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')
const createLoading = ref(false)
const editLoading = ref(false)

// Form data
const createFormData = ref<Project>({
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

const editFormData = ref<Project>({
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
})

// Use project store state
const currentProject = computed(() => projectStore.currentProject)
const projects = computed(() => projectStore.projects)
const loading = computed(() => projectStore.loading)
const projectsLoading = computed(() => projectStore.loading)

// Methods
async function loadCurrentProject() {
    await projectStore.loadCurrentProject()
    await projectStore.loadProjects()
}

function isCurrentProject(project: Project): boolean {
    return currentProject.value?.id === project.id
}

function toggleCreateProject() {
    if (showCreateProject.value) {
        cancelCreateProject()
    } else {
        showCreateProject.value = true
        resetCreateForm()
    }
}

function resetCreateForm() {
    createFormData.value = {
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

function cancelCreateProject() {
    showCreateProject.value = false
    resetCreateForm()
}

async function createProject() {
    createLoading.value = true
    try {
        const project = await projectStore.createProject(createFormData.value)
        if (project) {
            showMessage('Project created successfully', 'success')
            cancelCreateProject()
        } else {
            showMessage(
                projectStore.error || 'Failed to create project',
                'error'
            )
        }
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'Failed to create project'
        showMessage(errorMessage, 'error')
    } finally {
        createLoading.value = false
    }
}

async function selectProject(project: Project) {
    // Close any open edit forms when selecting a project
    if (editingProjectId.value) {
        cancelEditProject()
    }

    const success = await projectStore.switchProject(project.id)
    if (success) {
        showMessage(`Switched to project: ${project.name}`, 'success')
    } else {
        showMessage(projectStore.error || 'Failed to switch project', 'error')
    }
}

async function openEditProject(project: Project) {
    // Close create form if open
    if (showCreateProject.value) {
        cancelCreateProject()
    }

    // Close any other edit forms
    if (editingProjectId.value && editingProjectId.value !== project.id) {
        cancelEditProject()
    }

    editingProjectId.value = project.id
    populateEditForm(project)
}

function populateEditForm(project: Project) {
    editFormData.value = {
        id: project.id,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        name: project.name,
        description: project.description || '',
        tags: project.tags || [],
        settings: {
            maxTransactions: project.settings?.maxTransactions ?? 10000,
            retentionDays: project.settings?.retentionDays ?? 30,
            hostFilter: project.settings?.hostFilter ?? [],
            hostFilterMode: project.settings?.hostFilterMode ?? 'blacklist',
            maxBodySize: project.settings?.maxBodySize ?? 10 * 1024 * 1024,
        },
    }
}

function cancelEditProject() {
    editingProjectId.value = null
}

async function saveEditProject() {
    if (!editingProjectId.value) return

    editLoading.value = true
    try {
        const updatedProject = await projectStore.updateProject({
            id: editingProjectId.value,
            data: editFormData.value,
        })
        if (updatedProject) {
            showMessage('Project updated successfully', 'success')
            cancelEditProject()
        } else {
            showMessage(
                projectStore.error || 'Failed to update project',
                'error'
            )
        }
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'Failed to update project'
        showMessage(errorMessage, 'error')
    } finally {
        editLoading.value = false
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

    // Close edit form if this project is being edited
    if (editingProjectId.value === project.id) {
        cancelEditProject()
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
    loadCurrentProject()
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

/* Inline Form Styles */
.inline-form-section {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-lg);
    overflow: hidden;
}

.inline-form-header {
    padding: var(--space-lg) var(--space-xl);
    background: var(--surface-ground);
    border-bottom: 1px solid var(--surface-border);
}

.inline-form-header h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0;
}

.inline-form-content {
    padding: var(--space-xl);
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

.project-item-wrapper {
    transition: all var(--transition-fast);
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

    .inline-form-header,
    .inline-form-content {
        padding: var(--space-lg);
    }
}
</style>
