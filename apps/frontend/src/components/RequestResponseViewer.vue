<template>
    <div v-if="hasSelection" class="request-response-viewer">
        <div class="viewer-header">
            <div class="viewer-line">
                <!-- HTTP Transaction Header -->
                <template v-if="selectedEntry?.type === 'http-transaction'">
                    <span class="entry-info">
                        <span class="method" :class="getMethodClass(selectedEntry.transaction.request.method)">
                            {{ selectedEntry.transaction.request.method }}
                        </span>
                        <span class="url-parts">
                            <span class="host">{{ getUrlHost(selectedEntry.transaction.request.url.full) }}</span>
                            <span class="path">{{ getUrlPath(selectedEntry.transaction.request.url.full) }}</span>
                        </span>
                    </span>
                    <span v-if="selectedEntry.transaction.response" class="status-info">
                        <span class="status-code" :class="getStatusClass(selectedEntry.transaction.response.statusCode)">
                            {{ selectedEntry.transaction.response.statusCode }}
                        </span>
                        <span v-if="selectedEntry.transaction.response.statusMessage" class="status-message">
                            {{ selectedEntry.transaction.response.statusMessage }}
                        </span>
                    </span>
                </template>

                <!-- WebSocket Connection Header -->
                <template v-if="selectedEntry?.type === 'websocket-connection'">
                    <span class="entry-info">
                        <span class="status-indicator" :class="selectedEntry.connection.status"></span>
                        <span class="protocol">{{ selectedEntry.connection.url.protocol }}</span>
                    <span class="url-parts">
                            <span class="host">{{ selectedEntry.connection.url.host }}</span>
                            <span class="path">{{ selectedEntry.connection.url.path }}</span>
                        </span>
                    </span>
                    <span class="connection-meta">
                        <span class="message-count">{{ selectedEntry.connection.messageCount }} messages</span>
                        <span class="duration">{{ formatDuration(selectedEntry.connection.timestamp, selectedEntry.connection.lastActivity) }}</span>
                    </span>
                </template>

                <!-- WebSocket Message Header -->
                <template v-if="selectedEntry?.type === 'websocket-message'">
                    <span class="entry-info">
                        <span class="direction-indicator" :class="selectedEntry.message.direction">
                            {{ selectedEntry.message.direction === 'client-to-server' ? '↗' : '↙' }}
                        </span>
                        <span class="message-type" :class="selectedEntry.message.messageType">
                            {{ formatMessageType(selectedEntry.message.messageType) }}
                        </span>
                        <span class="message-preview">
                            {{ getMessagePreview(selectedEntry.message) }}
                </span>
                    </span>
                    <span class="message-meta">
                        <span class="message-size">{{ formatSize(selectedEntry.message.content.size) }}</span>
                        <span class="timestamp">{{ formatTimestamp(selectedEntry.message.timestamp) }}</span>
                    </span>
                </template>
            </div>
            <button class="close-viewer" @click="transactionsStore.clearTrafficSelection()">×</button>
        </div>
        
        <div class="viewer-content">
            <!-- HTTP Transaction Content -->
            <template v-if="selectedEntry?.type === 'http-transaction'">
                <RequestPanel ref="requestPanel" :request="selectedEntry.transaction.request" />
            <Resizer 
                direction="horizontal" 
                :first-element="requestPanel?.$el"
                :second-element="responsePanel?.$el"
                :min-size="200"
                @resize-start="onResizeStart"
            />
                <ResponsePanel ref="responsePanel" :response="selectedEntry.transaction.response" />
            </template>

            <!-- WebSocket Connection Content -->
            <template v-if="selectedEntry?.type === 'websocket-connection'">
                <div class="connection-details-panel">
                    <TabContainer :tabs="connectionTabs" default-tab="details">
                        <template #details>
                            <div class="connection-details">
                                <div class="detail-section">
                                    <h4>Connection Information</h4>
                                    <div class="detail-grid">
                                        <div class="detail-item">
                                            <label>Status:</label>
                                            <span class="status-value" :class="selectedEntry.connection.status">
                                                {{ selectedEntry.connection.status.toUpperCase() }}
                                            </span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Connection ID:</label>
                                            <code>{{ selectedEntry.connection.connectionId }}</code>
                                        </div>
                                        <div class="detail-item">
                                            <label>Established:</label>
                                            <span>{{ formatFullTimestamp(selectedEntry.connection.timestamp) }}</span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Last Activity:</label>
                                            <span>{{ formatFullTimestamp(selectedEntry.connection.lastActivity) }}</span>
                                        </div>
                                        <div v-if="selectedEntry.connection.protocols.length > 0" class="detail-item">
                                            <label>Protocols:</label>
                                            <span class="protocols">{{ selectedEntry.connection.protocols.join(', ') }}</span>
                                        </div>
                                        <div v-if="selectedEntry.connection.status === 'closed'" class="detail-item">
                                            <label>Close Code:</label>
                                            <code>{{ selectedEntry.connection.closeCode || 'Unknown' }}</code>
                                        </div>
                                        <div v-if="selectedEntry.connection.closeReason" class="detail-item">
                                            <label>Close Reason:</label>
                                            <span>{{ selectedEntry.connection.closeReason }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <template #headers>
                            <HeadersList :headers="selectedEntry.connection.headers" />
                        </template>
                        <template #messages>
                            <div class="connection-messages">
                                <div v-if="connectionMessages.length === 0" class="no-messages">
                                    <p>No messages yet for this connection.</p>
                                    <p>Messages will appear here as they are sent or received.</p>
                                </div>
                                <div v-else class="messages-list">
                                    <div 
                                        v-for="message in connectionMessages"
                                        :key="message.id"
                                        class="message-item"
                                        @click="selectMessage(message)"
                                        :class="{ 'selected': isMessageSelected(message.id) }"
                                    >
                                        <WebSocketMessageEntry 
                                            :message="message" 
                                            :timestamp="message.timestamp"
                                        />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TabContainer>
                </div>
            </template>

            <!-- WebSocket Message Content -->
            <template v-if="selectedEntry?.type === 'websocket-message'">
                <div class="message-content-panel">
                    <TabContainer :tabs="messageTabs" default-tab="content">
                        <template #content>
                            <div class="message-content">
                                <div v-if="isControlFrame" class="control-frame-content">
                                    <div class="control-frame-info">
                                        <h4>{{ formatMessageType(selectedEntry.message.messageType) }} Frame</h4>
                                        <p>{{ getControlFrameDescription(selectedEntry.message.messageType) }}</p>
                                    </div>
                                    <div class="control-frame-data">
                                        {{ selectedEntry.message.sample }}
                                    </div>
                                </div>
                                <div v-else-if="selectedEntry.message.messageType === 'binary'" class="binary-content">
                                    <BinaryBodyViewer
                                        :content="selectedEntry.message.sample"
                                        :content-type="'application/octet-stream'"
                                        :content-size="selectedEntry.message.content.size"
                                        :encoding="selectedEntry.message.content.encoding"
                                    />
                                </div>
                                <div v-else class="text-content">
                                    <MonacoBodyViewer
                                        :content="selectedEntry.message.sample"
                                        :detected-format="selectedEntry.message.content.detectedFormat"
                                        :content-type="getContentType(selectedEntry.message)"
                                        :content-size="selectedEntry.message.content.size"
                                        :encoding="selectedEntry.message.content.encoding"
                                        editor-height="400px"
                                    />
                                </div>
                            </div>
                        </template>
                        <template #details>
                            <div class="message-details">
                                <div class="detail-section">
                                    <h4>Message Information</h4>
                                    <div class="detail-grid">
                                        <div class="detail-item">
                                            <label>Direction:</label>
                                            <span class="direction-value" :class="selectedEntry.message.direction">
                                                {{ selectedEntry.message.direction === 'client-to-server' ? 'Outgoing' : 'Incoming' }}
                                            </span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Type:</label>
                                            <span class="type-value" :class="selectedEntry.message.messageType">
                                                {{ formatMessageType(selectedEntry.message.messageType) }}
                                            </span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Size:</label>
                                            <span>{{ formatSize(selectedEntry.message.content.size) }}</span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Timestamp:</label>
                                            <span>{{ formatFullTimestamp(selectedEntry.message.timestamp) }}</span>
                                        </div>
                                        <div v-if="selectedEntry.message.content.detectedFormat" class="detail-item">
                                            <label>Detected Format:</label>
                                            <span class="format-value">{{ selectedEntry.message.content.detectedFormat }}</span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Encoding:</label>
                                            <span>{{ selectedEntry.message.content.encoding }}</span>
                                        </div>
                                        <div v-if="selectedEntry.message.content.truncated" class="detail-item">
                                            <label>Truncated:</label>
                                            <span class="truncated-value">Yes</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TabContainer>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTransactionsStore } from '../stores/transactions'
import RequestPanel from './RequestPanel.vue'
import ResponsePanel from './ResponsePanel.vue'
import Resizer from './Resizer.vue'
import TabContainer, { type Tab } from './TabContainer.vue'
import HeadersList from './HeadersList.vue'
import BinaryBodyViewer from './BinaryBodyViewer.vue'
import MonacoBodyViewer from './MonacoBodyViewer.vue'
import WebSocketMessageEntry from './WebSocketMessageEntry.vue'
import { getMethodClass, getStatusClass } from '../utils/http-colors'
import { formatTimestamp as formatTimestampUtil } from '../utils/formatting'

const transactionsStore = useTransactionsStore()
const requestPanel = ref<InstanceType<typeof RequestPanel>>()
const responsePanel = ref<InstanceType<typeof ResponsePanel>>()

// Unified selection logic
const hasSelection = computed(() => transactionsStore.hasUnifiedSelection)
const selectedEntry = computed(() => transactionsStore.selectedTrafficEntry)

// Tab configurations
const connectionTabs = computed(() => {
    const tabs: Tab[] = [
        { id: 'details', label: 'Details' },
        { id: 'headers', label: 'Headers' },
        { id: 'messages', label: 'Messages' }
    ]
    
    if (selectedEntry.value?.type === 'websocket-connection') {
        tabs[1].badge = String(selectedEntry.value.connection.headers.length)
        tabs[2].badge = String(selectedEntry.value.connection.messageCount)
    }
    
    return tabs
})

const messageTabs = computed<Tab[]>(() => [
    { id: 'content', label: 'Content' },
    { id: 'details', label: 'Details' }
])

// WebSocket message helpers
const isControlFrame = computed(() => {
    if (selectedEntry.value?.type !== 'websocket-message') return false
    return ['ping', 'pong', 'close'].includes(selectedEntry.value.message.messageType)
})

// Get messages for the selected connection
const connectionMessages = computed(() => {
    if (selectedEntry.value?.type !== 'websocket-connection') return []
    
    const connectionId = selectedEntry.value.connection.connectionId
    return transactionsStore.websocketMessages.filter(msg => msg.connectionId === connectionId)
        .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
})

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

// Handle message selection from connection view
const selectMessage = (message: any) => {
    const trafficEntry = {
        id: `ws-msg-${message.id}`,
        type: 'websocket-message' as const,
        timestamp: message.timestamp,
        host: message.connection?.url.host || 'unknown',
        message
    }
    transactionsStore.selectTrafficEntry(trafficEntry)
}

// Check if a message is currently selected
const isMessageSelected = (messageId: string) => {
    return selectedEntry.value?.type === 'websocket-message' && 
           selectedEntry.value.message.id === messageId
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

// WebSocket helper functions
function formatDuration(start: number, end: number): string {
    const duration = end - start
    if (duration < 1000) {
        return `${duration}ms`
    } else if (duration < 60000) {
        return `${Math.round(duration / 1000)}s`
    } else {
        const minutes = Math.floor(duration / 60000)
        const seconds = Math.round((duration % 60000) / 1000)
        return `${minutes}m ${seconds}s`
    }
}

function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0')
}

function formatFullTimestamp(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleString()
}

function formatMessageType(type: string): string {
    switch (type) {
        case 'text': return 'Text'
        case 'binary': return 'Binary'
        case 'ping': return 'Ping'
        case 'pong': return 'Pong'
        case 'close': return 'Close'
        default: return type
    }
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getMessagePreview(message: any): string {
    if (['ping', 'pong', 'close'].includes(message.messageType)) {
        return message.sample
    }

    if (message.messageType === 'binary') {
        return `Binary data (${message.content.size} bytes)`
    }

    const sample = message.sample
    if (sample.length > 100) {
        return sample.substring(0, 100) + '...'
    }
    return sample
}

function getContentType(message: any): string {
    if (message.content.detectedFormat === 'json') {
        return 'application/json'
    } else if (message.content.detectedFormat === 'xml') {
        return 'application/xml'
    } else if (message.content.detectedFormat === 'html') {
        return 'text/html'
    }
    return 'text/plain'
}

function getControlFrameDescription(type: string): string {
    switch (type) {
        case 'ping':
            return 'A ping frame is used to check if the connection is still alive. The receiver should respond with a pong frame.'
        case 'pong':
            return 'A pong frame is sent in response to a ping frame to confirm the connection is still active.'
        case 'close':
            return 'A close frame indicates that the connection is being closed. It may contain a status code and reason.'
        default:
            return 'Control frame for WebSocket connection management.'
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

.viewer-line {
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

.entry-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.status-info,
.connection-meta,
.message-meta {
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
    overflow: hidden;
}

.viewer-content :deep(.request-panel),
.viewer-content :deep(.response-panel) {
    flex: 1; /* Initially fill container equally */
    min-width: 200px; /* Ensure minimum width */
}

/* WebSocket specific styling */
.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.status-indicator.connected {
    background: var(--color-success-500);
    box-shadow: 0 0 0 2px var(--color-success-100);
}

.status-indicator.closed {
    background: var(--color-gray-400);
    box-shadow: 0 0 0 2px var(--color-gray-100);
}

.status-indicator.error {
    background: var(--color-error-500);
    box-shadow: 0 0 0 2px var(--color-error-100);
}

.protocol {
    color: var(--color-purple-600);
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    text-transform: uppercase;
    background: var(--color-purple-100);
}

.direction-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-sm);
    font-weight: bold;
    flex-shrink: 0;
}

.direction-indicator.client-to-server {
    background: var(--color-blue-100);
    color: var(--color-blue-600);
}

.direction-indicator.server-to-client {
    background: var(--color-green-100);
    color: var(--color-green-600);
}

.message-type {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    text-transform: uppercase;
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
    word-break: break-all;
    min-width: 0;
}

/* Connection and message panel styling */
.connection-details-panel,
.message-content-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.connection-details,
.message-content,
.message-details {
    padding: var(--space-lg);
    overflow-y: auto;
}

.detail-section {
    margin-bottom: var(--space-lg);
}

.detail-section h4 {
    margin: 0 0 var(--space-md) 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    border-bottom: 1px solid var(--surface-border);
    padding-bottom: var(--space-sm);
}

.detail-grid {
    display: grid;
    gap: var(--space-md);
}

.detail-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.detail-item label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color-secondary);
}

.detail-item span,
.detail-item code {
    font-size: var(--text-sm);
    color: var(--text-color);
}

.detail-item code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: var(--surface-section);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--surface-border);
}

.control-frame-content {
    text-align: center;
    padding: var(--space-xl);
}

.control-frame-info h4 {
    margin: 0 0 var(--space-md) 0;
    color: var(--color-purple-600);
    font-size: var(--text-lg);
}

.control-frame-info p {
    margin: 0 0 var(--space-lg) 0;
    color: var(--text-color-secondary);
    line-height: var(--leading-relaxed);
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
}

.control-frame-data {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: var(--surface-section);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    font-size: var(--text-base);
    color: var(--text-color);
    font-weight: var(--font-medium);
}

.connection-messages {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.no-messages {
    padding: var(--space-xl);
    text-align: center;
    color: var(--text-color-secondary);
}

.no-messages p {
    margin: 0 0 var(--space-sm) 0;
    line-height: var(--leading-relaxed);
}

.messages-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm);
}

.message-item {
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    background: var(--surface-card);
}

.message-item:hover {
    border-color: var(--primary-color);
    background: var(--surface-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.message-item.selected {
    border-color: var(--primary-color);
    background: var(--primary-50);
    box-shadow: 0 0 0 2px var(--primary-200);
}

.message-item:last-child {
    margin-bottom: 0;
}
</style>
