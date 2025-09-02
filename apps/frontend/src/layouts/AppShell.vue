<template>
    <div class="app-shell">
        <aside class="app-sidebar">
            <div class="sidebar-header">
                <RouterLink to="/" class="logo-link">
                    <span class="logo-text">TL</span>
                </RouterLink>
            </div>

            <nav class="sidebar-nav">
                <RouterLink to="/" class="nav-item" title="Traffic Logger">
                    <BarChart3 :size="16" class="nav-icon" />
                    <span class="nav-label">Traffic</span>
                </RouterLink>
                <RouterLink
                    to="/request-editor"
                    class="nav-item"
                    title="Request Editor"
                >
                    <Edit :size="16" class="nav-icon" />
                    <span class="nav-label">Editor</span>
                </RouterLink>
                <RouterLink to="/settings" class="nav-item" title="Settings">
                    <Settings :size="16" class="nav-icon" />
                    <span class="nav-label">Settings</span>
                </RouterLink>
            </nav>

            <div class="sidebar-center"></div>

            <div class="sidebar-footer">
                <ProxyToggle />
            </div>
        </aside>

        <main class="app-content">
            <slot></slot>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Settings, BarChart3, Edit } from 'lucide-vue-next'
import ProxyToggle from '@/components/ProxyToggle.vue'
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
    min-height: 100vh;
    width: 100%;
}

/* Sidebar styles */
.app-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    width: 60px;
    height: 100vh;
    background-color: var(--surface-card, #ffffff);
    border-right: 1px solid var(--surface-border, #dee2e6);
}

/* Sidebar header */
.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    border-bottom: 1px solid var(--surface-border, #dee2e6);
    flex-shrink: 0;
}

.logo-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background-color: var(--primary-color, #3b82f6);
    color: white;
    text-decoration: none;
    font-weight: 700;
    font-size: 1rem;
    transition: all 0.2s ease;
}

.logo-link:hover {
    transform: scale(1.05);
}

.logo-text {
    font-size: 0.875rem;
    font-weight: 700;
}

/* Sidebar navigation */
.sidebar-nav {
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    gap: 0.5rem;
}

.nav-item {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    color: var(--text-color, #495057);
    text-decoration: none;
    transition: all 0.2s ease;
    white-space: nowrap;
    border-radius: 0 24px 24px 0;
    margin-right: 8px;
}

.nav-item:hover {
    background-color: var(--surface-hover, #f8f9fa);
    color: var(--primary-color, #3b82f6);
}

.nav-item.router-link-active {
    background-color: var(--primary-50, #eff6ff);
    color: var(--primary-color, #3b82f6);
}

.nav-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.nav-label {
    display: none;
}

/* Sidebar center section */
.sidebar-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.5rem 0;
    overflow: hidden;
}

/* Keep project switcher content hidden */

/* Sidebar footer */
.sidebar-footer {
    padding: 1rem;
    border-top: 1px solid var(--surface-border, #dee2e6);
    flex-shrink: 0;
}

/* Main content area - adjusted for sidebar */
.app-content {
    flex: 1;
    margin-left: 60px;
    background-color: var(--surface-ground, #f8f9fa);
    overflow-y: auto;
    display: flex;
}

/* Responsive design */
@media (max-width: 768px) {
    .app-sidebar {
        transform: translateX(-100%);
        width: 200px !important;
    }

    .app-sidebar.mobile-open {
        transform: translateX(0);
    }

    .app-content {
        margin-left: 0;
    }
}
</style>
