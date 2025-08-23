<template>
    <div class="logger-view">
        <HostsSidebar />
        
        <main class="logger-main">
            <TrafficList />
            <RequestResponseViewer />
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import HostsSidebar from '../components/HostsSidebar.vue'
import TrafficList from '../components/TrafficList.vue'
import RequestResponseViewer from '../components/RequestResponseViewer.vue'
import { useTransactionsStore } from '../stores/transactions'

const transactionsStore = useTransactionsStore()

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
</style>
