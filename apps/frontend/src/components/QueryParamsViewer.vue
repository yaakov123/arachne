<template>
    <KeyValueViewer 
        :items="queryParamItems" 
        empty-message="No query parameters"
        max-height="300px"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import KeyValueViewer, { type KeyValueItem } from './KeyValueViewer.vue'

interface QueryParam {
    name: string
    value: string
}

interface Props {
    queryString?: string
}

const props = defineProps<Props>()

const queryParams = computed<QueryParam[]>(() => {
    if (!props.queryString) return []
    
    try {
        const params = new URLSearchParams(props.queryString)
        const result: QueryParam[] = []
        
        for (const [name, value] of params.entries()) {
            result.push({ name, value })
        }
        
        return result
    } catch (error) {
        console.warn('Failed to parse query string:', props.queryString, error)
        return []
    }
})

const queryParamItems = computed<KeyValueItem[]>(() => 
    queryParams.value.map(param => ({
        key: param.name,
        value: param.value,
        muted: true // Query param values are typically muted
    }))
)
</script>

<style scoped>
/* No custom styles needed - using KeyValueViewer */
</style>
