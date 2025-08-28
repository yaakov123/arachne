<template>
    <div class="traffic-list">
        <TrafficHeader />
        <div class="traffic-entries" ref="entriesContainer">
            <TrafficEntry
                v-for="transaction in transactionsStore.filteredTransactions"
                :key="transaction.id"
                :transaction="transaction"
                :is-selected="
                    transactionsStore.selectedTransaction?.id === transaction.id
                "
                @select="transactionsStore.selectTransaction"
            />
        </div>

        <!-- Scroll to highlighted button -->
        <button
            v-if="hasHighlightedItem"
            class="scroll-to-highlighted-btn"
            @click="scrollToHighlighted"
            :title="'Scroll to highlighted item'"
        >
            <LocateFixed :size="16" />
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { LocateFixed } from 'lucide-vue-next'
import { useTransactionsStore } from '../stores/transactions'
import TrafficHeader from './TrafficHeader.vue'
import TrafficEntry from './TrafficEntry.vue'
import type { Transaction } from '@arachne/database'

const transactionsStore = useTransactionsStore()

// Template refs
const entriesContainer = ref<HTMLElement>()

// Computed property to check if there's any highlighted item
const hasHighlightedItem = computed(() => {
    return transactionsStore.selectedTransaction !== null
})

// Function to scroll to the highlighted item
async function scrollToHighlighted() {
    if (!entriesContainer.value) return

    // Wait for next tick to ensure DOM is updated
    await nextTick()

    // Find the highlighted transaction
    let targetTransactionId: string | null = null

    // First priority: selected transaction
    if (transactionsStore.selectedTransaction) {
        targetTransactionId = transactionsStore.selectedTransaction.id
    }

    if (!targetTransactionId) return

    // Find the DOM element using data attribute
    const targetElement = entriesContainer.value.querySelector(
        `[data-transaction-id="${targetTransactionId}"]`
    ) as HTMLElement

    if (!targetElement) return

    // Calculate scroll position to center the highlighted item
    const containerRect = entriesContainer.value.getBoundingClientRect()
    const elementRect = targetElement.getBoundingClientRect()

    const containerScrollTop = entriesContainer.value.scrollTop
    const elementOffsetTop =
        elementRect.top - containerRect.top + containerScrollTop
    const scrollPosition =
        elementOffsetTop - containerRect.height / 2 + elementRect.height / 2

    // Smooth scroll to the target position
    entriesContainer.value.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth',
    })
}
</script>

<style scoped>
.traffic-list {
    /* Define shared grid layout variables */
    --traffic-grid-columns: 40px 80px 1fr 80px 100px;
    --traffic-grid-gap: var(--space-md);

    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--surface-card);
    overflow: hidden;
    position: relative;
}

.traffic-entries {
    flex: 1;
    overflow-y: auto;
    /* Enhanced padding for better nested item display and tree view */
    padding: var(--space-md) 0;
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

/* Scroll to highlighted button */
.scroll-to-highlighted-btn {
    position: absolute;
    bottom: var(--space-lg);
    right: var(--space-lg);
    width: 40px;
    height: 40px;
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-primary-500);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    transition: all var(--transition-fast);
    z-index: 10;
}

.scroll-to-highlighted-btn:hover {
    background: var(--color-primary-600);
    box-shadow: var(--shadow-xl);
    transform: translateY(-1px);
}

.scroll-to-highlighted-btn:active {
    transform: translateY(0);
    box-shadow: var(--shadow-md);
}

/* Responsive grid layout adjustments */
@media (max-width: 768px) {
    .traffic-list {
        --traffic-grid-columns: 32px 60px 1fr 60px 80px;
        --traffic-grid-gap: var(--space-sm);
    }
}

@media (max-width: 480px) {
    .traffic-list {
        --traffic-grid-columns: 24px 50px 1fr 50px;
        --traffic-grid-gap: var(--space-xs);
    }
}
</style>
