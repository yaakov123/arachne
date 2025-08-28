import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { trpc } from '@/services/trpc'
import type { Transaction } from '@arachne/database'
import type {
    BackendEvent,
    TransactionCompleteEvent,
    TransactionData,
    RepeaterMetadata,
} from '@arachne/api-types'
import { useProjectStore } from './project'

// Extended transaction type with UI metadata
export interface TransactionWithMeta extends TransactionData {
    id: string // Database ID
    projectId: string
    createdAt: string
    repeaterGroup?: {
        isOriginal: boolean
        isRepeated: boolean
        isExpanded?: boolean
        parentTransactionId?: string
        childTransactionIds: string[]
    }
}

export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<TransactionWithMeta[]>([])
    const selectedTransaction = ref<TransactionWithMeta | null>(null)
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
            const url = transaction.request.url.full.toLowerCase()
            const path = transaction.request.url.path.toLowerCase()
            const method = transaction.request.method.toLowerCase()
            const status = transaction.response?.statusCode?.toString() || ''

            // Search in request headers
            const requestHeaders = transaction.request.headers
                .map((h) => `${h.name}:${h.value}`.toLowerCase())
                .join(' ')

            // Search in response headers
            const responseHeaders =
                transaction.response?.headers
                    ?.map((h) => `${h.name}:${h.value}`.toLowerCase())
                    .join(' ') || ''

            return (
                url.includes(query) ||
                path.includes(query) ||
                method.includes(query) ||
                status.includes(query) ||
                requestHeaders.includes(query) ||
                responseHeaders.includes(query)
            )
        })
    })

    const displayTransactions = computed(() => {
        // Filter transactions based on repeater groups
        return filteredTransactions.value.filter((transaction) => {
            // Always show original transactions
            if (!transaction.repeaterGroup?.isRepeated) {
                return true
            }

            // For repeated transactions, only show if their parent is expanded
            const parentTransaction = transactions.value.find(
                (t) => t.id === transaction.repeaterGroup?.parentTransactionId
            )
            return parentTransaction?.repeaterGroup?.isExpanded ?? false
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
            const transformedTransactions: TransactionWithMeta[] =
                result.transactions.map(transformDatabaseTransaction)

            // Process repeater relationships
            processRepeaterGroups(transformedTransactions)

            transactions.value = transformedTransactions
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
            const subscription = trpc.subscriptions.events.subscribe(
                undefined,
                {
                    onData: handleBackendEvent,
                    onError: (error) => {
                        console.error('Subscription error:', error)
                        isConnected.value = false
                    },
                    onComplete: () => {
                        console.log('Subscription completed')
                        isConnected.value = false
                    },
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

    const selectTransaction = (transaction: TransactionWithMeta) => {
        selectedTransaction.value = transaction
    }

    const clearSelectedTransaction = () => {
        selectedTransaction.value = null
    }

    const updateSearchQuery = (query: string) => {
        searchQuery.value = query
    }

    const toggleGroupExpansion = (originalTransactionId: string) => {
        const transaction = transactions.value.find(
            (t) => t.id === originalTransactionId
        )
        if (transaction?.repeaterGroup?.isOriginal) {
            transaction.repeaterGroup.isExpanded =
                !transaction.repeaterGroup.isExpanded
        }
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
                originalTransactionId: transactionId,
                transaction: {
                    request: transaction.request,
                },
            })
        } catch (error) {
            console.error('Failed to repeat request:', error)
            throw error
        }
    }

    // Helper functions
    const handleBackendEvent = (event: BackendEvent) => {
        if (event.type === 'transactionComplete') {
            handleTransactionComplete(event as TransactionCompleteEvent)
        }
    }

    const handleTransactionComplete = (event: TransactionCompleteEvent) => {
        const currentProject = projectStore.currentProject
        if (!currentProject) return

        // Transform the event transaction to our format
        const newTransaction: TransactionWithMeta = {
            ...event.transaction,
            id: event.id, // Use event ID as database ID
            projectId: currentProject.id,
            createdAt: event.ts,
        }

        // Check if this is a repeated request
        if (
            event.transaction.repeater?.source === 'repeater' &&
            event.transaction.repeater.originalTransactionId
        ) {
            handleRepeatedTransaction(
                newTransaction,
                event.transaction.repeater
            )
        } else {
            // Add as new original transaction
            transactions.value.unshift(newTransaction)
        }
    }

    const handleRepeatedTransaction = (
        repeatedTransaction: TransactionWithMeta,
        repeaterMeta: RepeaterMetadata
    ) => {
        const originalId = repeaterMeta.originalTransactionId
        if (!originalId) return

        // Find the original transaction
        const originalTransaction = transactions.value.find(
            (t) => t.id === originalId
        )
        if (!originalTransaction) return

        // Set up repeater metadata
        repeatedTransaction.repeaterGroup = {
            isOriginal: false,
            isRepeated: true,
            parentTransactionId: originalId,
            childTransactionIds: [],
        }

        // Update original transaction to track this as a child
        if (!originalTransaction.repeaterGroup) {
            originalTransaction.repeaterGroup = {
                isOriginal: true,
                isRepeated: false,
                isExpanded: false,
                childTransactionIds: [],
            }
        }

        originalTransaction.repeaterGroup.childTransactionIds.push(
            repeatedTransaction.id
        )

        // Add the repeated transaction to the list
        transactions.value.unshift(repeatedTransaction)
    }

    const transformDatabaseTransaction = (
        dbTransaction: any
    ): TransactionWithMeta => {
        // Transform Prisma Transaction to TransactionWithMeta format
        // Note: The backend returns serialized data, so BigInt values come as strings
        return {
            id: dbTransaction.id,
            projectId: dbTransaction.projectId,
            createdAt: dbTransaction.timestamp,
            request: {
                method: dbTransaction.method,
                url: {
                    full: dbTransaction.urlFull,
                    protocol: dbTransaction.urlProtocol,
                    host: dbTransaction.urlHost,
                    port: dbTransaction.urlPort || undefined,
                    path: dbTransaction.urlPath,
                    query: dbTransaction.urlQuery || undefined,
                    fragment: dbTransaction.urlFragment || undefined,
                },
                headers: [], // Basic transaction doesn't include headers
                rawHeaders: {},
                clientIp: dbTransaction.clientIp || undefined,
                body: undefined, // Basic transaction doesn't include body
            },
            response: dbTransaction.statusCode
                ? {
                      statusCode: dbTransaction.statusCode,
                      statusMessage: dbTransaction.statusMessage || undefined,
                      headers: [], // Basic transaction doesn't include headers
                      rawHeaders: {},
                      body: undefined, // Basic transaction doesn't include body
                  }
                : undefined,
            timing: {
                startTime:
                    typeof dbTransaction.startTime === 'string'
                        ? parseInt(dbTransaction.startTime)
                        : Number(dbTransaction.startTime),
                responseTime: dbTransaction.responseTime
                    ? typeof dbTransaction.responseTime === 'string'
                        ? parseInt(dbTransaction.responseTime)
                        : Number(dbTransaction.responseTime)
                    : undefined,
                duration: dbTransaction.duration || undefined,
            },
            summary: {
                requestSize: dbTransaction.requestSize || undefined,
                responseSize: dbTransaction.responseSize || undefined,
                hasRequestBody: dbTransaction.hasRequestBody,
                hasResponseBody: dbTransaction.hasResponseBody,
            },
            repeater: undefined, // Basic transaction doesn't include repeater metadata
        }
    }

    const processRepeaterGroups = (transactions: TransactionWithMeta[]) => {
        // Process repeater relationships for existing transactions
        // This would analyze repeater metadata and set up parent-child relationships
        // Implementation depends on how repeater data is stored in the database
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
        displayTransactions,

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
