<template>
    <div class="logger-view">
        <Sidebar class="logger-sidebar">
            <div class="sidebar-content">
                <Button label="Click" @click="onClick" />
            </div>
        </Sidebar>
        
        <main class="logger-main">
            <div class="logger-content">
                <p>Main logger content goes here</p>
                <!-- Add your logger table, logs, etc. here -->
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
function onClick() {
    console.log('Click')
}
</script>

<style scoped>
.logger-view {
    display: flex;
    height: 100%;
    width: 100%;
}

.logger-sidebar {
    width: 300px;
    min-width: 250px;
    max-width: 400px;
    flex-shrink: 0;
}

.sidebar-content {
    height: 100%;
    padding: 1rem;
}

.sidebar-content h2 {
    margin-bottom: 1.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color, #495057);
}

.sidebar-section {
    margin-top: 2rem;
}

.sidebar-section h3 {
    margin-bottom: 0.75rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-color, #495057);
}

.sidebar-section p {
    font-size: 0.875rem;
    color: var(--text-color-secondary, #6c757d);
}

.logger-main {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.logger-main h1 {
    margin-bottom: 1.5rem;
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-color, #495057);
}

.logger-content {
    border-radius: 0.5rem;
    padding: 1rem;
    flex: 1;
    overflow-y: auto;
    margin: 0.5rem;
}
</style>
