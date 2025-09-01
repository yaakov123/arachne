<template>
    <div class="project-dropdown" ref="dropdownRef">
        <button
            class="project-trigger"
            @click="toggleDropdown"
            :disabled="loading"
            :title="
                currentProject
                    ? `Active project: ${currentProject.name}`
                    : 'No active project'
            "
        >
            <FolderOpen :size="16" class="project-icon" />
            <div class="project-content">
                <span class="project-name">
                    {{ currentProject?.name || 'No Project' }}
                </span>
                <ChevronDown
                    :size="12"
                    :class="{ rotated: isOpen }"
                    class="chevron"
                />
            </div>
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
                        :key="project.id"
                        class="menu-item project-item"
                        :class="{ active: isCurrentProject(project) }"
                        @click="selectProject(project)"
                        :disabled="loading"
                    >
                        <div class="project-item-content">
                            <div class="project-item-name">
                                {{ project.name }}
                            </div>
                            <div class="project-item-meta">
                                {{ project.createdAt }}
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
import type { Project } from '@arachne/database'

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
    'project-changed': [project: Project]
    'create-project': []
}>()

// Methods
async function selectProject(project: Project) {
    if (loading.value || isCurrentProject(project)) return

    const success = await projectStore.switchProject(project.id)
    if (success) {
        emit('project-changed', project)
        closeDropdown()
    }
}

function createNewProject() {
    closeDropdown()
    emit('create-project')
}

function isCurrentProject(project: Project): boolean {
    return currentProject.value?.id === project.id
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
    display: block;
    width: 100%;
}

.project-trigger {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.75rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-color, #495057);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    margin: 0 0.5rem;
    white-space: nowrap;
}

.project-trigger:hover {
    background-color: var(--surface-hover, #f8f9fa);
    border-color: var(--surface-border, #dee2e6);
}

.project-trigger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.project-icon {
    flex-shrink: 0;
    color: var(--primary-color, #3b82f6);
}

.project-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    margin-left: 0.75rem;
    opacity: 0;
    transform: translateX(-10px);
    transition: all 0.3s ease;
    min-width: 0;
}

/* Show content when parent sidebar is hovered */
.project-dropdown:hover .project-content,
.project-dropdown.sidebar-expanded .project-content {
    opacity: 1;
    transform: translateX(0);
}

.project-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    font-weight: 500;
    min-width: 0;
}

.chevron {
    flex-shrink: 0;
    margin-left: 0.5rem;
    transition: transform 0.2s ease;
    color: var(--text-color-secondary, #6c757d);
}

.chevron.rotated {
    transform: rotate(180deg);
}

.project-menu {
    position: fixed;
    top: 50%;
    left: 220px;
    transform: translateY(-50%);
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--surface-border, #dee2e6);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 1001;
    min-width: 280px;
    max-width: 320px;
    max-height: 400px;
    overflow-y: auto;
    animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-50%) translateX(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
    }
}

/* Adjust menu position when sidebar is collapsed */
@media (max-width: 768px) {
    .project-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        transform: none;
        margin-top: 0.25rem;
        min-width: 260px;
    }
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
