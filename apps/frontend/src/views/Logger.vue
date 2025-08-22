<template>
    <div class="logger-view">
        <Sidebar class="logger-sidebar">
            <div class="sidebar-content">
                <h2>Logger Controls</h2>
                <Button label="Click" @click="onClick" />
                <div class="sidebar-section">
                    <h3>Filters</h3>
                    <p>Add your filter controls here</p>
                </div>
                <div class="sidebar-section">
                    <h3>Settings</h3>
                    <p>Add your settings here</p>
                </div>
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
    background-color: var(--surface-ground, #f8f9fa);
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
    background-color: var(--surface-card, #ffffff);
    border: 1px solid var(--surface-border, #dee2e6);
    border-radius: 0.5rem;
    padding: 1rem;
    flex: 1;
    overflow-y: auto;
    margin: 0.5rem;
}
</style>
