<template>
    <div class="traffic-list">
        <TrafficHeader />
        <div class="traffic-entries">
            <TrafficEntry
                v-for="transaction in transactionsStore.filteredTransactions" 
                :key="transaction.id"
                :transaction="transaction"
                :is-selected="transactionsStore.selectedTransaction?.id === transaction.id"
                @select="transactionsStore.selectTransaction"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useTransactionsStore } from '../stores/transactions'
import TrafficHeader from './TrafficHeader.vue'
import TrafficEntry from './TrafficEntry.vue'

const transactionsStore = useTransactionsStore()
</script>

<style scoped>
.traffic-list {
    flex: 1;
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
}
</style>
