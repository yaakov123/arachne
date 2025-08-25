<template>
    <div class="entry-content">
        <div class="entry-header">
            <span class="direction" :class="message.direction">
                {{ message.direction === 'client-to-server' ? '↗ Outgoing' : '↙ Incoming' }}
            </span>
            <span class="message-type" :class="message.messageType">
                {{ formatMessageType(message.messageType) }}
            </span>
            <span class="message-preview">
                {{ getMessagePreview(message) }}
            </span>
        </div>
        <div class="entry-meta">
            <span class="timestamp">{{ formatTimestamp(timestamp) }}</span>
            <span class="size">{{ formatSize(message.content.size) }}</span>
            <span v-if="message.connection" class="connection-ref">
                {{ message.connection.url.host }}{{ message.connection.url.path }}
            </span>
            <span v-if="message.content.detectedFormat" class="format">
                {{ message.content.detectedFormat.toUpperCase() }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { WebSocketMessageWithMeta } from '../stores/transactions'
import { formatTimestamp, formatSize, formatMessageType, getMessagePreview } from '../utils/formatting'

interface Props {
    message: WebSocketMessageWithMeta
    timestamp: number
}

defineProps<Props>()
</script>

<style scoped>
@import '../assets/entry-styles.css';

.direction {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    flex-shrink: 0;
}

.direction.client-to-server {
    background: var(--color-blue-100);
    color: var(--color-blue-700);
}

.direction.server-to-client {
    background: var(--color-green-100);
    color: var(--color-green-700);
}

.message-type {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    flex-shrink: 0;
}

.message-type.text {
    background: var(--color-blue-100);
    color: var(--color-blue-700);
}

.message-type.binary {
    background: var(--color-orange-100);
    color: var(--color-orange-700);
}

.message-type.ping,
.message-type.pong {
    background: var(--color-purple-100);
    color: var(--color-purple-700);
}

.message-type.close {
    background: var(--color-red-100);
    color: var(--color-red-700);
}

.message-preview {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
    color: var(--text-color);
    flex: 1;
    min-width: 0;
    word-break: break-all;
}

/* timestamp, size styles inherited from entry-styles.css */

.connection-ref {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: var(--color-blue-600);
}

.format {
    background: var(--color-info-100);
    color: var(--color-info-700);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-weight: var(--font-medium);
}
</style>
