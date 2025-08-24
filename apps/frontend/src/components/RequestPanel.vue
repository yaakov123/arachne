<template>
    <div class="request-panel">
        <div class="panel-header">
            <h4>Request</h4>
        </div>
        <TabContainer
            :tabs="tabs"
            default-tab="query"
        >
            <template #query>
                <QueryParamsViewer :query-string="request.url.query" />
            </template>
            <template #headers>
                <HeadersList :headers="request.headers" />
            </template>
            <template #body v-if="request.body">
                <BodyViewer :body="request.body" />
            </template>
            <template #cookies>
                <CookiesViewer :headers="request.headers" />
            </template>
            <template #raw>
                <RawViewer :request="request" />
            </template>
        </TabContainer>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabContainer, { type Tab } from './TabContainer.vue'
import HeadersList from './HeadersList.vue'
import BodyViewer from './BodyViewer.vue'
import QueryParamsViewer from './QueryParamsViewer.vue'
import CookiesViewer from './CookiesViewer.vue'
import RawViewer from './RawViewer.vue'
import type { TransactionRequest } from '@arachne/api-types'

interface Props {
    request: TransactionRequest
}

const props = defineProps<Props>()

const tabs = computed<Tab[]>(() => {
    const queryParamsCount = props.request.url.query
        ? new URLSearchParams(props.request.url.query).size
        : 0

    const cookiesCount = props.request.headers.filter(
        (h) => h.name.toLowerCase() === 'cookie'
    ).length

    const bodySize = props.request.body?.content.size || 0

    const tabs: Tab[] = []

    if (queryParamsCount > 0) {
        tabs.push({
            id: 'query',
            label: 'Query',
            badge: queryParamsCount.toString(),
        })
    }

    if (props.request.headers.length > 0) {
        tabs.push({
            id: 'headers',
            label: 'Headers',
            badge: props.request.headers.length.toString(),
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
</style>
