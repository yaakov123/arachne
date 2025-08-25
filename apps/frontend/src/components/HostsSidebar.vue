<template>
    <Sidebar class="hosts-sidebar">
        <div class="sidebar-content">
            <h2>Hosts</h2>
            <div class="search-container">
                <input 
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search hosts..."
                    class="search-input"
                />
            </div>
            <div class="hosts-list">
                <div 
                    v-for="host in filteredHosts" 
                    :key="host"
                    class="host-item"
                    :class="{ active: transactionsStore.selectedHost === host }"
                    @click="transactionsStore.selectHost(host)"
                >
                    <div class="host-info">
                        <span class="host-name">{{ host }}</span>
                        <div class="host-counts">
                            <span v-if="getHttpCount(host) > 0" class="count-badge http" title="HTTP transactions">
                                🌐 {{ getHttpCount(host) }}
                            </span>
                            <span v-if="getWebSocketCount(host) > 0" class="count-badge websocket" title="WebSocket connections">
                                🔌 {{ getWebSocketCount(host) }}
                            </span>
                        </div>
                    </div>
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
import { ref, computed } from 'vue'
import Sidebar from './Sidebar.vue'
import { useTransactionsStore } from '../stores/transactions'

const transactionsStore = useTransactionsStore()
const searchQuery = ref('')

// Computed property to filter hosts based on search query
const filteredHosts = computed(() => {
    if (!searchQuery.value.trim()) {
        return transactionsStore.uniqueHosts
    }
    
    const query = searchQuery.value.toLowerCase().trim()
    return transactionsStore.uniqueHosts.filter(host => 
        host.toLowerCase().includes(query)
    )
})

// Helper functions for host counts
function getHttpCount(host: string): number {
    return transactionsStore.transactions.filter(t => t.request.url.host === host).length
}

function getWebSocketCount(host: string): number {
    return transactionsStore.getWebSocketHostCount(host)
}


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

.search-container {
    margin-bottom: var(--space-lg);
}

.search-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-subtle);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
}

.search-input:focus {
    outline: none;
    border-color: var(--primary-color);
    background: var(--surface-base);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

[data-theme="dark"] .search-input:focus {
    box-shadow: 0 0 0 3px var(--color-primary-900);
}

.search-input::placeholder {
    color: var(--text-color-secondary);
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

.host-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 1;
    min-width: 0; /* Allow text truncation */
}

.host-favicon {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    object-fit: cover;
    background: var(--surface-subtle);
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

.host-counts {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
}

.count-badge {
    font-size: var(--text-xs);
    padding: 2px var(--space-xs);
    border-radius: var(--radius-xs);
    font-weight: var(--font-medium);
    display: flex;
    align-items: center;
    gap: 2px;
}

.count-badge.http {
    background: var(--color-blue-100);
    color: var(--color-blue-700);
}

.count-badge.websocket {
    background: var(--color-purple-100);
    color: var(--color-purple-700);
}

[data-theme="dark"] .count-badge.http {
    background: var(--color-blue-900);
    color: var(--color-blue-200);
}

[data-theme="dark"] .count-badge.websocket {
    background: var(--color-purple-900);
    color: var(--color-purple-200);
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
    color: var(--color-neutral-200);
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
