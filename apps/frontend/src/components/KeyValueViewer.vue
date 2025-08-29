<template>
    <div class="key-value-viewer">
        <div v-if="items.length > 0" class="items-list">
            <div v-for="item in items" :key="item.key" class="item-row">
                <span class="item-key">{{ item.key }}:</span>
                <span
                    class="item-value"
                    :class="{
                        muted: item.muted,
                    }"
                >
                    {{ item.value }}
                </span>
            </div>
        </div>
        <div v-else class="no-items">
            {{ emptyMessage }}
        </div>
    </div>
</template>

<script setup lang="ts">
export interface KeyValueItem {
    key: string
    value: string
    muted?: boolean
}

interface Props {
    items: KeyValueItem[]
    emptyMessage?: string
    maxHeight?: string
}

withDefaults(defineProps<Props>(), {
    emptyMessage: 'No items',
    maxHeight: '200px',
})
</script>

<style scoped>
.key-value-viewer {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
}

.items-list {
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-xs) var(--space-sm);
    align-items: start;
}

.item-row {
    display: contents;
    line-height: var(--leading-snug);
}

.item-row:not(:last-child)::after {
    content: '';
    grid-column: 1 / -1;
    border-bottom: 1px solid var(--surface-border);
    margin: var(--space-xs) 0;
}

.item-key {
    font-weight: var(--font-semibold);
    color: var(--text-color);
    white-space: nowrap;
    padding-right: var(--space-xs);
}

.item-value {
    color: var(--text-color-secondary);
    word-break: break-all;
    min-width: 0;
    white-space: pre-wrap;
}

.item-value.muted {
    color: var(--text-color-muted);
}

.no-items {
    text-align: center;
    color: var(--text-color-muted);
    font-style: italic;
    padding: var(--space-xl);
    font-size: var(--text-sm);
}

/* Responsive design */
@media (max-width: 768px) {
    .items-list {
        grid-template-columns: 1fr;
        gap: var(--space-xs);
    }

    .item-row {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm);
        background: var(--surface-hover);
        border-radius: var(--radius-sm);
        margin-bottom: var(--space-xs);
    }

    .item-key {
        font-size: var(--text-xs);
        opacity: 0.8;
        padding-right: 0;
    }
}
</style>
