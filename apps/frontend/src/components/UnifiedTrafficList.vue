<template>
    <div class="unified-traffic-list">
        <TrafficHeader :unified="true" />
        <div class="traffic-entries">
            <UnifiedTrafficEntry
                v-for="entry in transactionsStore.filteredTrafficEntries" 
                :key="entry.id"
                :entry="entry"
                :is-selected="transactionsStore.selectedTrafficEntry?.id === entry.id"
                @select="transactionsStore.selectTrafficEntry"
            />
            <div v-if="transactionsStore.filteredTrafficEntries.length === 0" class="no-entries">
                <div class="no-entries-icon">🔍</div>
                <div class="no-entries-text">No traffic found</div>
                <div class="no-entries-hint">
                    HTTP transactions and WebSocket connections will appear here when they occur through the proxy
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useTransactionsStore } from '../stores/transactions'
import TrafficHeader from './TrafficHeader.vue'
import UnifiedTrafficEntry from './UnifiedTrafficEntry.vue'

const transactionsStore = useTransactionsStore()
</script>

<style scoped>
.unified-traffic-list {
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
}

.no-entries {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-xl);
    text-align: center;
}

.no-entries-icon {
    font-size: 3rem;
    margin-bottom: var(--space-md);
    opacity: 0.5;
}

.no-entries-text {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-color-secondary);
    margin-bottom: var(--space-sm);
}

.no-entries-hint {
    font-size: var(--text-sm);
    color: var(--text-color-muted);
    max-width: 400px;
    line-height: var(--leading-relaxed);
}
</style>
