<template>
    <div class="traffic-list">
        <TrafficHeader />
        <div class="traffic-entries">
            <TrafficEntry
                v-for="transaction in transactionsStore.displayTransactions"
                :key="transaction.id"
                :transaction="transaction"
                :is-selected="
                    transactionsStore.selectedTransaction?.id === transaction.id
                "
                :is-parent-highlighted="isParentHighlighted(transaction)"
                @select="transactionsStore.selectTransaction"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useTransactionsStore } from '../stores/transactions'
import type { TransactionWithMeta } from '../stores/transactions'
import TrafficHeader from './TrafficHeader.vue'
import TrafficEntry from './TrafficEntry.vue'

const transactionsStore = useTransactionsStore()

// Check if a transaction should be highlighted as a parent
function isParentHighlighted(transaction: TransactionWithMeta): boolean {
    const selectedTransaction = transactionsStore.selectedTransaction

    // If no transaction is selected, no parent highlighting
    if (!selectedTransaction) return false

    // If the selected transaction is a repeated request, highlight its parent
    if (
        selectedTransaction.repeaterGroup?.isRepeated &&
        selectedTransaction.repeaterGroup.parentTransactionId === transaction.id
    ) {
        return true
    }

    return false
}
</script>

<style scoped>
.traffic-list {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--surface-card);
    margin: var(--space-sm);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
}

.traffic-entries {
    flex: 1;
    overflow-y: auto;
    /* Enhanced padding for better nested item display and tree view */
    padding: var(--space-sm) var(--space-md) var(--space-lg) var(--space-md);
    /* Improved spacing for nested hierarchy */
    display: flex;
    flex-direction: column;
    gap: 1px; /* Minimal gap for better tree line continuity */

    /* Smooth scrolling for better UX */
    scroll-behavior: smooth;

    /* Custom scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: var(--color-neutral-300) transparent;
}

.traffic-entries::-webkit-scrollbar {
    width: 6px;
}

.traffic-entries::-webkit-scrollbar-track {
    background: transparent;
}

.traffic-entries::-webkit-scrollbar-thumb {
    background-color: var(--color-neutral-300);
    border-radius: var(--radius-full);
    transition: background-color var(--transition-fast);
}

.traffic-entries::-webkit-scrollbar-thumb:hover {
    background-color: var(--color-neutral-400);
}
</style>
