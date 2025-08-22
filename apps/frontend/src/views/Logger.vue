<template>
    <div class="p-4 space-y-4">
        <!-- Connection Status -->
        <div class="flex items-center gap-3">
            <span class="font-semibold">WS:</span>
            <span :class="connected ? 'text-green-600' : 'text-red-600'">
                {{ connected ? 'connected' : 'disconnected' }}
            </span>
            <button
                class="px-3 py-1 rounded bg-blue-600 text-white"
                @click="doConnect"
                v-if="!connected"
            >
                Connect
            </button>
            <button
                class="px-3 py-1 rounded bg-gray-600 text-white"
                @click="doDisconnect"
                v-else
            >
                Disconnect
            </button>

            <input
                v-model="token"
                class="ml-4 px-2 py-1 border rounded min-w-64"
                placeholder="Optional backend token"
                @change="applyToken"
            />
        </div>

        <!-- Test Buttons -->
        <div class="flex items-center gap-2">
            <button
                class="px-3 py-1 rounded bg-emerald-600 text-white"
                @click="checkHealth"
            >
                GET /health
            </button>
            <button
                class="px-3 py-1 rounded bg-emerald-600 text-white"
                @click="loadHosts"
            >
                GET /api/hosts
            </button>
            <span v-if="health !== null"
                >Health: <b>{{ health ? 'OK' : 'FAIL' }}</b></span
            >
        </div>

        <!-- Filters and Stats -->
        <div class="flex items-center gap-4 p-3 bg-gray-50 rounded">
            <div class="flex items-center gap-2">
                <label class="text-sm font-medium">Filter:</label>
                <input
                    v-model="searchFilter"
                    placeholder="URL, method, status..."
                    class="px-2 py-1 border rounded text-sm"
                />
            </div>
            <div class="flex items-center gap-2">
                <label class="text-sm font-medium">Method:</label>
                <select v-model="methodFilter" class="px-2 py-1 border rounded text-sm">
                    <option value="">All</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <label class="text-sm font-medium">Status:</label>
                <select v-model="statusFilter" class="px-2 py-1 border rounded text-sm">
                    <option value="">All</option>
                    <option value="2xx">2xx Success</option>
                    <option value="3xx">3xx Redirect</option>
                    <option value="4xx">4xx Client Error</option>
                    <option value="5xx">5xx Server Error</option>
                </select>
            </div>
            <div class="ml-auto text-sm text-gray-600">
                {{ filteredTransactions.length }} transactions
            </div>
        </div>

        <!-- HTTP Transactions -->
        <div>
            <h2 class="font-semibold mb-2">HTTP Transactions</h2>
            <div class="border rounded bg-white divide-y max-h-[70vh] overflow-auto">
                <div
                    v-for="transaction in filteredTransactions"
                    :key="transaction.id"
                    class="transaction-item"
                    :class="{ 'expanded': expandedTransaction === transaction.id }"
                    @click="toggleTransaction(transaction.id)"
                >
                    <!-- Transaction Summary -->
                    <div class="px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center gap-3">
                        <div class="flex-shrink-0">
                            <span class="text-xs text-gray-500">
                                {{ formatTime(transaction.ts) }}
                            </span>
                        </div>
                        <div class="flex-shrink-0">
                            <span 
                                class="method-badge"
                                :class="getMethodClass(transaction.transaction.request.method)"
                            >
                                {{ transaction.transaction.request.method }}
                            </span>
                        </div>
                        <div class="flex-shrink-0">
                            <span 
                                class="status-badge"
                                :class="getStatusClass(transaction.transaction.response?.statusCode)"
                            >
                                {{ transaction.transaction.response?.statusCode || 'Pending' }}
                            </span>
                        </div>
                        <div class="flex-1 truncate">
                            <span class="font-mono text-sm">
                                {{ transaction.transaction.request.url.full }}
                            </span>
                        </div>
                        <div class="flex-shrink-0 text-xs text-gray-500">
                            {{ formatDuration(transaction.transaction.timing.duration) }}
                        </div>
                        <div class="flex-shrink-0 text-xs text-gray-500">
                            {{ formatSize(getTotalSize(transaction.transaction)) }}
                        </div>
                        <div class="flex-shrink-0">
                            <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': expandedTransaction === transaction.id }">
                                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>

                    <!-- Expanded Transaction Details -->
                    <div v-if="expandedTransaction === transaction.id" class="px-4 pb-4 bg-gray-50">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Request Details -->
                            <div class="space-y-3">
                                <h4 class="font-semibold text-green-700 border-b pb-1">Request</h4>
                                
                                <!-- Request Line -->
                                <div class="bg-white p-3 rounded border font-mono text-sm">
                                    {{ transaction.transaction.request.method }} {{ transaction.transaction.request.url.path }}{{ transaction.transaction.request.url.query ? '?' + transaction.transaction.request.url.query : '' }} HTTP/1.1
                                </div>

                                <!-- Request Headers -->
                                <div>
                                    <h5 class="font-medium mb-2">Headers</h5>
                                    <div class="bg-white rounded border max-h-32 overflow-auto">
                                        <div 
                                            v-for="header in transaction.transaction.request.headers" 
                                            :key="header.name"
                                            class="px-3 py-1 border-b last:border-b-0 font-mono text-xs"
                                            :class="{ 'bg-yellow-50': header.sensitive }"
                                        >
                                            <span class="text-blue-600">{{ header.name }}:</span>
                                            <span class="ml-2" :class="{ 'text-red-600': header.sensitive }">
                                                {{ header.sensitive ? '••••••••' : header.value }}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Request Body -->
                                <div v-if="transaction.transaction.request.body">
                                    <h5 class="font-medium mb-2">
                                        Body 
                                        <span class="text-xs text-gray-500">
                                            ({{ transaction.transaction.request.body.content.detectedFormat }}, 
                                            {{ formatSize(transaction.transaction.request.body.content.size) }})
                                        </span>
                                    </h5>
                                    <div class="bg-white rounded border p-3 max-h-32 overflow-auto">
                                        <pre class="text-xs font-mono whitespace-pre-wrap">{{ formatBodySample(transaction.transaction.request.body) }}</pre>
                                    </div>
                                </div>
                            </div>

                            <!-- Response Details -->
                            <div class="space-y-3" v-if="transaction.transaction.response">
                                <h4 class="font-semibold text-blue-700 border-b pb-1">Response</h4>
                                
                                <!-- Status Line -->
                                <div class="bg-white p-3 rounded border font-mono text-sm">
                                    HTTP/1.1 {{ transaction.transaction.response.statusCode }} {{ transaction.transaction.response.statusMessage || getStatusText(transaction.transaction.response.statusCode) }}
                                </div>

                                <!-- Response Headers -->
                                <div>
                                    <h5 class="font-medium mb-2">Headers</h5>
                                    <div class="bg-white rounded border max-h-32 overflow-auto">
                                        <div 
                                            v-for="header in transaction.transaction.response.headers" 
                                            :key="header.name"
                                            class="px-3 py-1 border-b last:border-b-0 font-mono text-xs"
                                            :class="{ 'bg-yellow-50': header.sensitive }"
                                        >
                                            <span class="text-blue-600">{{ header.name }}:</span>
                                            <span class="ml-2" :class="{ 'text-red-600': header.sensitive }">
                                                {{ header.sensitive ? '••••••••' : header.value }}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Response Body -->
                                <div v-if="transaction.transaction.response.body">
                                    <h5 class="font-medium mb-2">
                                        Body 
                                        <span class="text-xs text-gray-500">
                                            ({{ transaction.transaction.response.body.content.detectedFormat }}, 
                                            {{ formatSize(transaction.transaction.response.body.content.size) }})
                                        </span>
                                    </h5>
                                    <div class="bg-white rounded border p-3 max-h-32 overflow-auto">
                                        <pre class="text-xs font-mono whitespace-pre-wrap">{{ formatBodySample(transaction.transaction.response.body) }}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-if="filteredTransactions.length === 0" class="p-8 text-center text-gray-500">
                    <div class="mb-2">No HTTP transactions captured yet</div>
                    <div class="text-sm">Make some HTTP requests to see them here</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { api } from '@/services/http'
import { wsClient } from '@/services/ws'
import type { TransactionCompleteEvent } from '@arachne/api-types'

const connected = ref(false)
const token = ref<string | undefined>(undefined)
const health = ref<boolean | null>(null)
const transactions = ref<TransactionCompleteEvent[]>([])
const expandedTransaction = ref<string | null>(null)

// Filters
const searchFilter = ref('')
const methodFilter = ref('')
const statusFilter = ref('')

// Computed filtered transactions
const filteredTransactions = computed(() => {
    return transactions.value.filter(transaction => {
        const tx = transaction.transaction
        
        // Search filter
        if (searchFilter.value) {
            const search = searchFilter.value.toLowerCase()
            const matchesUrl = tx.request.url.full.toLowerCase().includes(search)
            const matchesMethod = tx.request.method.toLowerCase().includes(search)
            const matchesStatus = tx.response?.statusCode?.toString().includes(search)
            
            if (!matchesUrl && !matchesMethod && !matchesStatus) {
                return false
            }
        }
        
        // Method filter
        if (methodFilter.value && tx.request.method !== methodFilter.value) {
            return false
        }
        
        // Status filter
        if (statusFilter.value && tx.response?.statusCode) {
            const status = tx.response.statusCode
            const range = statusFilter.value
            if (range === '2xx' && (status < 200 || status >= 300)) return false
            if (range === '3xx' && (status < 300 || status >= 400)) return false
            if (range === '4xx' && (status < 400 || status >= 500)) return false
            if (range === '5xx' && (status < 500 || status >= 600)) return false
        }
        
        return true
    })
})

function attachHandler() {
    return wsClient.on((ev) => {
        // Only handle transaction complete events
        if (ev.type === 'transactionComplete') {
            transactions.value.unshift(ev as TransactionCompleteEvent)
            // Keep only the latest 100 transactions
            if (transactions.value.length > 100) {
                transactions.value.pop()
            }
        }
    })
}

function toggleTransaction(id: string) {
    expandedTransaction.value = expandedTransaction.value === id ? null : id
}

// Utility functions
function formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString()
}

function formatDuration(duration?: number): string {
    if (!duration) return '—'
    if (duration < 1000) return `${Math.round(duration)}ms`
    return `${(duration / 1000).toFixed(2)}s`
}

function formatSize(bytes?: number): string {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function getTotalSize(transaction: any): number {
    return (transaction.summary.requestSize || 0) + (transaction.summary.responseSize || 0)
}

function getMethodClass(method: string): string {
    const classes = {
        GET: 'bg-blue-100 text-blue-800',
        POST: 'bg-green-100 text-green-800', 
        PUT: 'bg-yellow-100 text-yellow-800',
        DELETE: 'bg-red-100 text-red-800',
        PATCH: 'bg-purple-100 text-purple-800',
    }
    return classes[method as keyof typeof classes] || 'bg-gray-100 text-gray-800'
}

function getStatusClass(status?: number): string {
    if (!status) return 'bg-gray-100 text-gray-600'
    if (status >= 200 && status < 300) return 'bg-green-100 text-green-800'
    if (status >= 300 && status < 400) return 'bg-yellow-100 text-yellow-800'
    if (status >= 400 && status < 500) return 'bg-red-100 text-red-800'
    if (status >= 500) return 'bg-red-200 text-red-900'
    return 'bg-gray-100 text-gray-800'
}

function getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        301: 'Moved Permanently',
        302: 'Found',
        304: 'Not Modified',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
    }
    return statusTexts[status] || 'Unknown'
}

function formatBodySample(body: any): string {
    const { sample, content } = body
    
    // Handle base64 encoded content
    if (content.encoding === 'base64' && sample.startsWith('base64:')) {
        if (content.detectedFormat === 'binary' || content.detectedFormat === 'image') {
            return `[Binary data - ${content.detectedFormat}]`
        }
        try {
            return atob(sample.substring(7)) // Remove "base64:" prefix
        } catch {
            return '[Invalid base64 data]'
        }
    }
    
    // Pretty print JSON
    if (content.detectedFormat === 'json') {
        try {
            return JSON.stringify(JSON.parse(sample), null, 2)
        } catch {
            return sample
        }
    }
    
    return sample
}

let off: (() => void) | null = null

async function doConnect() {
    await wsClient.connect()
    off = attachHandler()
    connected.value = wsClient.isConnected()
}

function doDisconnect() {
    wsClient.disconnect()
    if (off) off()
    off = null
    connected.value = false
}

function applyToken() {
    api.setToken(token.value)
    if (connected.value) doConnect()
}

async function checkHealth() {
    try {
        const r = await api.health()
        health.value = !!r.ok
    } catch {
        health.value = false
    }
}

async function loadHosts() {
    try {
        await api.getHosts()
    } catch {}
}

onMounted(() => {
    // Lazy connect; avoid auto connect to let user set token first
})

onBeforeUnmount(() => {
    doDisconnect()
})
</script>

<style scoped>
.min-w-64 {
    min-width: 16rem;
}

.method-badge {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 0.25rem;
    min-width: 3rem;
    text-align: center;
}

.status-badge {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 0.25rem;
    min-width: 3rem;
    text-align: center;
}

.transaction-item {
    border-bottom: 1px solid #e5e7eb;
}

.transaction-item:last-child {
    border-bottom: none;
}

.transaction-item.expanded {
    background-color: #f9fafb;
}

.transaction-item:hover {
    background-color: #f9fafb;
}

/* Custom scrollbar for better UX */
.max-h-32::-webkit-scrollbar,
.max-h-\[70vh\]::-webkit-scrollbar {
    width: 6px;
}

.max-h-32::-webkit-scrollbar-track,
.max-h-\[70vh\]::-webkit-scrollbar-track {
    background: #f1f5f9;
}

.max-h-32::-webkit-scrollbar-thumb,
.max-h-\[70vh\]::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.max-h-32::-webkit-scrollbar-thumb:hover,
.max-h-\[70vh\]::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* Chevron animation */
.transition-transform {
    transition: transform 0.2s ease;
}

.rotate-90 {
    transform: rotate(90deg);
}
</style>
