<template>
    <div class="body-container" v-if="body">
        <div v-if="body.content.contentType" class="content-type-header">
            <span class="content-type">{{ body.content.contentType }}</span>
            <span v-if="body.content.detectedFormat" class="detected-format">
                ({{ body.content.detectedFormat }})
            </span>
            <span v-if="body.content.truncated" class="truncated-indicator">
                TRUNCATED
            </span>
        </div>

        <!-- Binary/Image Content (keep original viewer) -->
        <BinaryBodyViewer
            v-if="isBinaryContent"
            :content="body.sample"
            :content-type="body.content.contentType"
            :content-size="body.content.size"
            :encoding="body.content.encoding"
        />

        <!-- Form Data Content (keep original viewer) -->
        <FormDataViewer v-else-if="isFormContent" :content="body.sample" />

        <!-- Enhanced Monaco Editor for text-based content -->
        <MonacoBodyViewer
            v-else
            :content="body.sample"
            :detected-format="body.content.detectedFormat"
            :content-type="body.content.contentType"
            :content-size="body.content.size"
            :encoding="body.content.encoding"
            :editor-height="editorHeight"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'
import JsonBodyViewer from './JsonBodyViewer.vue'
import XmlBodyViewer from './XmlBodyViewer.vue'
import FormDataViewer from './FormDataViewer.vue'
import BinaryBodyViewer from './BinaryBodyViewer.vue'
import TextBodyViewer from './TextBodyViewer.vue'
import MonacoBodyViewer from './MonacoBodyViewer.vue'
import type { TransactionBody } from '@arachne/api-types'

interface Props {
    body?: TransactionBody | null
    defaultCollapsed?: boolean
    editorHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
    defaultCollapsed: false,
    editorHeight: '400px'
})

// Content type detection
const isFormContent = computed(() => {
    return props.body?.content.detectedFormat === 'form'
})

const isBinaryContent = computed(() => {
    const format = props.body?.content.detectedFormat
    return format === 'binary' || props.body?.content.encoding === 'base64'
})



// Formatting functions
const formatBodySize = (size: number): string => {
    if (size < 1024) return `${size} bytes`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const formatBadge = (): string => {
    if (!props.body?.sample) return ''
    const size = formatBodySize(props.body.sample.length)
    const format = props.body.content.detectedFormat
    return format ? `${format.toUpperCase()} (${size})` : `(${size})`
}
</script>

<style scoped>
.body-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    height: 100%;
    overflow: hidden;
}

.content-type-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.content-type {
    color: var(--primary-color);
    font-weight: var(--font-semibold);
}

.detected-format {
    color: var(--text-color-muted);
}

.truncated-indicator {
    color: var(--color-warning-600);
    font-weight: var(--font-semibold);
    background: var(--color-warning-50);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    font-size: var(--text-xs);
}
</style>
