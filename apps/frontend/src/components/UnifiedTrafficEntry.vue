<template>
    <div 
        class="unified-traffic-entry"
        :class="{ 
            'selected': isSelected,
            'http-transaction': entry.type === 'http-transaction',
            'websocket-connection': entry.type === 'websocket-connection',
            'websocket-message': entry.type === 'websocket-message'
        }"
        @click="$emit('select', entry)"
    >
        <div class="entry-main">
            <div class="entry-type-indicator">
                <div class="type-icon" :class="entry.type">
                    {{ getTypeIcon(entry.type) }}
                </div>
            </div>
            
            <!-- HTTP Transaction -->
            <HttpTransactionEntry
                v-if="entry.type === 'http-transaction'"
                :transaction="entry.transaction"
                :timestamp="entry.timestamp"
            />

            <!-- WebSocket Connection -->
            <WebSocketConnectionEntry
                v-if="entry.type === 'websocket-connection'"
                :connection="entry.connection"
                :timestamp="entry.timestamp"
            />

            <!-- WebSocket Message -->
            <WebSocketMessageEntry
                v-if="entry.type === 'websocket-message'"
                :message="entry.message"
                :timestamp="entry.timestamp"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { TrafficEntry } from '../stores/transactions'
import HttpTransactionEntry from './HttpTransactionEntry.vue'
import WebSocketConnectionEntry from './WebSocketConnectionEntry.vue'
import WebSocketMessageEntry from './WebSocketMessageEntry.vue'

interface Props {
    entry: TrafficEntry
    isSelected: boolean
}

defineProps<Props>()
defineEmits<{
    select: [entry: TrafficEntry]
}>()

function getTypeIcon(type: string): string {
    switch (type) {
        case 'http-transaction': return '🌐'
        case 'websocket-connection': return '🔌'
        case 'websocket-message': return '💬'
        default: return '❓'
    }
}
</script>

<style scoped>
.unified-traffic-entry {
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--surface-border);
    cursor: pointer;
    transition: all var(--transition-fast);
    background: var(--surface-card);
    position: relative;
}

.unified-traffic-entry:hover {
    background: var(--surface-hover);
}

.unified-traffic-entry.selected {
    background: var(--primary-50);
    border-left: 3px solid var(--primary-color);
}

/* Type-specific styling */
.unified-traffic-entry.http-transaction {
    border-left: 3px solid var(--color-blue-400);
}

.unified-traffic-entry.websocket-connection {
    border-left: 3px solid var(--color-purple-400);
}

.unified-traffic-entry.websocket-message {
    border-left: 3px solid var(--color-green-400);
}

.entry-main {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
}

.entry-type-indicator {
    flex-shrink: 0;
    margin-top: 2px;
}

.type-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-xs);
    background: var(--surface-section);
    border: 1px solid var(--surface-border);
}

.type-icon.http-transaction {
    background: var(--color-blue-100);
    border-color: var(--color-blue-300);
}

.type-icon.websocket-connection {
    background: var(--color-purple-100);
    border-color: var(--color-purple-300);
}

.type-icon.websocket-message {
    background: var(--color-green-100);
    border-color: var(--color-green-300);
}

/* Removed styles - moved to individual entry components */
</style>
