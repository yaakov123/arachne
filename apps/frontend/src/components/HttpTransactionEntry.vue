<template>
    <div class="entry-content">
        <div class="entry-header">
            <span class="method" :class="getMethodClass(transaction.request.method)">
                {{ transaction.request.method }}
            </span>
            <span class="url">
                <span class="host">{{ transaction.request.url.host }}</span>
                <span class="path">{{ transaction.request.url.path }}</span>
            </span>
            <span v-if="transaction.response" class="status-code" :class="getStatusClass(transaction.response.statusCode)">
                {{ transaction.response.statusCode }}
            </span>
        </div>
        <div class="entry-meta">
            <span class="timestamp">{{ formatTimestamp(timestamp) }}</span>
            <span v-if="transaction.timing.duration" class="duration">
                {{ formatDuration(transaction.timing.duration) }}
            </span>
            <span v-if="transaction.summary.responseSize" class="size">
                {{ formatSize(transaction.summary.responseSize) }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { TransactionWithMeta } from '../stores/transactions'
import { getMethodClass, getStatusClass } from '../utils/http-colors'
import { formatTimestamp, formatDuration, formatSize } from '../utils/formatting'

interface Props {
    transaction: TransactionWithMeta
    timestamp: number
}

defineProps<Props>()
</script>

<style scoped>
@import '../assets/entry-styles.css';

.method {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
}

/* url, host, path styles inherited from entry-styles.css */

.status-code {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    flex-shrink: 0;
}

/* timestamp, duration, size styles inherited from entry-styles.css */

/* HTTP Method Colors */
.method-get { background: #e3f2fd; color: #1976d2; }
.method-post { background: #e8f5e8; color: #388e3c; }
.method-put { background: #fff3e0; color: #f57c00; }
.method-patch { background: #fce4ec; color: #c2185b; }
.method-delete { background: #ffebee; color: #d32f2f; }
.method-head { background: #f3e5f5; color: #7b1fa2; }
.method-options { background: #e0f2f1; color: #00796b; }
.method-other { background: #f5f5f5; color: #616161; }

/* Status Code Colors */
.status-success { background: #e8f5e8; color: #388e3c; }
.status-redirect { background: #fff3e0; color: #f57c00; }
.status-client-error { background: #ffebee; color: #d32f2f; }
.status-server-error { background: #ffebee; color: #b71c1c; }
.status-info { background: #e3f2fd; color: #1976d2; }
</style>
