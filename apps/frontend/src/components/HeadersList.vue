<template>
    <KeyValueViewer :items="headerItems" empty-message="No headers">
        <template #value="{ item, key, value }">
            <slot
                name="value"
                :item="item"
                :key="key"
                :value="value"
                :header="getHeaderByName(key)"
            >
                <!-- Automatically show JWT viewer for valid JWT values -->
                <JwtViewer v-if="isValidJWT(value)" :token="value" />
                <!-- Default fallback for non-JWT values -->
                <span v-else>{{ value }}</span>
            </slot>
        </template>
    </KeyValueViewer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import KeyValueViewer, { type KeyValueItem } from './KeyValueViewer.vue'
import JwtViewer from './JwtViewer.vue'
import { isValidJWT } from '../utils/jwt'

interface Header {
    name: string
    value: string
}

interface Props {
    headers: Header[]
}

const props = defineProps<Props>()

const headerItems = computed<KeyValueItem[]>(() =>
    props.headers.map((header) => ({
        key: header.name,
        value: header.value,
    }))
)

const getHeaderByName = (name: string): Header | undefined => {
    return props.headers.find((header) => header.name === name)
}
</script>
