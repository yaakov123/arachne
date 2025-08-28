import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { trpc } from '@/services/trpc'
import type { FullTransaction, Transaction } from '@arachne/database'
import { useProjectStore } from './project'

export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<Transaction[]>([])
    const selectedTransaction = ref<FullTransaction | null>(null)
    const isLoading = ref(false)
    const isConnected = ref(false)
    const searchQuery = ref('')

    // Subscription state
    let subscriptionUnsubscribe: (() => void) | null = null

    // Project store dependency
    const projectStore = useProjectStore()

    // Computed
    const filteredTransactions = computed(() => {
        if (!searchQuery.value.trim()) {
            return transactions.value
        }

        const query = searchQuery.value.toLowerCase()
        return transactions.value.filter((transaction) => {
            // Search in URL, path, method, status, headers
            const url = transaction.urlFull.toLowerCase()
            const path = transaction.urlPath.toLowerCase()
            const method = transaction.method.toLowerCase()
            const status = transaction.statusCode?.toString() || ''

            return (
                url.includes(query) ||
                path.includes(query) ||
                method.includes(query) ||
                status.includes(query)
            )
        })
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
    }

    const toggleGroupExpansion = (originalTransactionId: string) => {
        //noop
    }

    const repeatRequest = async (transactionId: string) => {
        const transaction = transactions.value.find(
            (t) => t.id === transactionId
        )
        if (!transaction) {
            throw new Error('Transaction not found')
        }

        try {
            await trpc.repeater.send.mutate({
                transactionId: transactionId,
            })
        } catch (error) {
            console.error('Failed to repeat request:', error)
            throw error
        }
    }

    // Helper functions
    const onTransaction = (event: Omit<Transaction, 'projectId'>) => {
        if (!projectStore.currentProject) return
        const transaction: Transaction = {
            ...event,
            projectId: projectStore.currentProject.id,
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

        // Computed
        filteredTransactions,

        // Actions
        fetchExistingTransactions,
        connect,
        disconnect,
        selectTransaction,
        clearSelectedTransaction,
        updateSearchQuery,
        toggleGroupExpansion,
        repeatRequest,
    }
})
