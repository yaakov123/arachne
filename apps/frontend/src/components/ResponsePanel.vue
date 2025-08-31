<template>
    <div class="response-panel">
        <div class="panel-header">
            <h4>Response</h4>
        </div>
        <div v-if="hasResponseData" class="response-content">
            <TabContainer :tabs="tabs" default-tab="headers">
                <template #headers>
                    <HeadersList :headers="transaction.responseHeaders" />
                </template>
                <template #body>
                    <BodyViewer :body="transaction.responseBody" />
                </template>
                <template #cookies>
                    <CookiesViewer :headers="transaction.responseHeaders" />
                </template>
                <template #raw>
                    <RawViewer :transaction="transaction" type="response" />
                </template>
            </TabContainer>
        </div>
        <div v-else class="no-response">No response data available</div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabContainer, { type Tab } from './TabContainer.vue'
import HeadersList from './HeadersList.vue'
import BodyViewer from './BodyViewer.vue'
import CookiesViewer from './CookiesViewer.vue'
import RawViewer from './RawViewer.vue'
import type { FullTransaction } from '@arachne/database'

interface Props {
    transaction: FullTransaction
}

const props = defineProps<Props>()

const hasResponseData = computed(() => {
    return (
        props.transaction.responseHeaders.length > 0 ||
        (props.transaction.responseBody?.size || 0) > 0
    )
})

const tabs = computed<Tab[]>(() => {
    if (!props.transaction) return []

    const cookiesCount = props.transaction.responseHeaders.filter(
        (h) => h.name.toLowerCase() === 'set-cookie'
    ).length

    const bodySize = props.transaction.responseBody?.size || 0

    const tabs: Tab[] = []

    if (props.transaction.responseHeaders.length > 0) {
        tabs.push({
            id: 'headers',
            label: 'Headers',
            badge: props.transaction.responseHeaders.length.toString(),
        })
    }

    if (bodySize > 0) {
        tabs.push({
            id: 'body',
            label: 'Body',
            badge: formatBytes(bodySize),
        })
    }

    if (cookiesCount > 0) {
        tabs.push({
            id: 'cookies',
            label: 'Cookies',
            badge: cookiesCount.toString(),
        })
    }

    // Always show Raw tab
    tabs.push({
        id: 'raw',
        label: 'Raw',
    })

    return tabs
})

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.response-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.response-panel :deep(.tab-content) {
    padding: 0;
}

.panel-header {
    background: var(--surface-section);
    border-bottom: 1px solid var(--surface-border);
    padding: var(--space-sm) var(--space-lg);
    flex-shrink: 0;
}

.panel-header h4 {
    margin: 0 0 var(--space-sm) 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.response-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
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
