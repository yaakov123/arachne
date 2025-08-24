<template>
    <div class="request-panel">
        <div class="panel-header">
            <h4>Request</h4>
        </div>
        <div class="panel-content">
            <CollapsibleSection title="Request Line">
                <div class="request-line">
                    <strong>{{ request.method }}</strong> 
                    {{ request.url.full }}
                </div>
            </CollapsibleSection>
            <HeadersList :headers="request.headers" />
            <BodyViewer :body="request.body" />
        </div>
    </div>
</template>

<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import HeadersList from './HeadersList.vue'
import BodyViewer from './BodyViewer.vue'
import type { TransactionRequest, TransactionBody } from '@arachne/api-types'

interface Header {
    name: string
    value: string
    sensitive?: boolean
}



interface Props {
    request: TransactionRequest
}

defineProps<Props>()
</script>

<style scoped>
.request-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--surface-border);
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

.request-line {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-sm);
    padding: var(--space-sm);
    background: var(--surface-section);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--primary-color);
    word-break: break-all;
}
</style>
