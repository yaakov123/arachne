<template>
    <CollapsibleSection 
        v-if="body"
        title="Body" 
        :badge="body.sample ? `(${formatBodySize(body.sample.length)})` : undefined"
        badge-class="size"
        :default-collapsed="defaultCollapsed"
    >
        <pre class="body-content">{{ body.sample }}</pre>
    </CollapsibleSection>
</template>

<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'

interface Body {
    sample: string
}

interface Props {
    body?: Body | null
    defaultCollapsed?: boolean
}

withDefaults(defineProps<Props>(), {
    defaultCollapsed: false
})

const formatBodySize = (size: number): string => {
    if (size < 1024) return `${size} bytes`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.body-content {
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
}
</style>
