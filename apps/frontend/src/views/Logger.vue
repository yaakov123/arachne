<template>
    <div class="logger-view">
        <HostsSidebar />
        
        <main class="logger-main">
            <AdvancedFilters @filters-changed="handleFiltersChanged" />
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
import { onMounted, onUnmounted, ref } from 'vue'
import HostsSidebar from '../components/HostsSidebar.vue'
import TrafficList from '../components/TrafficList.vue'
import RequestResponseViewer from '../components/RequestResponseViewer.vue'
import Resizer from '../components/Resizer.vue'
import AdvancedFilters from '../components/AdvancedFilters.vue'
import { useTransactionsStore, type AdvancedFilters as FilterOptions } from '../stores/transactions'

const transactionsStore = useTransactionsStore()

// Element references
const trafficListContainer = ref<HTMLElement>()
const requestResponseContainer = ref<HTMLElement>()

// Filter handling
function handleFiltersChanged(filters: FilterOptions) {
    transactionsStore.updateAdvancedFilters(filters)
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
    height: 100vh;
    width: 100%;
    background: #f8f9fa;
}

.logger-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
