<template>
    <div class="tab-section">
        <div class="section-header">
            <h2>Appearance</h2>
            <p>Customize the application's visual appearance</p>
        </div>

        <div class="section-content">
            <div class="control-group">
                <div class="control-info">
                    <h3>Theme</h3>
                    <p>Switch between light and dark mode</p>
                </div>
                <div class="control-actions">
                    <ThemeToggle />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<style scoped>
.tab-section {
    padding: 2rem 0px;
    min-height: 100%;
    box-sizing: border-box;
    width: 100%;
}

.section-header {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--surface-border);
}

.section-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
}

.section-header p {
    color: var(--text-color-secondary);
    margin: 0;
}

.section-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.control-group {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2rem;
    padding: 1.5rem;
    background: var(--surface-ground);
    border-radius: 8px;
    border: 1px solid var(--surface-border);
}

.control-info {
    flex: 1;
}

.control-info h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
}

.control-info p {
    color: var(--text-color-secondary);
    margin: 0;
    line-height: 1.5;
}

.control-actions {
    display: flex;
    gap: 0.75rem;
    flex-shrink: 0;
}

@media (max-width: 768px) {
    .tab-section {
        padding: 1rem;
        min-height: 100%;
        box-sizing: border-box;
        width: 100%;
    }

    .control-group {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
    }

    .control-actions {
        justify-content: stretch;
    }
}
</style>
