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
                <div ref="requestResponseContainer" class="request-response-container">
                    <RequestResponseViewer />
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
import { Search } from 'lucide-vue-next'

const transactionsStore = useTransactionsStore()

// Element references
const trafficListContainer = ref<HTMLElement>()
const requestResponseContainer = ref<HTMLElement>()

// Search functionality
const searchQuery = ref('')

// Watch for search changes and update the store
watch(searchQuery, (newQuery) => {
    transactionsStore.updateSearchQuery(newQuery)
})

// Lifecycle
onMounted(async () => {
    try {
        await transactionsStore.connect()
    } catch (error) {
        console.error('Failed to connect to WebSocket:', error)
    }
})

onUnmounted(() => {
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
    justify-content: center;
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
    padding: var(--space-sm) var(--space-xl) var(--space-sm) calc(var(--space-xl) + var(--space-xs));
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
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 20%, transparent);
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
}

.request-response-container {
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
</style>
