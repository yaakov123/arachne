<template>
    <div class="response-panel">
        <div class="panel-header">
            <h4>Response</h4>
        </div>
        <div class="panel-content">
            <div v-if="response" class="response-content">
                <CollapsibleSection 
                    title="Response Line" 
                    :badge="response.statusCode.toString()"
                    :badge-class="getStatusClass(response.statusCode)"
                >
                    <div class="response-line">
                        <strong>{{ response.statusCode }}</strong> 
                        {{ response.statusMessage || '' }}
                    </div>
                </CollapsibleSection>
                <HeadersList :headers="response.headers" />
                <BodyViewer :body="response.body" />
            </div>
            <div v-else class="no-response">
                No response data available
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import HeadersList from './HeadersList.vue'
import BodyViewer from './BodyViewer.vue'
import type { TransactionResponse, TransactionBody } from '@arachne/api-types'

interface Props {
    response?: TransactionResponse | null
}

defineProps<Props>()

const getStatusClass = (statusCode: number): string => {
    if (statusCode >= 200 && statusCode < 300) return 'success'
    if (statusCode >= 300 && statusCode < 400) return 'redirect'
    if (statusCode >= 400 && statusCode < 500) return 'client-error'
    if (statusCode >= 500) return 'server-error'
    return 'info'
}
</script>

<style scoped>
.response-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.panel-header {
    background: var(--surface-section);
    border-bottom: 1px solid var(--surface-border);
    padding: var(--space-sm) var(--space-lg);
}

.panel-header h4 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.panel-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
}

.response-line {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-sm);
    padding: var(--space-sm);
    background: var(--surface-section);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--primary-color);
    word-break: break-all;
}

.no-response {
    text-align: center;
    color: var(--text-color-muted);
    font-style: italic;
    padding: var(--space-2xl);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}
</style>
