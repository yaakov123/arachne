<template>
    <div class="response-panel">
        <div class="panel-header">
            <h4>Response</h4>
        </div>
        <div v-if="response" class="response-content">
            <TabContainer :tabs="tabs" default-tab="headers" @tab-changed="onTabChanged">
                <template #headers>
                    <HeadersList :headers="response.headers" />
                </template>
                <template #body>
                    <BodyViewer :body="response.body" />
                </template>
                <template #cookies>
                    <CookiesViewer :headers="response.headers" />
                </template>
            </TabContainer>
        </div>
        <div v-else class="no-response">
            No response data available
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabContainer, { type Tab } from './TabContainer.vue'
import HeadersList from './HeadersList.vue'
import BodyViewer from './BodyViewer.vue'
import CookiesViewer from './CookiesViewer.vue'
import type { TransactionResponse } from '@arachne/api-types'

interface Props {
    response?: TransactionResponse | null
}

const props = defineProps<Props>()

const tabs = computed<Tab[]>(() => {
    if (!props.response) return []
    
    const cookiesCount = props.response.headers.filter(h => 
        h.name.toLowerCase() === 'set-cookie'
    ).length
    
    const bodySize = props.response.body?.content.size || 0
    
    
    const tabs: Tab[] = [
       
    ]

    if (props.response.headers.length > 0) {
        tabs.push({
            id: 'headers',
            label: 'Headers',
            badge: props.response.headers.length.toString()
        })
    }

    if (bodySize > 0) {
        tabs.push({
            id: 'body',
            label: 'Body',
            badge: formatBytes(bodySize)
        })
    }

    if (cookiesCount > 0) {
        tabs.push({
            id: 'cookies',
            label: 'Cookies',
            badge: cookiesCount.toString(),
        })
    }

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
    overflow: hidden;
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
    overflow: hidden;
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
