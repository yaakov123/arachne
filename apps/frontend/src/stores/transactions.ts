import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { wsClient } from '../services/ws'
import { api } from '../services/http'
import { useProjectStore } from './project'
import {
    HttpRoutes,
    type RepeatRequestBody,
    type RepeatResponse,
} from '@arachne/api-types'
import type {
    TransactionCompleteEvent,
    TransactionData,
} from '@arachne/api-types'

// Frontend transaction with repeater grouping metadata
export interface RepeaterGroupMeta {
    isOriginal: boolean // True for the original request
    isRepeated: boolean // True for repeated requests
    parentTransactionId?: string // For repeated requests, links to original
    childTransactionIds: string[] // For original requests, list of repeated IDs
    isExpanded: boolean // UI state for expand/collapse
}

export type TransactionWithMeta = TransactionData & {
    id: string
    timestamp: number
    repeaterGroup?: RepeaterGroupMeta
}

// Removed AdvancedFilters interface - now using simple search query

export const useTransactionsStore = defineStore('transactions', () => {
    // Get project store for watching project changes
    const projectStore = useProjectStore()

    // State
    const transactions = ref<TransactionWithMeta[]>([])
    const selectedTransaction = ref<TransactionWithMeta | null>(null)
    const selectedHost = ref<string | null>(null)
    const isConnected = ref(false)
    const connectionError = ref<string | null>(null)
    const searchQuery = ref<string>('')

    // Optimization: maintain a Map for O(1) transaction lookup during real-time processing
    const transactionLookup = ref<Map<string, TransactionWithMeta>>(new Map())

    // Computed
    const uniqueHosts = computed(() => {
        const hosts = new Set<string>()
        transactions.value.forEach((t) => hosts.add(t.request.url.host))
        return Array.from(hosts).sort()
    })

    const filteredTransactions = computed(() => {
        let filtered = transactions.value

        // Host filter
        if (selectedHost.value) {
            filtered = filtered.filter(
                (t) => t.request.url.host === selectedHost.value
            )
        }

        // URL/Path search filter
        if (searchQuery.value) {
            const query = searchQuery.value.toLowerCase()
            filtered = filtered.filter(
                (t) =>
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
                    const childIds =
                        transaction.repeaterGroup.childTransactionIds
                    const children = transactions.value.filter((t) =>
                        childIds.includes(t.id)
                    )
                    result.push(
                        ...children.sort((a, b) => b.timestamp - a.timestamp)
                    )
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
            transactionLookup.value.set(
                transactionWithMeta.id,
                transactionWithMeta
            )
        }

        // Keep only last 1000 transactions to prevent memory issues
        if (transactions.value.length > 1000) {
            const removedTransactions = transactions.value.slice(1000)
            transactions.value = transactions.value.slice(0, 1000)

            // Clean up lookup map for removed transactions
            removedTransactions.forEach((t) =>
                transactionLookup.value.delete(t.id)
            )
        }
    }

    function handleRepeatedTransaction(
        repeatedTransaction: TransactionWithMeta
    ) {
        const originalId = repeatedTransaction.repeater?.originalTransactionId

        if (!originalId) {
            transactions.value.unshift(repeatedTransaction)
            transactionLookup.value.set(
                repeatedTransaction.id,
                repeatedTransaction
            )
            return
        }

        // Use Map for O(1) lookup instead of array.find()
        const originalTransaction = transactionLookup.value.get(originalId)

        if (originalTransaction) {
            // Initialize repeater group if needed
            if (!originalTransaction.repeaterGroup) {
                originalTransaction.repeaterGroup = {
                    isOriginal: true,
                    isRepeated: false,
                    parentTransactionId: undefined,
                    childTransactionIds: [],
                    isExpanded: false,
                }
            }

            // Mark repeated transaction and link to parent
            repeatedTransaction.repeaterGroup = {
                isOriginal: false,
                isRepeated: true,
                parentTransactionId: originalId,
                childTransactionIds: [],
                isExpanded: false,
            }

            // Add to child list and add to transactions
            originalTransaction.repeaterGroup.childTransactionIds.push(
                repeatedTransaction.id
            )
            transactions.value.unshift(repeatedTransaction)
        } else {
            // Original not found - treat as standalone
            transactions.value.unshift(repeatedTransaction)
        }

        // Always add to lookup map
        transactionLookup.value.set(repeatedTransaction.id, repeatedTransaction)
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
        return transactions.value.filter((t) => t.request.url.host === host)
            .length
    }

    function clearTransactions() {
        transactions.value = []
        selectedTransaction.value = null
        transactionLookup.value.clear()
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
            const transaction = transactions.value.find(
                (t) => t.id === transactionId
            )
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
                        summary: transaction.summary,
                    },
                } satisfies RepeatRequestBody),
            })

            if (!response.ok) {
                throw new Error(
                    `Failed to repeat request: ${response.statusText}`
                )
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
        const transaction = transactions.value.find(
            (t) => t.id === transactionId
        )
        if (transaction?.repeaterGroup?.isOriginal) {
            transaction.repeaterGroup.isExpanded =
                !transaction.repeaterGroup.isExpanded
        }
    }

    // WebSocket event handler
    function handleWebSocketEvent(event: any) {
        if (event.type === 'transactionComplete') {
            addTransaction(event as TransactionCompleteEvent)
        }
    }

    // Optimized batch processing for handling repeated transactions
    function handleRepeatedTransactionsBatch(
        repeatedTransactions: TransactionWithMeta[],
        transactionMap: Map<string, TransactionWithMeta>
    ) {
        for (const repeatedTransaction of repeatedTransactions) {
            const originalId =
                repeatedTransaction.repeater?.originalTransactionId

            if (!originalId) {
                continue
            }

            const originalTransaction = transactionMap.get(originalId)

            if (originalTransaction) {
                // Initialize repeater group if needed
                if (!originalTransaction.repeaterGroup) {
                    originalTransaction.repeaterGroup = {
                        isOriginal: true,
                        isRepeated: false,
                        parentTransactionId: undefined,
                        childTransactionIds: [],
                        isExpanded: false,
                    }
                }

                // Mark repeated transaction and link to parent
                repeatedTransaction.repeaterGroup = {
                    isOriginal: false,
                    isRepeated: true,
                    parentTransactionId: originalId,
                    childTransactionIds: [],
                    isExpanded: false,
                }

                // Add to child list
                originalTransaction.repeaterGroup.childTransactionIds.push(
                    repeatedTransaction.id
                )
            }
        }
    }

    // Fetch existing transactions for a specific project or current project
    async function fetchExistingTransactions(
        projectId?: string
    ): Promise<void> {
        try {
            let targetProjectId = projectId

            // If no project ID provided, get current project
            if (!targetProjectId) {
                const currentProjectResponse = await api.getCurrentProject()
                if (!currentProjectResponse.currentProject) {
                    // No active project, clear transactions and return
                    transactions.value = []
                    selectedTransaction.value = null
                    return
                }
                targetProjectId = currentProjectResponse.currentProject
            }

            // Fetch transactions for the target project
            const response = await api.getProjectTransactions(targetProjectId)

            if (response.ok && response.transactions) {
                // Clear existing transactions and add the fetched ones
                transactions.value = []
                selectedTransaction.value = null
                transactionLookup.value.clear()

                // Pre-allocate arrays for better performance
                const newTransactions: TransactionWithMeta[] = []
                const repeatedTransactions: TransactionWithMeta[] = []

                // Create a map for O(1) transaction lookup
                const transactionMap = new Map<string, TransactionWithMeta>()

                // First pass: convert all transactions and categorize them
                for (const transactionEvent of response.transactions) {
                    const transactionWithMeta: TransactionWithMeta = {
                        ...transactionEvent.transaction,
                        id: transactionEvent.id,
                        timestamp: new Date(transactionEvent.ts).getTime(),
                    }

                    // Add to map for fast lookup
                    transactionMap.set(
                        transactionWithMeta.id,
                        transactionWithMeta
                    )

                    // Categorize transactions
                    if (transactionWithMeta.repeater?.source === 'repeater') {
                        repeatedTransactions.push(transactionWithMeta)
                    } else {
                        newTransactions.push(transactionWithMeta)
                    }
                }

                // Second pass: handle repeated transactions in batch
                handleRepeatedTransactionsBatch(
                    repeatedTransactions,
                    transactionMap
                )

                // Combine all transactions and sort once
                const allTransactions = [
                    ...newTransactions,
                    ...repeatedTransactions,
                ]
                allTransactions.sort((a, b) => b.timestamp - a.timestamp)

                // Update the reactive array in one operation to minimize Vue reactivity overhead
                transactions.value = allTransactions

                // Update the lookup map for future O(1) access
                transactionLookup.value = transactionMap
            }
        } catch (error) {
            console.error('Failed to fetch existing transactions:', error)
            connectionError.value =
                error instanceof Error
                    ? error.message
                    : 'Failed to fetch transactions'
        }
    }

    // Reload transactions when project changes
    function reloadTransactionsForCurrentProject(): void {
        const currentProjectId = projectStore.currentProjectId
        if (currentProjectId) {
            fetchExistingTransactions(currentProjectId)
        } else {
            // No project selected, clear transactions
            transactions.value = []
            selectedTransaction.value = null
            transactionLookup.value.clear()
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
            connectionError.value =
                error instanceof Error ? error.message : 'Connection failed'
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

    // Watch for project changes and reload transactions
    watch(
        () => projectStore.currentProjectId,
        (newProjectId, oldProjectId) => {
            // Only reload if project actually changed (avoid initial load)
            if (oldProjectId !== undefined && newProjectId !== oldProjectId) {
                reloadTransactionsForCurrentProject()
            }
        }
    )

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
        fetchExistingTransactions,
        reloadTransactionsForCurrentProject,
        connect,
        disconnect,
        formatSize,

        // Repeater functionality
        repeatRequest,
        toggleGroupExpansion,
    }
})
