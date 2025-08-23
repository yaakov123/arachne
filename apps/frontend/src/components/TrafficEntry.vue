<template>
    <div 
        class="traffic-entry"
        :class="{ selected: isSelected }"
        @click="$emit('select', transaction)"
    >
        <div class="entry-method" :class="`method-${transaction.request.method.toLowerCase()}`">
            {{ transaction.request.method }}
        </div>
        <div class="entry-url" :title="transaction.request.url.full">
            {{ transaction.request.url.path }}{{ transaction.request.url.query ? '?' + transaction.request.url.query : '' }}
        </div>
        <div class="entry-status" :class="`status-${Math.floor((transaction.response?.statusCode || 0) / 100)}`">
            {{ transaction.response?.statusCode || '-' }}
        </div>
        <div class="entry-size">
            {{ formatSize(transaction.summary.responseSize || 0) }}
        </div>
        <div class="entry-time">
            {{ transaction.timing.duration ? transaction.timing.duration.toFixed(0) + 'ms' : '-' }}
        </div>
    </div>
</template>

<script setup lang="ts">
import type { TransactionWithMeta } from '../stores/transactions'

interface Props {
    transaction: TransactionWithMeta
    isSelected: boolean
}

defineProps<Props>()

defineEmits<{
    select: [transaction: TransactionWithMeta]
}>()

// Helper function to format file sizes
function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.traffic-entry {
    display: grid;
    grid-template-columns: 80px 1fr 80px 80px 80px;
    gap: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--surface-border);
    cursor: pointer;
    transition: background-color var(--transition-fast);
    font-size: var(--text-sm);
}

.traffic-entry:hover {
    background: var(--surface-hover);
}

.traffic-entry.selected {
    background: var(--color-primary-50);
    border-left: 3px solid var(--primary-color);
}

.entry-method {
    font-weight: var(--font-semibold);
    text-align: center;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
}

.method-get { 
    background: var(--color-success-50); 
    color: var(--color-success-700); 
}
.method-post { 
    background: var(--color-warning-50); 
    color: var(--color-warning-700); 
}
.method-put { 
    background: var(--color-info-50); 
    color: var(--color-info-700); 
}
.method-delete { 
    background: var(--color-error-50); 
    color: var(--color-error-700); 
}
.method-patch { 
    background: var(--color-neutral-100); 
    color: var(--color-neutral-700); 
}

.entry-url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-color);
}

.entry-status {
    text-align: center;
    font-weight: var(--font-semibold);
}

.status-2 { color: var(--color-success-600); }
.status-3 { color: var(--color-info-600); }
.status-4 { color: var(--color-warning-600); }
.status-5 { color: var(--color-error-600); }

.entry-size, .entry-time {
    text-align: right;
    color: var(--text-color-muted);
    font-variant-numeric: tabular-nums;
}
</style>
