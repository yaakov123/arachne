import { defineStore } from 'pinia'
import { trpc } from '@/services/trpc'
import type { Transaction } from '@arachne/database'
import { ref } from 'vue'

// Frontend transaction with repeater grouping metadata
export interface RepeaterGroupMeta {
    isOriginal: boolean // True for the original request
    isRepeated: boolean // True for repeated requests
    parentTransactionId?: string // For repeated requests, links to original
    childTransactionIds: string[] // For original requests, list of repeated IDs
    isExpanded: boolean // UI state for expand/collapse
}

export const useTransactionsStore = defineStore('transactions', () => {
    const transactions = ref<Transaction[]>([])

    return {
        transactions,
    }
})
