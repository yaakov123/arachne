<template>
    <div class="tab-section">
        <ProjectManagement />
    </div>
</template>

<script setup lang="ts">
import ProjectManagement from '@/components/ProjectManagement.vue'
</script>

<style scoped>
.tab-section {
    padding: 2rem 0px;
    min-height: 100%;
    box-sizing: border-box;
    width: 100%;
}

@media (max-width: 768px) {
    .tab-section {
        padding: 1rem;
        min-height: 100%;
        box-sizing: border-box;
        width: 100%;
    }
}
</style>
