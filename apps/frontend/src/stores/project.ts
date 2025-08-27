import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../services/http'
import type {
    ProjectInfo,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '@arachne/api-types'

export const useProjectStore = defineStore('project', () => {
    // State
    const currentProject = ref<ProjectInfo | null>(null)
    const projects = ref<ProjectInfo[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Computed
    const currentProjectId = computed(
        () => currentProject.value?.metadata.id || null
    )
    const hasActiveProject = computed(() => !!currentProject.value)

    // Actions
    async function loadCurrentProject(): Promise<void> {
        try {
            loading.value = true
            error.value = null

            const response = await api.getCurrentProject()
            if (response.ok && response.project) {
                currentProject.value = response.project
            } else {
                currentProject.value = null
            }
        } catch (err) {
            error.value =
                err instanceof Error
                    ? err.message
                    : 'Failed to load current project'
            currentProject.value = null
        } finally {
            loading.value = false
        }
    }

    async function loadProjects(): Promise<void> {
        try {
            const response = await api.getProjects()
            if (response.ok) {
                projects.value = response.projects
            }
        } catch (err) {
            console.error('Failed to load projects:', err)
        }
    }

    async function switchProject(projectId: string): Promise<boolean> {
        try {
            loading.value = true
            error.value = null

            const response = await api.switchProject(projectId)
            if (response.ok) {
                // Find the project in our list and set it as current
                const project = projects.value.find(
                    (p) => p.metadata.id === projectId
                )
                if (project) {
                    currentProject.value = project
                }
                return true
            } else {
                error.value = 'Failed to switch project'
                return false
            }
        } catch (err) {
            error.value =
                err instanceof Error ? err.message : 'Failed to switch project'
            return false
        } finally {
            loading.value = false
        }
    }

    async function createProject(
        request: CreateProjectRequest
    ): Promise<ProjectInfo | null> {
        try {
            loading.value = true
            error.value = null

            const response = await api.createProject(request)
            if (response.ok && response.project) {
                // Reload projects to get updated list
                await loadProjects()
                // Set as current project
                currentProject.value = response.project
                return response.project
            } else {
                error.value = 'Failed to create project'
                return null
            }
        } catch (err) {
            error.value =
                err instanceof Error ? err.message : 'Failed to create project'
            return null
        } finally {
            loading.value = false
        }
    }

    async function updateProject(
        projectId: string,
        request: UpdateProjectRequest
    ): Promise<ProjectInfo | null> {
        try {
            loading.value = true
            error.value = null

            const response = await api.updateProject(projectId, request)
            if (response.ok && response.project) {
                // Update the projects list
                const index = projects.value.findIndex(
                    (p) => p.metadata.id === projectId
                )
                if (index !== -1) {
                    projects.value[index] = response.project
                }
                // Update current project if it's the one being edited
                if (currentProject.value?.metadata.id === projectId) {
                    currentProject.value = response.project
                }
                return response.project
            } else {
                error.value = 'Failed to update project'
                return null
            }
        } catch (err) {
            error.value =
                err instanceof Error ? err.message : 'Failed to update project'
            return null
        } finally {
            loading.value = false
        }
    }

    async function deleteProject(projectId: string): Promise<boolean> {
        try {
            loading.value = true
            error.value = null

            await api.deleteProject(projectId)

            // Remove from projects list
            projects.value = projects.value.filter(
                (p) => p.metadata.id !== projectId
            )

            // If deleted project was current, clear it
            if (currentProject.value?.metadata.id === projectId) {
                currentProject.value =
                    projects.value.length > 0 ? projects.value[0] : null
            }

            return true
        } catch (err) {
            error.value =
                err instanceof Error ? err.message : 'Failed to delete project'
            return false
        } finally {
            loading.value = false
        }
    }

    function clearError(): void {
        error.value = null
    }

    return {
        // State
        currentProject,
        projects,
        loading,
        error,

        // Computed
        currentProjectId,
        hasActiveProject,

        // Actions
        loadCurrentProject,
        loadProjects,
        switchProject,
        createProject,
        updateProject,
        deleteProject,
        clearError,
    }
})
