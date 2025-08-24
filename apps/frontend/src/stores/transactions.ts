import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '../services/ws'
import type { TransactionCompleteEvent, TransactionData } from '@arachne/api-types'

export type TransactionWithMeta = TransactionData & { 
    id: string
    timestamp: number 
}

export interface AdvancedFilters {
    url: string
    method: string
    statusCode: string
    contentType: string
    sizeOperator: string
    sizeValue: number | null
    durationOperator: string
    durationValue: number | null
    timeRange: string
    timeFrom: string
    timeTo: string
    hasBody: string
}

export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<TransactionWithMeta[]>([])
    const selectedTransaction = ref<TransactionWithMeta | null>(null)
    const selectedHost = ref<string | null>(null)
    const isConnected = ref(false)
    const connectionError = ref<string | null>(null)
    const advancedFilters = ref<AdvancedFilters>({
        url: '',
        method: '',
        statusCode: '',
        contentType: '',
        sizeOperator: '',
        sizeValue: null,
        durationOperator: '',
        durationValue: null,
        timeRange: '',
        timeFrom: '',
        timeTo: '',
        hasBody: ''
    })

    // Computed
    const uniqueHosts = computed(() => {
        const hosts = new Set<string>()
        transactions.value.forEach(t => hosts.add(t.request.url.host))
        return Array.from(hosts).sort()
    })

    const filteredTransactions = computed(() => {
        let filtered = transactions.value

        // Host filter (existing functionality)
        if (selectedHost.value) {
            filtered = filtered.filter(t => t.request.url.host === selectedHost.value)
        }

        // Advanced filters
        const filters = advancedFilters.value

        // URL/Path filter
        if (filters.url) {
            const urlPattern = filters.url.toLowerCase()
            filtered = filtered.filter(t => 
                t.request.url.full.toLowerCase().includes(urlPattern) ||
                t.request.url.path.toLowerCase().includes(urlPattern)
            )
        }

        // Method filter
        if (filters.method) {
            filtered = filtered.filter(t => t.request.method === filters.method)
        }

        // Status code filter
        if (filters.statusCode) {
            if (filters.statusCode.endsWith('xx')) {
                const statusClass = parseInt(filters.statusCode.charAt(0))
                filtered = filtered.filter(t => {
                    const status = t.response?.statusCode
                    return status && Math.floor(status / 100) === statusClass
                })
            } else {
                const exactStatus = parseInt(filters.statusCode)
                filtered = filtered.filter(t => t.response?.statusCode === exactStatus)
            }
        }

        // Content type filter
        if (filters.contentType) {
            filtered = filtered.filter(t => {
                const responseContentType = t.response?.body?.content?.detectedFormat
                const requestContentType = t.request.body?.content?.detectedFormat
                return responseContentType === filters.contentType || 
                       requestContentType === filters.contentType
            })
        }

        // Response size filter
        if (filters.sizeOperator && filters.sizeValue !== null) {
            const sizeInBytes = filters.sizeValue * 1024 // Convert KB to bytes
            filtered = filtered.filter(t => {
                const size = t.summary.responseSize || 0
                switch (filters.sizeOperator) {
                    case 'gt': return size > sizeInBytes
                    case 'lt': return size < sizeInBytes
                    case 'eq': return Math.abs(size - sizeInBytes) < 1024 // Within 1KB
                    default: return true
                }
            })
        }

        // Duration filter
        if (filters.durationOperator && filters.durationValue !== null) {
            filtered = filtered.filter(t => {
                const duration = t.timing.duration || 0
                switch (filters.durationOperator) {
                    case 'gt': return duration > filters.durationValue!
                    case 'lt': return duration < filters.durationValue!
                    default: return true
                }
            })
        }

        // Time range filter
        if (filters.timeRange) {
            const now = Date.now()
            let cutoffTime = 0

            if (filters.timeRange === 'custom') {
                const fromTime = filters.timeFrom ? new Date(filters.timeFrom).getTime() : 0
                const toTime = filters.timeTo ? new Date(filters.timeTo).getTime() : now
                filtered = filtered.filter(t => t.timestamp >= fromTime && t.timestamp <= toTime)
            } else {
                switch (filters.timeRange) {
                    case '1m': cutoffTime = now - (1 * 60 * 1000); break
                    case '5m': cutoffTime = now - (5 * 60 * 1000); break
                    case '15m': cutoffTime = now - (15 * 60 * 1000); break
                    case '1h': cutoffTime = now - (60 * 60 * 1000); break
                }
                if (cutoffTime > 0) {
                    filtered = filtered.filter(t => t.timestamp >= cutoffTime)
                }
            }
        }

        // Body filter
        if (filters.hasBody) {
            filtered = filtered.filter(t => {
                const hasRequestBody = t.summary.hasRequestBody
                const hasResponseBody = t.summary.hasResponseBody
                
                switch (filters.hasBody) {
                    case 'request': return hasRequestBody
                    case 'response': return hasResponseBody
                    case 'both': return hasRequestBody && hasResponseBody
                    case 'none': return !hasRequestBody && !hasResponseBody
                    default: return true
                }
            })
        }

        return filtered
    })

    // Actions
    function addTransaction(transactionEvent: TransactionCompleteEvent) {
        const transactionWithMeta: TransactionWithMeta = {
            ...transactionEvent.transaction,
            id: transactionEvent.id,
            timestamp: new Date(transactionEvent.ts).getTime()
        }
        
        // Add to beginning of array (newest first)
        transactions.value.unshift(transactionWithMeta)
        
        // Keep only last 1000 transactions to prevent memory issues
        if (transactions.value.length > 1000) {
            transactions.value = transactions.value.slice(0, 1000)
        }
    }

    function selectTransaction(transaction: TransactionWithMeta) {
        selectedTransaction.value = transaction
    }

    function clearSelectedTransaction() {
        selectedTransaction.value = null
    }

    function selectHost(host: string) {
        selectedHost.value = selectedHost.value === host ? null : host
    }

    function getHostCount(host: string): number {
        return transactions.value.filter(t => t.request.url.host === host).length
    }

    function clearTransactions() {
        transactions.value = []
        selectedTransaction.value = null
    }

    function updateAdvancedFilters(filters: AdvancedFilters) {
        advancedFilters.value = { ...filters }
    }

    function clearAdvancedFilters() {
        advancedFilters.value = {
            url: '',
            method: '',
            statusCode: '',
            contentType: '',
            sizeOperator: '',
            sizeValue: null,
            durationOperator: '',
            durationValue: null,
            timeRange: '',
            timeFrom: '',
            timeTo: '',
            hasBody: ''
        }
    }

    // WebSocket event handler
    function handleWebSocketEvent(event: any) {
        if (event.type === 'transactionComplete') {
            addTransaction(event as TransactionCompleteEvent)
        }
    }

    // WebSocket connection management
    async function connect() {
        try {
            connectionError.value = null
            await wsClient.connect()
            isConnected.value = wsClient.isConnected()
            wsClient.on(handleWebSocketEvent)
        } catch (error) {
            connectionError.value = error instanceof Error ? error.message : 'Connection failed'
            isConnected.value = false
            throw error
        }
    }

    function disconnect() {
        wsClient.off(handleWebSocketEvent)
        wsClient.disconnect()
        isConnected.value = false
    }

    // Utility functions
    function formatSize(bytes: number): string {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    return {
        // State
        transactions,
        selectedTransaction,
        selectedHost,
        isConnected,
        connectionError,
        advancedFilters,
        
        // Computed
        uniqueHosts,
        filteredTransactions,
        
        // Actions
        addTransaction,
        selectTransaction,
        clearSelectedTransaction,
        selectHost,
        getHostCount,
        clearTransactions,
        updateAdvancedFilters,
        clearAdvancedFilters,
        connect,
        disconnect,
        formatSize
    }
})
