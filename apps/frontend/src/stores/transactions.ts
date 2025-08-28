import { defineStore } from 'pinia'
import { trpc } from '@/services/trpc'
import type { Transaction } from '@arachne/database'
import { ref } from 'vue'

export const useTransactionsStore = defineStore('transactions', () => {
    const transactions = ref<Transaction[]>([])

    return {
        transactions,
    }
})
