import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '../services/ws'
import type { TransactionCompleteEvent, TransactionData, TransactionDependency } from '@arachne/api-types'

export type TransactionWithMeta = TransactionData & { 
    id: string
    timestamp: number 
    dependencies?: TransactionDependency[]
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

    const dependencyGraph = computed(() => {
        const graph = new Map<string, string[]>() // transactionId -> [dependent transactionIds]
        
        for (const transaction of transactions.value) {
            if (transaction.dependencies && transaction.dependencies.length > 0) {
                for (const dep of transaction.dependencies) {
                    if (!graph.has(dep.sourceTransactionId)) {
                        graph.set(dep.sourceTransactionId, [])
                    }
                    graph.get(dep.sourceTransactionId)!.push(transaction.id)
                }
            }
        }
        
        return graph
    })

    const transactionDependencies = computed(() => {
        const deps = new Map<string, TransactionDependency[]>() // transactionId -> dependencies
        
        for (const transaction of transactions.value) {
            if (transaction.dependencies && transaction.dependencies.length > 0) {
                deps.set(transaction.id, transaction.dependencies)
            }
        }
        
        return deps
    })

    // Actions
    function addTransaction(transactionEvent: TransactionCompleteEvent) {
        const transactionWithMeta: TransactionWithMeta = {
            ...transactionEvent.transaction,
            id: transactionEvent.id,
            timestamp: new Date(transactionEvent.ts).getTime(),
            dependencies: transactionEvent.dependencies
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

    function updateSearchQuery(query: string) {
        searchQuery.value = query
    }

    function clearSearch() {
        searchQuery.value = ''
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

    // Dependency helper functions
    function getTransactionDependencies(transactionId: string): TransactionDependency[] {
        return transactionDependencies.value.get(transactionId) || []
    }

    function getDependentTransactions(transactionId: string): TransactionWithMeta[] {
        const dependentIds = dependencyGraph.value.get(transactionId) || []
        return dependentIds.map(id => transactions.value.find(t => t.id === id))
                         .filter(Boolean) as TransactionWithMeta[]
    }

    function getSourceTransaction(dependency: TransactionDependency): TransactionWithMeta | undefined {
        return transactions.value.find(t => t.id === dependency.sourceTransactionId)
    }

    function hasAuthDependencies(transactionId: string): boolean {
        const deps = getTransactionDependencies(transactionId)
        return deps.some(dep => dep.type === 'auth_token' || dep.type === 'cookie')
    }

    function getDependencyChain(transactionId: string): TransactionWithMeta[] {
        const chain: TransactionWithMeta[] = []
        const visited = new Set<string>()
        
        function collectChain(id: string) {
            if (visited.has(id)) return
            visited.add(id)
            
            const transaction = transactions.value.find(t => t.id === id)
            if (!transaction) return
            
            chain.push(transaction)
            
            // Follow dependencies backwards
            const deps = getTransactionDependencies(id)
            for (const dep of deps) {
                collectChain(dep.sourceTransactionId)
            }
        }
        
        collectChain(transactionId)
        return chain.reverse() // Order from source to target
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
        dependencyGraph,
        transactionDependencies,
        
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
        
        // Dependency helpers
        getTransactionDependencies,
        getDependentTransactions,
        getSourceTransaction,
        hasAuthDependencies,
        getDependencyChain
    }
})
