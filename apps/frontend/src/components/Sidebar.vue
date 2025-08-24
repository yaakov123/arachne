<template>
    <div class="sidebar">
        <slot></slot>
    </div>
</template>

<script setup lang="ts">
// No props needed for this simple sidebar component
</script>

<style scoped> 
.sidebar {
    height: var(--sidebar-height);
    width: var(--sidebar-width);
    background-color: var(--surface-card);
    border-right: 1px solid var(--surface-border);
    overflow-y: auto;
    overflow-x: hidden;
}
</style>