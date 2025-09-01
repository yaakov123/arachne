import { defineStore } from 'pinia'
import { ref, computed, nextTick, watch } from 'vue'
import { trpc } from '@/services/trpc'
import type { FullTransaction, Transaction } from '@arachne/database'
import { useProjectStore } from './project'
import { useHostsStore } from './hosts'

export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<Transaction[]>([])
    const selectedTransaction = ref<FullTransaction | null>(null)
    const isLoading = ref(false)
    const isConnected = ref(false)
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

    // Helper functions for host filtering
    const fetchTransactionsByHost = async (hostId: string) => {
        const currentProject = projectStore.currentProject
        if (!currentProject) {
            console.warn('No active project to fetch transactions for')
            return
        }

        isLoadingHostFiltered.value = true
        try {
            const result = await trpc.transactions.getByHost.query({
                projectId: currentProject.id,
                hostId: hostId,
                limit: 100, // Fetch large batch for now
                offset: 0,
                includeRelatedData: false,
            })

            hostFilteredTransactions.value = result.transactions
        } catch (error) {
            console.error('Failed to fetch transactions by host:', error)
            throw error
        } finally {
            isLoadingHostFiltered.value = false
        }
    }

    const clearHostFilter = () => {
        hostFilteredTransactions.value = []
        isLoadingHostFiltered.value = false
    }

    // Watch for host selection changes
    watch(
        () => hostsStore.selectedHost,
        async (newHost, oldHost) => {
            if (newHost !== oldHost) {
                if (newHost) {
                    await fetchTransactionsByHost(newHost)
                } else {
                    clearHostFilter()
                }
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

                // Clear existing transactions
                transactions.value = []
                hostFilteredTransactions.value = []
                selectedTransaction.value = null

                // Reconnect websocket if we were connected
                if (isConnected.value) {
                    disconnect()
                    if (newProject) {
                        await connect()
                        await fetchExistingTransactions()
                    }
                }
            }
        }
    )

    // Computed
    const currentTransactions = computed(() => {
        // If there's a search query, use search results
        if (searchQuery.value.trim()) {
            return searchResults.value
        }

        // Use host-filtered transactions if a host is selected, otherwise all transactions
        return hostsStore.selectedHost
            ? hostFilteredTransactions.value
            : transactions.value
    })

    const filteredTransactions = computed(() => {
        // With backend search, we don't need client-side filtering
        return currentTransactions.value
    })

    const isCurrentlyLoading = computed(() => {
        if (searchQuery.value.trim()) {
            return isSearching.value
        }

        return hostsStore.selectedHost
            ? isLoadingHostFiltered.value
            : isLoading.value
    })

    // Actions
    const fetchExistingTransactions = async () => {
        const currentProject = projectStore.currentProject
        if (!currentProject) {
            console.warn('No active project to fetch transactions for')
            return
        }

        isLoading.value = true
        try {
            const result = await trpc.projects.getTransactions.query({
                id: currentProject.id,
                pagination: { offset: 0, limit: 100 }, // Fetch large batch for now
            })

            // Transform database transactions to TransactionWithMeta
            transactions.value = result.transactions
        } catch (error) {
            console.error('Failed to fetch existing transactions:', error)
            throw error
        } finally {
            isLoading.value = false
        }
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

    const updateSearchQuery = (query: string) => {
        searchQuery.value = query
        if (query.trim()) {
            performSearch(query)
        } else {
            searchResults.value = []
        }
    }

    const performSearch = async (query: string) => {
        const currentProject = projectStore.currentProject
        if (!currentProject) {
            console.warn('No active project to search transactions for')
            return
        }

        isSearching.value = true
        try {
            const result = await trpc.transactions.search.query({
                projectId: currentProject.id,
                query: query,
                limit: 100,
                offset: 0,
                hostId: hostsStore.selectedHost || undefined,
            })

            searchResults.value = result.transactions
        } catch (error) {
            console.error('Failed to search transactions:', error)
            searchResults.value = []
        } finally {
            isSearching.value = false
        }
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
        searchQuery,
        searchResults,
        isSearching,
        hostFilteredTransactions,
        isLoadingHostFiltered,

        // Computed
        currentTransactions,
        filteredTransactions,
        isCurrentlyLoading,

        // Actions
        fetchExistingTransactions,
        fetchTransactionsByHost,
        clearHostFilter,
        connect,
        disconnect,
        selectTransaction,
        clearSelectedTransaction,
        updateSearchQuery,
        performSearch,
    }
})
