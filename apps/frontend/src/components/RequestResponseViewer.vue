<template>
    <div v-if="transaction" class="request-response-viewer">
        <div class="viewer-header">
            <div class="request-response-line">
                <span class="request-info">
                    <span
                        class="method"
                        :class="getMethodClass(transaction.method)"
                    >
                        {{ transaction.method }}
                    </span>
                    <span class="url-parts">
                        <span class="host">{{
                            getUrlHost(transaction.urlFull)
                        }}</span>
                        <span class="path">{{
                            getUrlPath(transaction.urlFull)
                        }}</span>
                    </span>
                </span>
                <span v-if="transaction.statusCode" class="response-info">
                    <span
                        class="status-code"
                        :class="getStatusClass(transaction.statusCode)"
                    >
                        {{ transaction.statusCode }}
                    </span>
                    <span
                        v-if="transaction.statusMessage"
                        class="status-message"
                    >
                        {{ transaction.statusMessage }}
                    </span>
                </span>
            </div>
            <button class="close-viewer" @click="emit('close')">×</button>
        </div>

        <div class="viewer-content">
            <RequestPanel ref="requestPanel" :transaction="transaction" />
            <Resizer
                direction="horizontal"
                :first-element="requestPanel?.$el"
                :second-element="responsePanel?.$el"
                :min-size="200"
                @resize-start="onResizeStart"
            />
            <ResponsePanel ref="responsePanel" :transaction="transaction" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTransactionsStore } from '../stores/transactions'
import RequestPanel from './RequestPanel.vue'
import ResponsePanel from './ResponsePanel.vue'
import Resizer from './Resizer.vue'
import { getMethodClass, getStatusClass } from '../utils/http-colors'
import type { FullTransaction } from '@arachne/database'

interface Props {
    transaction: FullTransaction
}

const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'close'): void
}>()

const transactionsStore = useTransactionsStore()
const requestPanel = ref<InstanceType<typeof RequestPanel>>()
const responsePanel = ref<InstanceType<typeof ResponsePanel>>()

const onResizeStart = () => {
    // Convert from flex to explicit sizes when resizing starts
    if (requestPanel.value?.$el && responsePanel.value?.$el) {
        const requestRect = requestPanel.value.$el.getBoundingClientRect()
        const responseRect = responsePanel.value.$el.getBoundingClientRect()

        requestPanel.value.$el.style.flex = 'none'
        responsePanel.value.$el.style.flex = 'none'
        requestPanel.value.$el.style.width = `${requestRect.width}px`
        responsePanel.value.$el.style.width = `${responseRect.width}px`
    }
}

const getUrlHost = (url: string): string => {
    try {
        return new URL(url).host
    } catch {
        return url.split('/')[0] || ''
    }
}

const getUrlPath = (url: string): string => {
    try {
        const urlObj = new URL(url)
        return urlObj.pathname
    } catch {
        const parts = url.split('?')[0].split('/')
        return parts.length > 1 ? '/' + parts.slice(1).join('/') : '/'
    }
}
</script>

<style scoped>
.request-response-viewer {
    height: 100%;
    background: var(--surface-card);
    margin: 0 var(--space-sm) var(--space-sm) var(--space-sm);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-section);
    border-bottom: 1px solid var(--surface-border);
    padding: var(--space-md) var(--space-lg);
}

.request-response-line {
    flex: 1;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-sm);
    padding: var(--space-sm);
    background: var(--surface-ground);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    word-break: break-all;
    border-left: 3px solid var(--primary-color);
}

.request-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.response-info {
    flex-shrink: 0;
    padding-left: var(--space-md);
    border-left: 1px solid var(--surface-border);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

/* HTTP Method Colors */
.method {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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

.method-other {
    background: #f5f5f5;
    color: #616161;
}

/* URL Parts */
.url-parts {
    display: flex;
    align-items: center;
    min-width: 0;
}

.host {
    color: #1976d2;
    font-weight: 600;
    flex-shrink: 0;
}

.path {
    color: var(--text-color);
    word-break: break-all;
    min-width: 0;
}

/* Status Code Colors */
.status-code {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
}

.status-success {
    background: #e8f5e8;
    color: #388e3c;
}

.status-redirect {
    background: #fff3e0;
    color: #f57c00;
}

.status-client-error {
    background: #ffebee;
    color: #d32f2f;
}

.status-server-error {
    background: #ffebee;
    color: #b71c1c;
}

.status-info {
    background: #e3f2fd;
    color: #1976d2;
}

.status-message {
    color: var(--text-color-muted);
    font-size: var(--text-xs);
}

.close-viewer {
    padding: var(--space-xs) var(--space-sm);
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: var(--text-xl);
    color: var(--text-color-muted);
    transition: color var(--transition-fast);
    border-radius: var(--radius-sm);
}

.close-viewer:hover {
    color: var(--color-error-600);
    background: var(--color-error-50);
}

.viewer-content {
    flex: 1;
    display: flex;
    min-height: 0;
}

.viewer-content :deep(.request-panel),
.viewer-content :deep(.response-panel) {
    flex: 1; /* Initially fill container equally */
    min-width: 200px; /* Ensure minimum width */
}
</style>
