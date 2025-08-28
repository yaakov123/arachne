import { defineStore } from 'pinia'
import type { Project } from '@arachne/database'
import { ref } from 'vue'
import {
    trpc,
    type ProjectCreateInput,
    type ProjectUpdateInput,
} from '@/services/trpc'

export const useProjectStore = defineStore('project', () => {
    const projects = ref<Project[]>([])
    const currentProject = ref<Project | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const loadCurrentProject = async () => {
        loading.value = true
        const response = await trpc.projects.getCurrent.query()
        currentProject.value = response.currentProject
        loading.value = false
    }

    const loadProjects = async () => {
        loading.value = true
        const response = await trpc.projects.list.query()
        projects.value = response.projects
        loading.value = false
    }

    const createProject = async (project: ProjectCreateInput) => {
        loading.value = true
        const response = await trpc.projects.create.mutate(project)
        projects.value.push(response)
        loading.value = false
        return response
    }

    const updateProject = async (project: ProjectUpdateInput) => {
        loading.value = true
        const response = await trpc.projects.update.mutate({
            id: project.id,
            data: project.data,
        })

        console.log('response', response)

        projects.value = projects.value.map((p) => {
            if (p.id === response.project.id) {
                return response.project
            }
            return p
        })
        loading.value = false
        return response
    }

    const deleteProject = async (projectId: string) => {
        loading.value = true
        try {
            await trpc.projects.delete.mutate({ id: projectId })
        } catch (e) {
            error.value =
                e instanceof Error ? e.message : 'Failed to delete project'
            return false
        } finally {
            loading.value = false
        }
        return true
    }

    const switchProject = async (projectId: string) => {
        loading.value = true

        try {
            await trpc.projects.activate.mutate({ id: projectId })
        } catch (error) {
            loading.value = false
            return false
        }

        const newProject = projects.value.find((p) => p.id === projectId)
        if (newProject) {
            currentProject.value = newProject
        }
        loading.value = false
        return true
    }

    return {
        projects,
        currentProject,
        loading,
        error,
        loadCurrentProject,
        loadProjects,
        createProject,
        updateProject,
        deleteProject,
        switchProject,
    }
})
