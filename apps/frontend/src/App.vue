<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppShell from './layouts/AppShell.vue'
</script>

<template>
    <AppShell>
        <RouterView />
    </AppShell>
</template>

<style>
/* Global styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html, body {
    height: 100%;
    width: 100%;
}

body {
    font-family: var(--font-family, 'Inter', sans-serif);
    color: var(--text-color, #495057);
    background-color: var(--surface-ground, #f8f9fa);
}
</style>
