<template>
    <div class="project-management">
        <div class="section-header">
            <h2>Project Management</h2>
            <p>Manage HTTP traffic recording projects and workspaces</p>
        </div>

        <div class="section-content">
            <!-- Current Project Display -->
            <div class="control-group">
                <div class="control-info">
                    <h3>Active Project</h3>
                    <p>Currently active project for recording HTTP traffic</p>
                    <div v-if="currentProject" class="project-info">
                        <div class="project-name">
                            {{ currentProject.metadata.name }}
                        </div>
                        <div class="project-meta">
                            <span class="meta-item">
                                <span class="meta-label">Created:</span>
                                <span class="meta-value">{{
                                    formatDate(
                                        currentProject.metadata.createdAt
                                    )
                                }}</span>
                            </span>
                            <span class="meta-item">
                                <span class="meta-label">Transactions:</span>
                                <span class="meta-value">{{
                                    currentProject.transactionCount
                                }}</span>
                            </span>
                            <span class="meta-item">
                                <span class="meta-label">Size:</span>
                                <span class="meta-value">{{
                                    formatFileSize(currentProject.sizeBytes)
                                }}</span>
                            </span>
                        </div>
                        <div
                            v-if="currentProject.metadata.description"
                            class="project-description"
                        >
                            {{ currentProject.metadata.description }}
                        </div>
                        <div
                            v-if="
                                currentProject.metadata.tags &&
                                currentProject.metadata.tags.length > 0
                            "
                            class="project-tags"
                        >
                            <span
                                v-for="tag in currentProject.metadata.tags"
                                :key="tag"
                                class="tag"
                            >
                                {{ tag }}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="control-actions">
                    <button
                        class="btn btn-outline"
                        @click="showProjectList = true"
                        :disabled="loading"
                    >
                        Switch Project
                    </button>
                    <button
                        class="btn btn-primary"
                        @click="showCreateProject = true"
                        :disabled="loading"
                    >
                        New Project
                    </button>
                </div>
            </div>

            <!-- Project List Modal -->
            <div
                v-if="showProjectList"
                class="modal-overlay"
                @click="closeProjectList"
            >
                <div class="modal-content" @click.stop>
                    <div class="modal-header">
                        <h3>Switch Project</h3>
                        <button class="modal-close" @click="closeProjectList">
                            &times;
                        </button>
                    </div>
                    <div class="modal-body">
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
                        <div v-else class="project-grid">
                            <div
                                v-for="project in projects"
                                :key="project.metadata.id"
                                class="project-card"
                                :class="{ active: isCurrentProject(project) }"
                                @click="selectProject(project)"
                            >
                                <div class="project-card-header">
                                    <div class="project-card-name">
                                        {{ project.metadata.name }}
                                    </div>
                                    <div class="project-card-meta">
                                        {{ project.transactionCount }}
                                        transactions •
                                        {{ formatFileSize(project.sizeBytes) }}
                                    </div>
                                </div>
                                <div
                                    v-if="project.metadata.description"
                                    class="project-card-description"
                                >
                                    {{ project.metadata.description }}
                                </div>
                                <div class="project-card-footer">
                                    <div class="project-card-date">
                                        Created
                                        {{
                                            formatDate(
                                                project.metadata.createdAt
                                            )
                                        }}
                                    </div>
                                    <div
                                        v-if="
                                            project.metadata.tags &&
                                            project.metadata.tags.length > 0
                                        "
                                        class="project-card-tags"
                                    >
                                        <span
                                            v-for="tag in project.metadata.tags.slice(
                                                0,
                                                3
                                            )"
                                            :key="tag"
                                            class="tag tag-sm"
                                        >
                                            {{ tag }}
                                        </span>
                                        <span
                                            v-if="
                                                project.metadata.tags.length > 3
                                            "
                                            class="tag tag-sm tag-more"
                                        >
                                            +{{
                                                project.metadata.tags.length - 3
                                            }}
                                        </span>
                                    </div>
                                </div>
                                <div class="project-card-actions">
                                    <button
                                        class="btn btn-sm btn-outline"
                                        @click.stop="openEditProject(project)"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        class="btn btn-sm btn-outline btn-danger"
                                        @click.stop="deleteProject(project)"
                                        :disabled="isCurrentProject(project)"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Create Project Modal -->
            <div
                v-if="showCreateProject"
                class="modal-overlay"
                @click="closeCreateProject"
            >
                <div class="modal-content" @click.stop>
                    <div class="modal-header">
                        <h3>Create New Project</h3>
                        <button class="modal-close" @click="closeCreateProject">
                            &times;
                        </button>
                    </div>
                    <div class="modal-body">
                        <form @submit.prevent="createProject">
                            <div class="form-group">
                                <label for="project-name">Project Name *</label>
                                <input
                                    id="project-name"
                                    v-model="newProject.name"
                                    type="text"
                                    class="form-input"
                                    placeholder="Enter project name"
                                    required
                                    maxlength="100"
                                />
                            </div>

                            <div class="form-group">
                                <label for="project-description"
                                    >Description</label
                                >
                                <textarea
                                    id="project-description"
                                    v-model="newProject.description"
                                    class="form-textarea"
                                    placeholder="Optional project description"
                                    rows="3"
                                ></textarea>
                            </div>

                            <div class="form-group">
                                <label for="project-tags">Tags</label>
                                <input
                                    id="project-tags"
                                    v-model="tagsInput"
                                    type="text"
                                    class="form-input"
                                    placeholder="Enter tags separated by commas"
                                />
                                <div class="form-help">
                                    Separate multiple tags with commas (e.g.,
                                    "api, testing, production")
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>Project Settings</h4>

                                <div class="form-group">
                                    <label for="max-transactions"
                                        >Max Transactions</label
                                    >
                                    <input
                                        id="max-transactions"
                                        v-model.number="newProject.settings!.maxTransactions"
                                        type="number"
                                        class="form-input"
                                        min="100"
                                        max="100000"
                                    />
                                    <div class="form-help">
                                        Maximum number of transactions to store
                                        (100-100,000)
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="retention-days"
                                        >Retention Period (days)</label
                                    >
                                    <input
                                        id="retention-days"
                                        v-model.number="newProject.settings!.retentionDays"
                                        type="number"
                                        class="form-input"
                                        min="1"
                                        max="365"
                                    />
                                    <div class="form-help">
                                        How long to keep transactions before
                                        cleanup (1-365 days)
                                    </div>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button
                                    type="button"
                                    class="btn btn-outline"
                                    @click="closeCreateProject"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    class="btn btn-primary"
                                    :disabled="
                                        !newProject.name.trim() || createLoading
                                    "
                                >
                                    <span
                                        v-if="createLoading"
                                        class="loading-spinner"
                                    ></span>
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Edit Project Modal -->
            <div
                v-if="showEditProject"
                class="modal-overlay"
                @click="closeEditProject"
            >
                <div class="modal-content" @click.stop>
                    <div class="modal-header">
                        <h3>Edit Project</h3>
                        <button class="modal-close" @click="closeEditProject">
                            &times;
                        </button>
                    </div>
                    <div class="modal-body">
                        <form @submit.prevent="saveEditProject">
                            <div class="form-group">
                                <label for="edit-project-name"
                                    >Project Name *</label
                                >
                                <input
                                    id="edit-project-name"
                                    v-model="editProject.name"
                                    type="text"
                                    class="form-input"
                                    placeholder="Enter project name"
                                    required
                                    maxlength="100"
                                />
                            </div>

                            <div class="form-group">
                                <label for="edit-project-description"
                                    >Description</label
                                >
                                <textarea
                                    id="edit-project-description"
                                    v-model="editProject.description"
                                    class="form-textarea"
                                    placeholder="Optional project description"
                                    rows="3"
                                ></textarea>
                            </div>

                            <div class="form-group">
                                <label for="edit-project-tags">Tags</label>
                                <input
                                    id="edit-project-tags"
                                    v-model="editTagsInput"
                                    type="text"
                                    class="form-input"
                                    placeholder="Enter tags separated by commas"
                                />
                                <div class="form-help">
                                    Separate multiple tags with commas (e.g.,
                                    "api, testing, production")
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>Project Settings</h4>

                                <div class="form-group">
                                    <label for="edit-max-transactions"
                                        >Max Transactions</label
                                    >
                                    <input
                                        id="edit-max-transactions"
                                        v-model.number="editProject.settings!.maxTransactions"
                                        type="number"
                                        class="form-input"
                                        min="100"
                                        max="100000"
                                    />
                                    <div class="form-help">
                                        Maximum number of transactions to store
                                        (100-100,000)
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="edit-retention-days"
                                        >Retention Period (days)</label
                                    >
                                    <input
                                        id="edit-retention-days"
                                        v-model.number="editProject.settings!.retentionDays"
                                        type="number"
                                        class="form-input"
                                        min="1"
                                        max="365"
                                    />
                                    <div class="form-help">
                                        How long to keep transactions before
                                        cleanup (1-365 days)
                                    </div>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button
                                    type="button"
                                    class="btn btn-outline"
                                    @click="closeEditProject"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    class="btn btn-primary"
                                    :disabled="
                                         !editProject.name!.trim() || editLoading
                                     "
                                >
                                    <span
                                        v-if="editLoading"
                                        class="loading-spinner"
                                    ></span>
                                    Save Changes
                                </button>
                            </div>
                        </form>
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
import type {
    ProjectInfo,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '@arachne/api-types'

// Project store
const projectStore = useProjectStore()

// Local state
const showProjectList = ref(false)
const showCreateProject = ref(false)
const showEditProject = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')

// Use project store state
const currentProject = computed(() => projectStore.currentProject)
const projects = computed(() => projectStore.projects)
const loading = computed(() => projectStore.loading)
const projectsLoading = computed(() => projectStore.loading)
const createLoading = ref(false)

// Form state
const newProject = ref<
    CreateProjectRequest & {
        settings: Required<CreateProjectRequest['settings']>
    }
>({
    name: '',
    description: '',
    tags: [],
    settings: {
        maxTransactions: 10000,
        retentionDays: 30,
    },
})

const tagsInput = ref('')

// Edit project state
const editLoading = ref(false)
const editingProject = ref<ProjectInfo | null>(null)
const editProject = ref<
    UpdateProjectRequest & {
        settings: Required<UpdateProjectRequest['settings']>
    }
>({
    name: '',
    description: '',
    tags: [],
    settings: {
        maxTransactions: 10000,
        retentionDays: 30,
    },
})
const editTagsInput = ref('')

// Computed
const parsedTags = computed(() => {
    return tagsInput.value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
})

const parsedEditTags = computed(() => {
    return editTagsInput.value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
})

// Methods
async function loadCurrentProject() {
    await projectStore.loadCurrentProject()
    await projectStore.loadProjects()
}

async function createProject() {
    createLoading.value = true
    try {
        newProject.value.tags = parsedTags.value

        const project = await projectStore.createProject(newProject.value)
        if (project) {
            showMessage('Project created successfully', 'success')
            closeCreateProject()
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

async function selectProject(project: ProjectInfo) {
    const success = await projectStore.switchProject(project.metadata.id)
    if (success) {
        showMessage(`Switched to project: ${project.metadata.name}`, 'success')
        closeProjectList()
    } else {
        showMessage(projectStore.error || 'Failed to switch project', 'error')
    }
}

async function openEditProject(project: ProjectInfo) {
    editingProject.value = project

    // Pre-populate form with current project data
    editProject.value = {
        name: project.metadata.name,
        description: project.metadata.description || '',
        tags: project.metadata.tags || [],
        settings: {
            maxTransactions:
                project.metadata.settings?.maxTransactions ?? 10000,
            retentionDays: project.metadata.settings?.retentionDays ?? 30,
        },
    }

    // Set tags input
    editTagsInput.value = (project.metadata.tags || []).join(', ')

    showEditProject.value = true
}

async function saveEditProject() {
    if (!editingProject.value) return

    editLoading.value = true
    try {
        editProject.value.tags = parsedEditTags.value

        const updatedProject = await projectStore.updateProject(
            editingProject.value.metadata.id,
            editProject.value
        )
        if (updatedProject) {
            showMessage('Project updated successfully', 'success')
            closeEditProject()
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

async function deleteProject(project: ProjectInfo) {
    if (
        !confirm(
            `Are you sure you want to delete project "${project.metadata.name}"? This action cannot be undone.`
        )
    ) {
        return
    }

    const success = await projectStore.deleteProject(project.metadata.id)
    if (success) {
        showMessage(
            `Project "${project.metadata.name}" deleted successfully`,
            'success'
        )
    } else {
        showMessage(projectStore.error || 'Failed to delete project', 'error')
    }
}

function isCurrentProject(project: ProjectInfo): boolean {
    return projectStore.currentProject?.metadata.id === project.metadata.id
}

function closeProjectList() {
    showProjectList.value = false
}

function closeCreateProject() {
    showCreateProject.value = false
    resetNewProject()
}

function closeEditProject() {
    showEditProject.value = false
    resetEditProject()
}

function resetNewProject() {
    newProject.value = {
        name: '',
        description: '',
        tags: [],
        settings: {
            maxTransactions: 10000,
            retentionDays: 30,
        },
    }
    tagsInput.value = ''
}

function resetEditProject() {
    editingProject.value = null
    editProject.value = {
        name: '',
        description: '',
        tags: [],
        settings: {
            maxTransactions: 10000,
            retentionDays: 30,
        },
    }
    editTagsInput.value = ''
}

function showMessage(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    message.value = msg
    messageType.value = type
    setTimeout(() => {
        message.value = ''
    }, 5000)
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString()
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
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

.control-group {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-xl);
    padding: var(--space-xl);
    background: var(--surface-section);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-border);
}

.control-info {
    flex: 1;
}

.control-info h3 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-sm) 0;
}

.control-info p {
    color: var(--text-color-secondary);
    margin: 0 0 var(--space-lg) 0;
    line-height: var(--leading-relaxed);
}

.project-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.project-name {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

.project-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-lg);
}

.meta-item {
    display: flex;
    gap: var(--space-xs);
    font-size: var(--text-sm);
}

.meta-label {
    color: var(--text-color-secondary);
    font-weight: var(--font-medium);
}

.meta-value {
    color: var(--text-color);
}

.project-description {
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
}

.project-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.tag {
    display: inline-flex;
    align-items: center;
    padding: var(--space-xs) var(--space-md);
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
}

.tag-sm {
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.6rem;
}

.tag-more {
    background: var(--color-neutral-200);
    color: var(--color-neutral-600);
}

.control-actions {
    display: flex;
    gap: var(--space-md);
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

.btn-outline {
    background-color: transparent;
    color: var(--primary-color);
    border-color: var(--primary-color);
}

.btn-outline:hover:not(:disabled) {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.btn-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-xs);
    min-width: auto;
}

.btn-danger {
    color: var(--color-error-600);
    border-color: var(--color-error-600);
}

.btn-danger:hover:not(:disabled) {
    background-color: var(--color-error-600);
    color: white;
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

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

.loading-message,
.empty-message {
    text-align: center;
    color: var(--text-color-secondary);
    padding: var(--space-3xl);
}

/* Project Grid */
.project-grid {
    display: grid;
    gap: var(--space-lg);
}

.project-card {
    padding: var(--space-lg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
}

.project-card:hover {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-md);
}

.project-card.active {
    border-color: var(--primary-color);
    background: var(--color-primary-50);
}

.project-card-header {
    margin-bottom: var(--space-md);
}

.project-card-name {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-color);
    margin-bottom: var(--space-xs);
}

.project-card-meta {
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
}

.project-card-description {
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    margin-bottom: var(--space-md);
}

.project-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
}

.project-card-date {
    font-size: var(--text-xs);
    color: var(--text-color-muted);
}

.project-card-tags {
    display: flex;
    gap: var(--space-xs);
}

.project-card-actions {
    display: flex;
    gap: var(--space-sm);
}

/* Form Styles */
.form-group {
    margin-bottom: var(--space-lg);
}

.form-group label {
    display: block;
    font-weight: var(--font-medium);
    color: var(--text-color);
    margin-bottom: var(--space-sm);
}

.form-input,
.form-textarea {
    width: 100%;
    padding: var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--text-color);
    background: var(--surface-card);
    transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.form-help {
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
    margin-top: var(--space-xs);
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    cursor: pointer;
    margin-bottom: var(--space-sm) !important;
}

.form-checkbox {
    width: auto !important;
    margin: 0 !important;
}

.checkbox-text {
    font-weight: var(--font-normal);
}

.form-section {
    margin-top: var(--space-xl);
    padding-top: var(--space-xl);
    border-top: 1px solid var(--surface-border);
}

.form-section h4 {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-color);
    margin: 0 0 var(--space-lg) 0;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    margin-top: var(--space-xl);
    padding-top: var(--space-xl);
    border-top: 1px solid var(--surface-border);
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

/* Responsive */
@media (max-width: 768px) {
    .control-group {
        flex-direction: column;
        gap: var(--space-lg);
    }

    .control-actions {
        justify-content: stretch;
    }

    .btn {
        flex: 1;
    }

    .modal-content {
        margin: var(--space-lg);
        max-width: calc(100vw - 2 * var(--space-lg));
    }

    .project-card-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-sm);
    }

    .form-actions {
        flex-direction: column;
    }
}
</style>
