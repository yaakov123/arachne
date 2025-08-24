<template>
    <div v-if="transactionsStore.selectedTransaction" class="request-response-viewer">
        <div class="viewer-header">
            <h3>Request & Response Details</h3>
            <button class="close-viewer" @click="transactionsStore.clearSelectedTransaction()">×</button>
        </div>
        
        <div class="viewer-content">
            <RequestPanel ref="requestPanel" :request="transactionsStore.selectedTransaction.request" />
            <Resizer 
                direction="horizontal" 
                :first-element="requestPanel?.$el"
                :second-element="responsePanel?.$el"
                :min-size="200"
                @resize-start="onResizeStart"
            />
            <ResponsePanel ref="responsePanel" :response="transactionsStore.selectedTransaction.response" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTransactionsStore } from '../stores/transactions'
import RequestPanel from './RequestPanel.vue'
import ResponsePanel from './ResponsePanel.vue'
import Resizer from './Resizer.vue'

const transactionsStore = useTransactionsStore()
const requestPanel = ref<InstanceType<typeof RequestPanel>>()
const responsePanel = ref<InstanceType<typeof ResponsePanel>>()

const onResizeStart = () => {
    // Convert from flex to explicit sizes when resizing starts
    if (requestPanel.value?.$el && responsePanel.value?.$el) {
        const requestRect = requestPanel.value.$el.getBoundingClientRect()
        const responseRect = responsePanel.value.$el.getBoundingClientRect()
        
        requestPanel.value.$el.style.flex = 'none'
        responsePanel.value.$el.style.flex = 'none'
        requestPanel.value.$el.style.width = `${requestRect.width}px`
        responsePanel.value.$el.style.width = `${responseRect.width}px`
    }
}

</script>

<style scoped>
.request-response-viewer {
    height: 100%;
    background: var(--surface-card);
    margin: 0 var(--space-sm) var(--space-sm) var(--space-sm);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-section);
    border-bottom: 1px solid var(--surface-border);
    padding: var(--space-md) var(--space-lg);
}

.viewer-header h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-color);
}

.close-viewer {
    padding: var(--space-xs) var(--space-sm);
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: var(--text-xl);
    color: var(--text-color-muted);
    transition: color var(--transition-fast);
    border-radius: var(--radius-sm);
}

.close-viewer:hover {
    color: var(--color-error-600);
    background: var(--color-error-50);
}

.viewer-content {
    flex: 1;
    display: flex;
    overflow: hidden;
}

.viewer-content :deep(.request-panel),
.viewer-content :deep(.response-panel) {
    flex: 1; /* Initially fill container equally */
    min-width: 200px; /* Ensure minimum width */
}
</style>
