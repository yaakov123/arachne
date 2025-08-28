<template>
    <div class="logger-view">
        <HostsSidebar />

        <main class="logger-main">
            <div class="search-bar-container">
                <div class="search-input-wrapper">
                    <Search class="search-icon" :size="16" />
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search URLs, paths, or file extensions..."
                        class="search-input"
                        title="Search by URL, path, or file extension. Supports partial matches."
                    />
                    <button
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        class="search-clear"
                        title="Clear search"
                    >
                        ×
                    </button>
                </div>
            </div>
            <div ref="trafficListContainer" class="traffic-list-container">
                <div
                    v-if="transactionsStore.isCurrentlyLoading"
                    class="loading-overlay"
                >
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p class="loading-text">Loading transactions...</p>
                    </div>
                </div>
                <TrafficList />
            </div>
            <template v-if="transactionsStore.selectedTransaction">
                <Resizer
                    direction="vertical"
                    :first-element="trafficListContainer"
                    :second-element="requestResponseContainer"
                    :min-size="150"
                    :initial-first-size="400"
                    :initial-second-size="300"
                />
                <div
                    ref="requestResponseContainer"
                    class="request-response-container"
                >
                    <RequestResponseViewer
                        @close="transactionsStore.clearSelectedTransaction()"
                        :transaction="transactionsStore.selectedTransaction"
                    />
                </div>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import HostsSidebar from '../components/HostsSidebar.vue'
import TrafficList from '../components/TrafficList.vue'
import RequestResponseViewer from '../components/RequestResponseViewer.vue'
import Resizer from '../components/Resizer.vue'
import { useTransactionsStore } from '../stores/transactions'
import { useProjectStore } from '../stores/project'
import { useHostsStore } from '../stores/hosts'
import { Search } from 'lucide-vue-next'

const transactionsStore = useTransactionsStore()
const projectStore = useProjectStore()
const hostsStore = useHostsStore()

// Element references
const trafficListContainer = ref<HTMLElement>()
const requestResponseContainer = ref<HTMLElement>()

// Search functionality
const searchQuery = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Debounced search to improve performance
const debouncedSearch = (query: string) => {
    if (searchTimeout) {
        clearTimeout(searchTimeout)
    }

    searchTimeout = setTimeout(() => {
        transactionsStore.updateSearchQuery(query)
    }, 500) // 150ms debounce delay
}

// Watch for search changes and update the store with debouncing
watch(searchQuery, (newQuery) => {
    debouncedSearch(newQuery)
})

// Lifecycle
onMounted(async () => {
    try {
        await projectStore.initialize()
        // First fetch existing transactions from the current project
        await transactionsStore.fetchExistingTransactions()
        // Then connect to WebSocket for real-time updates
        await transactionsStore.connect()
    } catch (error) {
        console.error('Failed to initialize Logger:', error)
    }
})

onUnmounted(() => {
    // Clean up debounce timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout)
    }
    transactionsStore.disconnect()
})
</script>

<style scoped>
.logger-view {
    display: flex;
    height: calc(100vh - 32px);
    width: 100%;
    background: var(--surface-ground);
}

.logger-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.search-bar-container {
    padding: var(--space-md);
    background: var(--surface-card);
    border-bottom: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
}

.host-filter-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: var(--radius-md);
    padding: var(--space-xs) var(--space-md);
    font-size: var(--text-sm);
}

[data-theme='dark'] .host-filter-indicator {
    background: var(--color-primary-900);
    border-color: var(--color-primary-700);
}

.filter-label {
    color: var(--text-color-secondary);
    font-weight: var(--font-medium);
}

.filter-host {
    color: var(--primary-color);
    font-weight: var(--font-semibold);
}

.filter-clear {
    background: none;
    border: none;
    color: var(--text-color-secondary);
    cursor: pointer;
    font-size: var(--text-md);
    font-weight: bold;
    padding: var(--space-xs);
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
}

.filter-clear:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 500px;
}

.search-icon {
    position: absolute;
    left: var(--space-sm);
    color: var(--text-color-secondary);
    pointer-events: none;
    z-index: 1;
}

.search-input {
    width: 100%;
    padding: var(--space-sm) var(--space-xl) var(--space-sm)
        calc(var(--space-xl) + var(--space-xs));
    border: 2px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-ground);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
    outline: none;
}

.search-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.search-input::placeholder {
    color: var(--text-color-secondary);
    opacity: 0.7;
}

.search-clear {
    position: absolute;
    right: var(--space-sm);
    background: none;
    border: none;
    color: var(--text-color-secondary);
    cursor: pointer;
    font-size: var(--text-lg);
    font-weight: bold;
    padding: var(--space-xs);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
}

.search-clear:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.traffic-list-container {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex: 1; /* Take full height when no resizer is present */
    position: relative;
}

.request-response-container {
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--surface-card) 95%, transparent);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}

.loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--surface-border);
    border-top: 3px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.loading-text {
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
    margin: 0;
    font-weight: 500;
}
</style>
