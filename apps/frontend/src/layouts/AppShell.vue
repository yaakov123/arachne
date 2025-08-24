<template>
    <div class="app-shell">
        <header class="app-header">
            <div class="logo">
                <h1>Arachne</h1>
            </div>
            <nav class="main-nav">
                <RouterLink to="/">Traffic Logger</RouterLink>
                <RouterLink to="/settings">Settings</RouterLink>
            </nav>
            <div class="header-actions">
                <ThemeToggle />
            </div>
        </header>
        
        <main class="app-content">
            <slot></slot>
        </main>
    </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    height: 64px;
    background-color: var(--surface-card, #ffffff);
    border-bottom: 1px solid var(--surface-border, #dee2e6);
    flex-shrink: 0;
}

.logo h1 {
    margin: 0;
    font-size: 1.5rem;
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
    padding: 0.5rem 0;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
}

.main-nav a:hover,
.main-nav a.router-link-active {
    color: var(--primary-color, #3B82F6);
    border-bottom-color: var(--primary-color, #3B82F6);
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
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
