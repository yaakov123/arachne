<template>
    <KeyValueViewer :items="headerItems" empty-message="No headers" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import KeyValueViewer, { type KeyValueItem } from './KeyValueViewer.vue'

interface Header {
    name: string
    value: string
    sensitive?: boolean
}

interface Props {
    headers: Header[]
    defaultCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    defaultCollapsed: false,
})

const headerItems = computed<KeyValueItem[]>(() =>
    props.headers.map((header) => ({
        key: header.name,
        value: header.value,
        sensitive: header.sensitive,
    }))
)
</script>

<style scoped>
/* No custom styles needed - using KeyValueViewer */
</style>
