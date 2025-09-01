import { defineStore } from 'pinia'
import { ref, computed, nextTick, watch, readonly } from 'vue'
import { trpc } from '@/services/trpc'
import type { FullTransaction, Transaction } from '@arachne/database'
import { useProjectStore } from './project'
import { useHostsStore } from './hosts'

// Define the transaction filter interface
interface TransactionFilters {
    projectId: string
    hostId?: string
    searchQuery?: string
    limit?: number
    offset?: number
    includeRelatedData?: boolean
}

export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<Transaction[]>([])
    const selectedTransaction = ref<FullTransaction | null>(null)
    const isLoading = ref(false)
    const isConnected = ref(false)

    // Centralized filter state
    const currentFilters = ref<Omit<TransactionFilters, 'projectId'>>({
        limit: 100,
        offset: 0,
        includeRelatedData: false,
    })

    // Legacy state for backward compatibility (will be removed)
    const searchQuery = ref('')
    const searchResults = ref<Transaction[]>([])
    const isSearching = ref(false)
    const hostFilteredTransactions = ref<Transaction[]>([])
    const isLoadingHostFiltered = ref(false)

    // Subscription state
    let subscriptionUnsubscribe: (() => void) | null = null

    // Store dependencies
    const projectStore = useProjectStore()
    const hostsStore = useHostsStore()

    // Centralized filtering function
    const fetchFilteredTransactions = async (
        filters?: Partial<Omit<TransactionFilters, 'projectId'>>
    ) => {
        const currentProject = projectStore.currentProject
        if (!currentProject) {
            console.warn('No active project to fetch transactions for')
            return
        }

        // Update current filters with new values
        if (filters) {
            currentFilters.value = { ...currentFilters.value, ...filters }
        }

        const fullFilters: TransactionFilters = {
            projectId: currentProject.id,
            ...currentFilters.value,
        }

        isLoading.value = true
        try {
            const result = await trpc.transactions.getFiltered.query(
                fullFilters
            )
            transactions.value = result.transactions
        } catch (error) {
            console.error('Failed to fetch filtered transactions:', error)
            throw error
        } finally {
            isLoading.value = false
        }
    }

    // Update search query and trigger filtering
    const updateSearchQuery = (query: string) => {
        searchQuery.value = query
        const searchQuery_clean = query.trim() || undefined
        fetchFilteredTransactions({ searchQuery: searchQuery_clean, offset: 0 })
    }

    // Update host filter and trigger filtering
    const updateHostFilter = (hostId: string | null) => {
        fetchFilteredTransactions({ hostId: hostId || undefined, offset: 0 })
    }

    // Clear all filters
    const clearAllFilters = () => {
        searchQuery.value = ''
        currentFilters.value = {
            limit: 100,
            offset: 0,
            includeRelatedData: false,
        }
        fetchFilteredTransactions()
    }

    // Legacy helper functions (kept for backward compatibility)
    const fetchTransactionsByHost = async (hostId: string) => {
        updateHostFilter(hostId)
    }

    const clearHostFilter = () => {
        updateHostFilter(null)
    }

    // Watch for host selection changes
    watch(
        () => hostsStore.selectedHost,
        async (newHost, oldHost) => {
            if (newHost !== oldHost) {
                updateHostFilter(newHost)
            }
        }
    )

    // Watch for project changes and reconnect websocket
    watch(
        () => projectStore.currentProject,
        async (newProject, oldProject) => {
            if (newProject?.id !== oldProject?.id) {
                console.log('Project changed, reconnecting websocket...', {
                    from: oldProject?.id,
                    to: newProject?.id,
                })

                // Clear existing transactions and filters
                transactions.value = []
                selectedTransaction.value = null
                clearAllFilters()

                // Reconnect websocket if we were connected
                if (isConnected.value) {
                    disconnect()
                    if (newProject) {
                        await connect()
                        await fetchFilteredTransactions()
                    }
                }
            }
        }
    )

    // Computed
    const filteredTransactions = computed(() => {
        // With centralized filtering, all filtering is done on the backend
        return transactions.value
    })

    const isCurrentlyLoading = computed(() => {
        return isLoading.value
    })

    // Legacy computed properties (kept for backward compatibility)
    const currentTransactions = computed(() => {
        return transactions.value
    })

    // Actions
    const fetchExistingTransactions = async () => {
        // Use the centralized filtering approach
        await fetchFilteredTransactions()
    }

    const connect = async () => {
        if (isConnected.value) return

        try {
            isConnected.value = true

            // Subscribe to transaction events via tRPC subscription
            const subscription = trpc.subscriptions.transactions.subscribe(
                undefined,
                {
                    onData: onTransaction,
                }
            )

            // Store unsubscribe function
            subscriptionUnsubscribe = () => {
                subscription.unsubscribe()
            }

            console.log(
                'Connected to tRPC subscription for real-time transactions'
            )
        } catch (error) {
            isConnected.value = false
            console.error('Failed to connect to tRPC subscription:', error)
            throw error
        }
    }

    const disconnect = () => {
        if (!isConnected.value) return

        if (subscriptionUnsubscribe) {
            subscriptionUnsubscribe()
            subscriptionUnsubscribe = null
        }

        isConnected.value = false
        console.log('Disconnected from tRPC subscription')
    }

    const selectTransaction = async (transaction: Transaction) => {
        isLoading.value = true
        const result = await trpc.transactions.getFullTransaction.query({
            id: transaction.id,
        })
        selectedTransaction.value = result.transaction
        isLoading.value = false
    }

    const clearSelectedTransaction = () => {
        selectedTransaction.value = null
    }

    // Legacy search method (kept for backward compatibility)
    const performSearch = async (query: string) => {
        updateSearchQuery(query)
    }

    // Helper functions
    const onTransaction = (
        event: Omit<Transaction, 'projectId' | 'hostId'>
    ) => {
        console.log('onTransaction', event)
        if (!projectStore.currentProject) return
        const transaction: Transaction = {
            ...event,
            projectId: projectStore.currentProject.id,
            hostId: '',
        }
        handleTransactionComplete(transaction)
    }

    const handleTransactionComplete = (transaction: Transaction) => {
        transactions.value.unshift(transaction)
    }

    return {
        // State
        transactions,
        selectedTransaction,
        isLoading,
        isConnected,
        currentFilters: readonly(currentFilters),

        // Legacy state (backward compatibility)
        searchQuery,
        searchResults,
        isSearching,
        hostFilteredTransactions,
        isLoadingHostFiltered,

        // Computed
        filteredTransactions,
        isCurrentlyLoading,
        currentTransactions, // legacy

        // Actions
        fetchExistingTransactions,
        fetchFilteredTransactions,
        updateSearchQuery,
        updateHostFilter,
        clearAllFilters,

        // Legacy actions (backward compatibility)
        fetchTransactionsByHost,
        clearHostFilter,
        performSearch,

        // Core actions
        connect,
        disconnect,
        selectTransaction,
        clearSelectedTransaction,
    }
})
