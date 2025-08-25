<template>
    <div class="entry-content">
        <div class="entry-header">
            <span class="protocol">{{ connection.url.protocol }}</span>
            <span class="url">
                <span class="host">{{ connection.url.host }}</span>
                <span class="path">{{ connection.url.path }}</span>
            </span>
            <span class="connection-status" :class="connection.status">
                {{ connection.status.toUpperCase() }}
            </span>
        </div>
        <div class="entry-meta">
            <span class="timestamp">{{ formatTimestamp(timestamp) }}</span>
            <span class="message-count">{{ connection.messageCount }} messages</span>
            <span v-if="connection.protocols.length > 0" class="protocols">
                {{ connection.protocols.join(', ') }}
            </span>
            <span v-if="connection.status === 'closed'" class="close-info">
                Code: {{ connection.closeCode || 'Unknown' }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { WebSocketConnectionWithMeta } from '../stores/transactions'
import { formatTimestamp } from '../utils/formatting'

interface Props {
    connection: WebSocketConnectionWithMeta
    timestamp: number
}

defineProps<Props>()
</script>

<style scoped>
@import '../assets/entry-styles.css';

.protocol {
    color: var(--color-purple-600);
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    text-transform: uppercase;
    background: var(--color-purple-100);
    flex-shrink: 0;
}

/* url, host, path styles inherited from entry-styles.css */

.connection-status {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    flex-shrink: 0;
}

.connection-status.connected {
    background: var(--color-success-100);
    color: var(--color-success-700);
}

.connection-status.closed {
    background: var(--color-gray-100);
    color: var(--color-gray-700);
}

.connection-status.error {
    background: var(--color-error-100);
    color: var(--color-error-700);
}

/* timestamp styles inherited from entry-styles.css */

.message-count {
    color: var(--color-info-600);
    font-weight: var(--font-medium);
}

.protocols {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: var(--color-purple-600);
}

.close-info {
    color: var(--color-warning-600);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
</style>
