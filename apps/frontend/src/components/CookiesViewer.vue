<template>
    <div class="cookies-viewer">
        <KeyValueViewer :items="cookieItems" empty-message="No cookies" />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import KeyValueViewer, { type KeyValueItem } from './KeyValueViewer.vue'
import type { TransactionHeader } from '@arachne/database'

interface Props {
    headers: TransactionHeader[]
}

const props = defineProps<Props>()

const cookieItems = computed<KeyValueItem[]>(() => {
    const cookieHeaders = props.headers.filter(
        (header) =>
            header.name.toLowerCase() === 'cookie' ||
            header.name.toLowerCase() === 'set-cookie'
    )

    const result: KeyValueItem[] = []

    for (const header of cookieHeaders) {
        if (header.name.toLowerCase() === 'cookie') {
            // Parse request cookies (format: "name1=value1; name2=value2")
            const cookiePairs = header.value
                .split(';')
                .map((pair) => pair.trim())
            for (const pair of cookiePairs) {
                const [name, ...valueParts] = pair.split('=')
                if (name && valueParts.length > 0) {
                    result.push({
                        key: name.trim(),
                        value: valueParts.join('=').trim(),
                    })
                }
            }
        } else if (header.name.toLowerCase() === 'set-cookie') {
            // Parse response set-cookie (format: "name=value; attribute1; attribute2=value")
            const parts = header.value.split(';').map((part) => part.trim())
            if (parts.length > 0) {
                const [name, ...valueParts] = parts[0].split('=')
                if (name && valueParts.length > 0) {
                    const attributes = parts
                        .slice(1)
                        .filter((attr) => attr.length > 0)
                    const value = valueParts.join('=').trim()
                    const displayValue =
                        attributes.length > 0
                            ? `${value} (${attributes.join('; ')})`
                            : value

                    result.push({
                        key: name.trim(),
                        value: displayValue,
                    })
                }
            }
        }
    }

    return result
})
</script>

<style scoped>
.cookies-viewer {
    height: 100%;
}
</style>
