<template>
    <pre class="text-content">{{ content }}</pre>
</template>

<script setup lang="ts">
interface Props {
    content: string
}

defineProps<Props>()
</script>

<style scoped>
.text-content {
    background: var(--surface-section);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    padding: var(--space-md);
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    overflow: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 300px;
    color: var(--text-color);
}
</style>
