<template>
    <div class="traffic-header" :class="{ unified }">
        <template v-if="unified">
            <div class="header-type">Type</div>
            <div class="header-details">Details</div>
            <div class="header-status">Status</div>
            <div class="header-size">Size</div>
            <div class="header-time">Time</div>
        </template>
        <template v-else>
            <div class="header-method">Method</div>
            <div class="header-url">URL</div>
            <div class="header-status">Status</div>
            <div class="header-size">Size</div>
            <div class="header-time">Time</div>
        </template>
    </div>
</template>

<script setup lang="ts">
interface Props {
    unified?: boolean
}

withDefaults(defineProps<Props>(), {
    unified: false
})
</script>

<style scoped>
.traffic-header {
    display: grid;
    grid-template-columns: 80px 1fr 80px 80px 80px;
    gap: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    background: var(--surface-section);
    border-bottom: 1px solid var(--surface-border);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-color-secondary);
}

.traffic-header.unified {
    grid-template-columns: 60px 1fr 100px 80px 80px;
}
</style>
