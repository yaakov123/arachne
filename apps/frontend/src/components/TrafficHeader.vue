<template>
    <div class="traffic-header">
        <div class="header-method"></div>
        <div class="header-method">Method</div>
        <div class="header-url">URL</div>
        <div class="header-status">Status</div>
        <div class="header-time">Time</div>
    </div>
</template>

<script setup lang="ts">
// No props or logic needed for this static header
</script>

<style scoped>
.traffic-header {
    display: grid;
    grid-template-columns: 40px 80px 1fr 80px 80px;
    gap: var(--space-md);
    padding: var(--space-md) 0;
    background: var(--surface-section);
    border-bottom: 1px solid var(--surface-border);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-color-secondary);
    align-items: center;
}
</style>
