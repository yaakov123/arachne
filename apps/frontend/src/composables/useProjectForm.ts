import { ref, computed } from 'vue'
import type { Project } from '@arachne/database'

export type ProjectFormMode = 'create' | 'edit'

export interface ProjectFormData {
    name: string
    description: string
    tags: string[]
    settings: {
        maxTransactions: number
        retentionDays: number
        hostFilter: string[]
        hostFilterMode: 'blacklist' | 'whitelist'
        maxBodySize: number
    }
}

const DEFAULT_PROJECT_SETTINGS = {
    maxTransactions: 10000,
    retentionDays: 30,
    hostFilter: [],
    hostFilterMode: 'blacklist' as const,
    maxBodySize: 10 * 1024 * 1024, // 10MB
}

export function useProjectForm(mode: ProjectFormMode = 'create') {
    const formData = ref<ProjectFormData>(createEmptyForm())
    const loading = ref(false)
    const originalProject = ref<Project | null>(null)

    function createEmptyForm(): ProjectFormData {
        return {
            name: '',
            description: '',
            tags: [],
            settings: { ...DEFAULT_PROJECT_SETTINGS },
        }
    }

    function populateForm(project: Project) {
        originalProject.value = project
        formData.value = {
            name: project.name,
            description: project.description || '',
            tags: project.tags || [],
            settings: {
                maxTransactions:
                    project.settings?.maxTransactions ??
                    DEFAULT_PROJECT_SETTINGS.maxTransactions,
                retentionDays:
                    project.settings?.retentionDays ??
                    DEFAULT_PROJECT_SETTINGS.retentionDays,
                hostFilter:
                    project.settings?.hostFilter ??
                    DEFAULT_PROJECT_SETTINGS.hostFilter,
                hostFilterMode:
                    project.settings?.hostFilterMode ??
                    DEFAULT_PROJECT_SETTINGS.hostFilterMode,
                maxBodySize:
                    project.settings?.maxBodySize ??
                    DEFAULT_PROJECT_SETTINGS.maxBodySize,
            },
        }
    }

    function resetForm() {
        formData.value = createEmptyForm()
        originalProject.value = null
        loading.value = false
    }

    function createProjectPayload(): Omit<
        Project,
        'id' | 'createdAt' | 'updatedAt'
    > {
        return {
            name: formData.value.name,
            description: formData.value.description,
            tags: formData.value.tags,
            settings: { ...formData.value.settings },
        }
    }

    function createUpdatePayload(): { id: string; data: ProjectFormData } {
        if (!originalProject.value) {
            throw new Error(
                'Cannot create update payload without original project'
            )
        }
        return {
            id: originalProject.value.id,
            data: { ...formData.value },
        }
    }

    const isValid = computed(() => {
        return formData.value.name.trim().length > 0
    })

    const hasChanges = computed(() => {
        if (mode === 'create') return true
        if (!originalProject.value) return false

        const original = originalProject.value
        const current = formData.value

        return (
            original.name !== current.name ||
            (original.description || '') !== current.description ||
            JSON.stringify(original.tags || []) !==
                JSON.stringify(current.tags) ||
            JSON.stringify(original.settings || DEFAULT_PROJECT_SETTINGS) !==
                JSON.stringify(current.settings)
        )
    })

    return {
        formData,
        loading,
        originalProject,
        isValid,
        hasChanges,
        populateForm,
        resetForm,
        createProjectPayload,
        createUpdatePayload,
    }
}
