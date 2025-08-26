<template>
    <div class="project-dropdown" ref="dropdownRef">
        <button
            class="project-trigger"
            @click="toggleDropdown"
            :disabled="loading"
            :title="
                currentProject
                    ? `Active project: ${currentProject.metadata.name}`
                    : 'No active project'
            "
        >
            <FolderOpen :size="14" />
            <span class="project-name">
                {{ currentProject?.metadata.name || 'No Project' }}
            </span>
            <ChevronDown :size="12" :class="{ rotated: isOpen }" />
        </button>

        <div v-if="isOpen" class="project-menu">
            <!-- Loading state -->
            <div v-if="projectsLoading" class="menu-item disabled">
                <span class="loading-spinner"></span>
                Loading projects...
            </div>

            <!-- No projects -->
            <div v-else-if="projects.length === 0" class="menu-item disabled">
                No projects available
            </div>

            <!-- Project list -->
            <template v-else>
                <div class="menu-section">
                    <div class="menu-label">Switch Project</div>
                    <button
                        v-for="project in projects"
                        :key="project.metadata.id"
                        class="menu-item project-item"
                        :class="{ active: isCurrentProject(project) }"
                        @click="selectProject(project)"
                        :disabled="loading"
                    >
                        <div class="project-item-content">
                            <div class="project-item-name">
                                {{ project.metadata.name }}
                            </div>
                            <div class="project-item-meta">
                                {{ project.transactionCount }} transactions
                            </div>
                        </div>
                        <Check
                            v-if="isCurrentProject(project)"
                            :size="14"
                            class="check-icon"
                        />
                    </button>
                </div>

                <div class="menu-divider"></div>

                <button class="menu-item action-item" @click="createNewProject">
                    <Plus :size="14" />
                    Create New Project
                </button>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { FolderOpen, ChevronDown, Plus, Check } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'
import type { ProjectInfo } from '@arachne/api-types'

// Project store
const projectStore = useProjectStore()

// Local state
const dropdownRef = ref<HTMLElement>()
const isOpen = ref(false)

// Use project store state
const currentProject = computed(() => projectStore.currentProject)
const projects = computed(() => projectStore.projects)
const loading = computed(() => projectStore.loading)
const projectsLoading = computed(() => projectStore.loading)

// Emits
const emit = defineEmits<{
    'project-changed': [project: ProjectInfo]
    'create-project': []
}>()

// Methods
async function selectProject(project: ProjectInfo) {
    if (loading.value || isCurrentProject(project)) return

    const success = await projectStore.switchProject(project.metadata.id)
    if (success) {
        emit('project-changed', project)
        closeDropdown()
    }
}

function createNewProject() {
    closeDropdown()
    emit('create-project')
}

function isCurrentProject(project: ProjectInfo): boolean {
    return currentProject.value?.metadata.id === project.metadata.id
}

function toggleDropdown() {
    if (isOpen.value) {
        closeDropdown()
    } else {
        openDropdown()
    }
}

async function openDropdown() {
    isOpen.value = true
    await projectStore.loadProjects()
}

function closeDropdown() {
    isOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
    if (
        dropdownRef.value &&
        !dropdownRef.value.contains(event.target as Node)
    ) {
        closeDropdown()
    }
}

// Lifecycle
onMounted(async () => {
    await projectStore.loadCurrentProject()
    await projectStore.loadProjects()
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})

// Expose current project for parent components
defineExpose({
    currentProject: computed(() => currentProject.value),
    refresh: async () => {
        await projectStore.loadCurrentProject()
        await projectStore.loadProjects()
    },
})
</script>

<style scoped>
.project-dropdown {
    position: relative;
    display: inline-block;
}

.project-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-color, #495057);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 140px;
    max-width: 200px;
}

.project-trigger:hover {
    background-color: var(--surface-hover, #f8f9fa);
    border-color: var(--surface-border, #dee2e6);
}

.project-trigger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.project-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    font-weight: 500;
}

.project-trigger svg:last-child {
    transition: transform 0.2s ease;
    color: var(--text-color-secondary, #6c757d);
}

.project-trigger svg:last-child.rotated {
    transform: rotate(180deg);
}

.project-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--surface-border, #dee2e6);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    min-width: 280px;
    max-height: 400px;
    overflow-y: auto;
}

.menu-section {
    padding: 0.5rem 0;
}

.menu-label {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-color-secondary, #6c757d);
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    color: var(--text-color, #495057);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    text-align: left;
}

.menu-item:hover:not(.disabled):not(:disabled) {
    background-color: var(--surface-hover, #f8f9fa);
}

.menu-item.disabled {
    color: var(--text-color-secondary, #6c757d);
    cursor: default;
}

.menu-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.project-item {
    justify-content: space-between;
}

.project-item.active {
    background-color: var(--color-primary-50, #eff6ff);
    color: var(--primary-color, #3b82f6);
}

.project-item-content {
    flex: 1;
    min-width: 0;
}

.project-item-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.project-item-meta {
    font-size: 0.75rem;
    color: var(--text-color-secondary, #6c757d);
    margin-top: 0.125rem;
}

.check-icon {
    color: var(--primary-color, #3b82f6);
    flex-shrink: 0;
}

.action-item {
    gap: 0.5rem;
    color: var(--primary-color, #3b82f6);
    font-weight: 500;
}

.action-item:hover {
    background-color: var(--color-primary-50, #eff6ff);
}

.menu-divider {
    height: 1px;
    background-color: var(--surface-border, #dee2e6);
    margin: 0.25rem 0;
}

.loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.5rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .project-trigger {
        min-width: 120px;
        max-width: 160px;
    }

    .project-menu {
        min-width: 260px;
    }
}
</style>
