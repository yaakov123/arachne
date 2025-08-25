import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '../services/ws'
import { HttpRoutes, type RepeatRequestBody, type RepeatResponse } from '@arachne/api-types'
import type { TransactionCompleteEvent, TransactionData, RepeaterMetadata } from '@arachne/api-types'

// Frontend transaction with repeater grouping metadata 
export interface RepeaterGroupMeta {
    isOriginal: boolean             // True for the original request
    isRepeated: boolean             // True for repeated requests
    parentTransactionId?: string    // For repeated requests, links to original
    childTransactionIds: string[]   // For original requests, list of repeated IDs
    isExpanded: boolean            // UI state for expand/collapse
}

export type TransactionWithMeta = TransactionData & { 
    id: string
    timestamp: number 
    repeaterGroup?: RepeaterGroupMeta
}

// Removed AdvancedFilters interface - now using simple search query

export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<TransactionWithMeta[]>([])
    const selectedTransaction = ref<TransactionWithMeta | null>(null)
    const selectedHost = ref<string | null>(null)
    const isConnected = ref(false)
    const connectionError = ref<string | null>(null)
    const searchQuery = ref<string>('')

    // Computed
    const uniqueHosts = computed(() => {
        const hosts = new Set<string>()
        transactions.value.forEach(t => hosts.add(t.request.url.host))
        return Array.from(hosts).sort()
    })

    const filteredTransactions = computed(() => {
        let filtered = transactions.value

        // Host filter
        if (selectedHost.value) {
            filtered = filtered.filter(t => t.request.url.host === selectedHost.value)
        }

        // URL/Path search filter
        if (searchQuery.value) {
            const query = searchQuery.value.toLowerCase()
            filtered = filtered.filter(t => 
                t.request.url.full.toLowerCase().includes(query) ||
                t.request.url.path.toLowerCase().includes(query)
            )
        }

        return filtered
    })

    // Display logic for nested view
    const displayTransactions = computed(() => {
        const result: TransactionWithMeta[] = []
        
        for (const transaction of filteredTransactions.value) {
            if (transaction.repeaterGroup?.isOriginal) {
                // Add original transaction
                result.push(transaction)
                
                // Add repeated transactions if expanded
                if (transaction.repeaterGroup.isExpanded) {
                    const childIds = transaction.repeaterGroup.childTransactionIds
                    const children = transactions.value.filter(t => childIds.includes(t.id))
                    result.push(...children.sort((a, b) => b.timestamp - a.timestamp))
                }
            } else if (!transaction.repeaterGroup?.isRepeated) {
                // Add non-grouped transactions
                result.push(transaction)
            }
            // Skip repeated transactions (shown under parent when expanded)
        }
        
        return result
    })



    // Actions
    function addTransaction(transactionEvent: TransactionCompleteEvent) {
        const transactionWithMeta: TransactionWithMeta = {
            ...transactionEvent.transaction,
            id: transactionEvent.id,
            timestamp: new Date(transactionEvent.ts).getTime(),
        }
        
        // Handle repeated vs. original transactions
        if (transactionWithMeta.repeater?.source === 'repeater') {
            handleRepeatedTransaction(transactionWithMeta)
        } else {
            transactions.value.unshift(transactionWithMeta)
        }
        
        // Keep only last 1000 transactions to prevent memory issues
        if (transactions.value.length > 1000) {
            transactions.value = transactions.value.slice(0, 1000)
        }
    }

    function handleRepeatedTransaction(repeatedTransaction: TransactionWithMeta) {
        const originalId = repeatedTransaction.repeater?.originalTransactionId
        
        if (!originalId) {
            transactions.value.unshift(repeatedTransaction)
            return
        }
        
        const originalTransaction = transactions.value.find(t => t.id === originalId)
        
        if (originalTransaction) {
            // Initialize repeater group if needed
            if (!originalTransaction.repeaterGroup) {
                originalTransaction.repeaterGroup = {
                    isOriginal: true,
                    isRepeated: false,
                    parentTransactionId: undefined,
                    childTransactionIds: [],
                    isExpanded: false
                }
            }
            
            // Mark repeated transaction and link to parent
            repeatedTransaction.repeaterGroup = {
                isOriginal: false,
                isRepeated: true,
                parentTransactionId: originalId,
                childTransactionIds: [],
                isExpanded: false
            }
            
            // Add to child list and add to transactions
            originalTransaction.repeaterGroup.childTransactionIds.push(repeatedTransaction.id)
            transactions.value.unshift(repeatedTransaction)
        } else {
            // Original not found - treat as standalone
            transactions.value.unshift(repeatedTransaction)
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

    function updateSearchQuery(query: string) {
        searchQuery.value = query
    }

    function clearSearch() {
        searchQuery.value = ''
    }

    // Repeater functionality
    async function repeatRequest(transactionId: string): Promise<void> {
        try {
            // Find the transaction to repeat
            const transaction = transactions.value.find(t => t.id === transactionId)
            if (!transaction) {
                throw new Error('Transaction not found')
            }
            
            const response = await fetch(HttpRoutes.repeaterSend, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // TODO: Add auth header if needed
                },
                body: JSON.stringify({ 
                    originalTransactionId: transactionId,
                    transaction: {
                        request: transaction.request,
                        response: transaction.response,
                        timing: transaction.timing,
                        summary: transaction.summary
                    }
                } satisfies RepeatRequestBody)
            })
            
            if (!response.ok) {
                throw new Error(`Failed to repeat request: ${response.statusText}`)
            }
            
            const result: RepeatResponse = await response.json()
            if (!result.ok) {
                throw new Error(result.error || result.message)
            }
        } catch (error) {
            console.error('Error repeating request:', error)
            throw error
        }
    }

    function toggleGroupExpansion(transactionId: string) {
        const transaction = transactions.value.find(t => t.id === transactionId)
        if (transaction?.repeaterGroup?.isOriginal) {
            transaction.repeaterGroup.isExpanded = !transaction.repeaterGroup.isExpanded
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
        searchQuery,
        
        // Computed
        uniqueHosts,
        filteredTransactions,
        displayTransactions,
        
        // Actions
        addTransaction,
        selectTransaction,
        clearSelectedTransaction,
        selectHost,
        getHostCount,
        clearTransactions,
        updateSearchQuery,
        clearSearch,
        connect,
        disconnect,
        formatSize,
        
        // Repeater functionality
        repeatRequest,
        toggleGroupExpansion,
        
    }
})
