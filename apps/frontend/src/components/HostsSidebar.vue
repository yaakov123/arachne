<template>
    <Sidebar class="hosts-sidebar">
        <div class="sidebar-content">
            <h2>Hosts</h2>
            <div class="hosts-list">
                <div 
                    v-for="host in transactionsStore.uniqueHosts" 
                    :key="host"
                    class="host-item"
                    :class="{ active: transactionsStore.selectedHost === host }"
                    @click="transactionsStore.selectHost(host)"
                >
                    <span class="host-name">{{ host }}</span>
                    <span class="host-count">{{ transactionsStore.getHostCount(host) }}</span>
                </div>
            </div>
            <div class="connection-status">
                <span :class="['status-indicator', { connected: transactionsStore.isConnected }]"></span>
                {{ transactionsStore.isConnected ? 'Connected' : 'Disconnected' }}
                <div v-if="transactionsStore.connectionError" class="connection-error">
                    {{ transactionsStore.connectionError }}
                </div>
            </div>
        </div>
    </Sidebar>
</template>

<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import { useTransactionsStore } from '../stores/transactions'

const transactionsStore = useTransactionsStore()
</script>

<style scoped>
.hosts-sidebar {
    width: 280px;
    min-width: 250px;
    max-width: 400px;
    flex-shrink: 0;
}

.sidebar-content {
    height: 100%;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
}

.sidebar-content h2 {
    margin: 0 0 var(--space-lg) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-color);
}

.hosts-list {
    flex: 1;
    overflow-y: auto;
}

.host-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    margin-bottom: var(--space-xs);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: var(--text-sm);
    color: var(--text-color);
}

.host-item:hover {
    background: var(--surface-hover);
}

.host-item.active {
    background: var(--color-primary-50);
    color: var(--primary-color);
}

[data-theme="dark"] .host-item.active {
    background: var(--color-primary-200);
    color: var(--color-primary-950);
}

.host-name {
    font-weight: var(--font-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.host-count {
    background: var(--color-neutral-200);
    color: var(--text-color);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    min-width: 20px;
    text-align: center;
}

[data-theme="dark"] .host-count {
    background: var(--color-neutral-700);
}

.host-item.active .host-count {
    background: var(--color-primary-200);
    color: var(--color-primary-800);
}

[data-theme="dark"] .host-item.active .host-count {
    background: var(--color-primary-800);
    color: var(--color-primary-200);
}

.connection-status {
    margin-top: auto;
    padding-top: var(--space-lg);
    border-top: 1px solid var(--surface-border);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
}

.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-error-500);
}

.status-indicator.connected {
    background: var(--color-success-500);
}

.connection-error {
    margin-top: var(--space-sm);
    font-size: var(--text-xs);
    color: var(--color-error-500);
    font-style: italic;
}
</style>
