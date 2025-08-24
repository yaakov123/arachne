<template>
    <div 
        class="traffic-entry"
        :class="{ selected: isSelected }"
        @click="$emit('select', transaction)"
    >
        <div class="entry-method" :class="getMethodClass(transaction.request.method)">
            {{ transaction.request.method }}
        </div>
        <div class="entry-url" :title="transaction.request.url.full">
            {{ transaction.request.url.path }}{{ transaction.request.url.query ? '?' + transaction.request.url.query : '' }}
        </div>
        <div 
            class="entry-status" 
            :style="{ color: transaction.response?.statusCode ? getStatusTextColor(transaction.response.statusCode) : 'var(--text-color-muted)' }"
        >
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
import { getMethodClass, getStatusTextColor } from '../utils/http-colors'

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
    background: #e3f2fd; 
    color: #1976d2; 
}
.method-post { 
    background: #e8f5e8; 
    color: #388e3c; 
}
.method-put { 
    background: #fff3e0; 
    color: #f57c00; 
}
.method-patch { 
    background: #fce4ec; 
    color: #c2185b; 
}
.method-delete { 
    background: #ffebee; 
    color: #d32f2f; 
}
.method-head { 
    background: #f3e5f5; 
    color: #7b1fa2; 
}
.method-options { 
    background: #e0f2f1; 
    color: #00796b; 
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



.entry-size, .entry-time {
    text-align: right;
    color: var(--text-color-muted);
    font-variant-numeric: tabular-nums;
}
</style>
