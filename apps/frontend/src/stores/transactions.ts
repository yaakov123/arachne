import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '../services/ws'
import type { TransactionCompleteEvent, TransactionData } from '@arachne/api-types'

export type TransactionWithMeta = TransactionData & { 
    id: string
    timestamp: number 
}

export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<TransactionWithMeta[]>([])
    const selectedTransaction = ref<TransactionWithMeta | null>(null)
    const selectedHost = ref<string | null>(null)
    const isConnected = ref(false)
    const connectionError = ref<string | null>(null)

    // Computed
    const uniqueHosts = computed(() => {
        const hosts = new Set<string>()
        transactions.value.forEach(t => hosts.add(t.request.url.host))
        return Array.from(hosts).sort()
    })

    const filteredTransactions = computed(() => {
        if (!selectedHost.value) return transactions.value
        return transactions.value.filter(t => t.request.url.host === selectedHost.value)
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
        connect,
        disconnect,
        formatSize
    }
})
