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
    const isPaginationLoading = ref(false)
    const isConnected = ref(false)

    // Centralized filter state
    const currentFilters = ref<Omit<TransactionFilters, 'projectId'>>({
        limit: 50, // Reduced for pagination
        offset: 0,
        includeRelatedData: false,
    })

    // Pagination state
    const totalTransactions = ref(0)
    const hasMoreTransactions = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(50)

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

        // Use pagination loading for page changes, regular loading for filter changes
        const isPageChange = filters?.offset !== undefined && filters.offset > 0
        if (isPageChange) {
            isPaginationLoading.value = true
        } else {
            isLoading.value = true
        }

        try {
            const result = await trpc.transactions.getFiltered.query(
                fullFilters
            )
            transactions.value = result.transactions
            totalTransactions.value = result.total
            hasMoreTransactions.value = result.hasMore
        } catch (error) {
            console.error('Failed to fetch filtered transactions:', error)
            throw error
        } finally {
            isLoading.value = false
            isPaginationLoading.value = false
        }
    }

    // Helper function to reset pagination
    const resetPagination = () => {
        currentPage.value = 1
        currentFilters.value.offset = 0
    }

    // Update search query and trigger filtering (resets pagination)
    const updateSearchQuery = (query: string) => {
        searchQuery.value = query
        const searchQuery_clean = query.trim() || undefined
        resetPagination()
        fetchFilteredTransactions({ searchQuery: searchQuery_clean, offset: 0 })
    }

    // Update host filter and trigger filtering (resets pagination)
    const updateHostFilter = (hostId: string | null) => {
        resetPagination()
        fetchFilteredTransactions({ hostId: hostId || undefined, offset: 0 })
    }

    // Clear all filters
    const clearAllFilters = () => {
        searchQuery.value = ''
        resetPagination()
        currentFilters.value = {
            limit: pageSize.value,
            offset: 0,
            includeRelatedData: false,
        }
        fetchFilteredTransactions()
    }

    // Pagination functions
    const goToPage = (page: number) => {
        if (page < 1) return

        const maxPage = Math.ceil(totalTransactions.value / pageSize.value)
        if (page > maxPage && maxPage > 0) return

        currentPage.value = page
        const offset = (page - 1) * pageSize.value
        fetchFilteredTransactions({ offset })
    }

    const nextPage = () => {
        if (hasMoreTransactions.value) {
            goToPage(currentPage.value + 1)
        }
    }

    const previousPage = () => {
        if (currentPage.value > 1) {
            goToPage(currentPage.value - 1)
        }
    }

    const updatePageSize = (newPageSize: number) => {
        if (newPageSize < 1 || newPageSize > 100) return // Validation

        pageSize.value = newPageSize
        resetPagination()
        currentFilters.value.limit = newPageSize
        fetchFilteredTransactions({ limit: newPageSize, offset: 0 })
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

    // Pagination computed properties
    const totalPages = computed(() => {
        return Math.ceil(totalTransactions.value / pageSize.value)
    })

    const canGoToPreviousPage = computed(() => {
        return currentPage.value > 1
    })

    const canGoToNextPage = computed(() => {
        return hasMoreTransactions.value
    })

    const paginationInfo = computed(() => {
        const start =
            totalTransactions.value === 0
                ? 0
                : (currentPage.value - 1) * pageSize.value + 1
        const end = Math.min(
            currentPage.value * pageSize.value,
            totalTransactions.value
        )

        return {
            start,
            end,
            total: totalTransactions.value,
            currentPage: currentPage.value,
            totalPages: totalPages.value,
            pageSize: pageSize.value,
        }
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
        // Only add new transactions if we're on the first page and not filtering by search or host
        // This prevents pagination issues when new transactions arrive
        const isOnFirstPage = currentPage.value === 1
        const hasActiveFilters =
            (currentFilters.value.searchQuery &&
                currentFilters.value.searchQuery.trim()) ||
            currentFilters.value.hostId

        if (isOnFirstPage && !hasActiveFilters) {
            transactions.value.unshift(transaction)
            // Update total count
            totalTransactions.value += 1

            // If we exceed page size, remove the last item to maintain consistent page size
            if (transactions.value.length > pageSize.value) {
                transactions.value.pop()
            }
        } else {
            // Just update the total count for pagination accuracy
            totalTransactions.value += 1
        }
    }

    return {
        // State
        transactions,
        selectedTransaction,
        isLoading,
        isPaginationLoading: readonly(isPaginationLoading),
        isConnected,
        currentFilters: readonly(currentFilters),

        // Pagination state
        totalTransactions: readonly(totalTransactions),
        hasMoreTransactions: readonly(hasMoreTransactions),
        currentPage: readonly(currentPage),
        pageSize: readonly(pageSize),

        // Legacy state (backward compatibility)
        searchQuery,
        searchResults,
        isSearching,
        hostFilteredTransactions,
        isLoadingHostFiltered,

        // Computed
        filteredTransactions,
        isCurrentlyLoading,
        totalPages,
        canGoToPreviousPage,
        canGoToNextPage,
        paginationInfo,
        currentTransactions, // legacy

        // Actions
        fetchExistingTransactions,
        fetchFilteredTransactions,
        updateSearchQuery,
        updateHostFilter,
        clearAllFilters,

        // Pagination actions
        goToPage,
        nextPage,
        previousPage,
        updatePageSize,
        resetPagination,

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
