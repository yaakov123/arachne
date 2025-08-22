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
    top: var(--sidebar-top);
    background-color: var(--surface-card, #ffffff);
    border-right: 1px solid var(--surface-border, #dee2e6);
    overflow-y: auto;
    overflow-x: hidden;
}
</style>