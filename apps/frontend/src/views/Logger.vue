<template>
    <div class="logger-view">
        <HostsSidebar />
        
        <main class="logger-main">
            <div class="search-bar-container">
                <div class="view-mode-toggle">
                    <button 
                        @click="transactionsStore.setViewMode('http')" 
                        :class="{ active: transactionsStore.viewMode === 'http' }"
                        class="mode-button"
                        title="Show HTTP transactions only"
                    >
                        🌐 HTTP
                    </button>
                    <button 
                        @click="transactionsStore.setViewMode('websocket')" 
                        :class="{ active: transactionsStore.viewMode === 'websocket' }"
                        class="mode-button"
                        title="Show WebSocket connections only"
                    >
                        🔌 WebSocket
                    </button>
                    <button 
                        @click="transactionsStore.setViewMode('mixed')" 
                        :class="{ active: transactionsStore.viewMode === 'mixed' }"
                        class="mode-button"
                        title="Show both HTTP and WebSocket traffic"
                    >
                        🔀 Mixed
                    </button>
                </div>
                
                <div class="search-input-wrapper">
                    <Search class="search-icon" :size="16" />
                    <input 
                        v-model="currentSearchQuery"
                        type="text" 
                        :placeholder="searchPlaceholder"
                        class="search-input"
                        :title="searchTitle"
                    />
                    <button 
                        v-if="currentSearchQuery"
                        @click="clearCurrentSearch"
                        class="search-clear"
                        title="Clear search"
                    >
                        ×
                    </button>
                </div>
            </div>
            
            <div ref="trafficListContainer" class="traffic-list-container">
                <UnifiedTrafficList />
            </div>
            
            <template v-if="hasSelection">
                <Resizer 
                    direction="vertical"
                    :first-element="trafficListContainer"
                    :second-element="viewerContainer"
                    :min-size="150"
                    :initial-first-size="400"
                    :initial-second-size="300"
                />
                <div ref="viewerContainer" class="viewer-container">
                    <RequestResponseViewer />
                </div>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import HostsSidebar from '../components/HostsSidebar.vue'
import UnifiedTrafficList from '../components/UnifiedTrafficList.vue'
import RequestResponseViewer from '../components/RequestResponseViewer.vue'
import Resizer from '../components/Resizer.vue'
import { useTransactionsStore } from '../stores/transactions'
import { Search } from 'lucide-vue-next'

const transactionsStore = useTransactionsStore()

// Element references
const trafficListContainer = ref<HTMLElement>()
const viewerContainer = ref<HTMLElement>()

// Computed properties for unified selection
const hasSelection = computed(() => {
    return transactionsStore.hasUnifiedSelection
})

// Search functionality
const currentSearchQuery = computed({
    get: () => {
        if (transactionsStore.viewMode === 'websocket') {
            return transactionsStore.websocketSearchQuery
        }
        return transactionsStore.searchQuery
    },
    set: (value: string) => {
        if (transactionsStore.viewMode === 'websocket') {
            transactionsStore.updateWebSocketSearchQuery(value)
        } else {
            transactionsStore.updateSearchQuery(value)
        }
    }
})

const searchPlaceholder = computed(() => {
    switch (transactionsStore.viewMode) {
        case 'http':
            return 'Search HTTP URLs, paths, or file extensions...'
        case 'websocket':
            return 'Search WebSocket URLs, connections, or messages...'
        case 'mixed':
            return 'Search URLs, paths, connections, or messages...'
        default:
            return 'Search...'
    }
})

const searchTitle = computed(() => {
    switch (transactionsStore.viewMode) {
        case 'http':
            return 'Search by HTTP URL, path, or file extension. Supports partial matches.'
        case 'websocket':
            return 'Search by WebSocket URL, connection, or message content. Supports partial matches.'
        case 'mixed':
            return 'Search by URL, path, connection, or message content. Supports partial matches.'
        default:
            return 'Search traffic'
    }
})

function clearCurrentSearch() {
    if (transactionsStore.viewMode === 'websocket') {
        transactionsStore.clearWebSocketSearch()
    } else {
        transactionsStore.clearSearch()
    }
}

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
    align-items: center;
    gap: var(--space-lg);
}

.view-mode-toggle {
    display: flex;
    background: var(--surface-section);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
    border: 1px solid var(--surface-border);
    flex-shrink: 0;
}

.mode-button {
    padding: var(--space-sm) var(--space-md);
    border: none;
    background: transparent;
    color: var(--text-color-secondary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    transition: all var(--transition-fast);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.mode-button:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.mode-button.active {
    background: var(--primary-color);
    color: white;
    box-shadow: var(--shadow-sm);
}

.search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
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

.viewer-container {
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
</style>
