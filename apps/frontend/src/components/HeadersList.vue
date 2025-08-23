<template>
    <CollapsibleSection 
        title="Headers" 
        :badge="`(${headers.length})`"
        badge-class="count"
        :default-collapsed="defaultCollapsed"
    >
        <div class="headers-list">
            <div 
                v-for="header in headers" 
                :key="header.name" 
                class="header-item"
            >
                <span class="header-name">{{ header.name }}:</span>
                <span class="header-value" :class="{ sensitive: header.sensitive }">
                    {{ header.value }}
                </span>
            </div>
        </div>
    </CollapsibleSection>
</template>

<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'

interface Header {
    name: string
    value: string
    sensitive?: boolean
}

interface Props {
    headers: Header[]
    defaultCollapsed?: boolean
}

withDefaults(defineProps<Props>(), {
    defaultCollapsed: false
})
</script>

<style scoped>
.headers-list {
    background: var(--surface-section);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
    max-height: 200px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-xs) var(--space-sm);
    align-items: start;
}

.header-item {
    display: contents;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
}

.header-name {
    font-weight: var(--font-semibold);
    color: var(--text-color);
    white-space: nowrap;
    padding-right: var(--space-xs);
}

.header-value {
    color: var(--text-color-secondary);
    word-break: break-all;
    min-width: 0;
}

.header-value.sensitive {
    color: var(--color-error-600);
    font-style: italic;
}
</style>
