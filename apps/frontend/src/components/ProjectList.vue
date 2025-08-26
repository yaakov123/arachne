<template>
    <div class="project-list-container">
        <div v-if="loading" class="loading-message">Loading projects...</div>
        <div v-else-if="projects.length === 0" class="empty-message">
            No projects found. Create your first project to get started.
        </div>
        <div v-else class="project-list">
            <ProjectItem
                v-for="project in projects"
                :key="project.metadata.id"
                :project="project"
                :is-active="isCurrentProject(project)"
                @select="$emit('select', project)"
                @edit="$emit('edit', project)"
                @delete="$emit('delete', project)"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ProjectInfo } from '@arachne/api-types'
import ProjectItem from './ProjectItem.vue'

interface Props {
    projects: ProjectInfo[]
    currentProject?: ProjectInfo | null
    loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    currentProject: null,
    loading: false,
})

defineEmits<{
    select: [project: ProjectInfo]
    edit: [project: ProjectInfo]
    delete: [project: ProjectInfo]
}>()

function isCurrentProject(project: ProjectInfo): boolean {
    return props.currentProject?.metadata.id === project.metadata.id
}
</script>

<style scoped>
.project-list-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.loading-message,
.empty-message {
    text-align: center;
    color: var(--text-color-secondary);
    padding: var(--space-3xl);
}

.project-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}
</style>
