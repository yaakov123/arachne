<template>
    <div class="app-shell">
        <header class="app-header">
            <nav class="main-nav">
                <RouterLink to="/">Traffic Logger</RouterLink>
            </nav>
            <div class="header-center">
                <ProjectDropdown @create-project="navigateToSettings" />
            </div>
            <div class="header-actions">
                <ProxyToggle />
                <RouterLink
                    to="/settings"
                    class="settings-icon"
                    title="Settings"
                >
                    <Settings :size="16" />
                </RouterLink>
            </div>
        </header>

        <main class="app-content">
            <slot></slot>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Settings } from 'lucide-vue-next'
import ProxyToggle from '@/components/ProxyToggle.vue'
import ProjectDropdown from '@/components/ProjectDropdown.vue'
import { useProjectStore } from '@/stores/project'

const router = useRouter()
const projectStore = useProjectStore()

// Load current project on mount
onMounted(() => {
    projectStore.loadCurrentProject()
})

function navigateToSettings() {
    router.push('/settings')
}
</script>

<style scoped>
/* Full width/height container styles */
.app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
}

/* Header styles */
.app-header {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.75rem;
    height: 32px;
    background-color: var(--surface-card, #ffffff);
    border-bottom: 1px solid var(--surface-border, #dee2e6);
    flex-shrink: 0;
}

.logo h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
}

.main-nav {
    display: flex;
    gap: 1.5rem;
}

.main-nav a {
    color: var(--text-color, #495057);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.875rem;
    padding: 0.25rem 0;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
}

.main-nav a:hover,
.main-nav a.router-link-active {
    color: var(--primary-color, #3b82f6);
    /* border-bottom-color: var(--primary-color, #3B82F6); */
}

.header-center {
    display: flex;
    align-items: center;
    flex: 1;
    justify-content: center;
    margin: 0 1rem;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.settings-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    color: var(--text-color-secondary, #6c757d);
    text-decoration: none;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.settings-icon:hover {
    color: var(--primary-color, #3b82f6);
    background-color: var(--surface-hover, #f8f9fa);
}

/* Main content area - will expand to fill available space */
.app-content {
    flex: 1;
    background-color: var(--surface-ground, #f8f9fa);
    overflow-y: auto;
    display: flex;
}

/* Footer styles */
.app-footer {
    padding: 1rem 1.5rem;
    background-color: var(--surface-card, #ffffff);
    border-top: 1px solid var(--surface-border, #dee2e6);
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-color-secondary, #6c757d);
}
</style>
