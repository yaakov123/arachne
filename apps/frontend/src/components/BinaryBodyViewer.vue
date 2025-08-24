<template>
    <div class="binary-content">
        <div v-if="isImageContent" class="image-preview">
            <img :src="imageDataUrl" alt="Response image" class="response-image" />
            <div class="image-info">
                {{ contentType }} - {{ formatBodySize(contentSize) }}
            </div>
        </div>
        <div v-else class="binary-info">
            <div class="binary-type">Binary Content</div>
            <div class="binary-details">
                Type: {{ contentType || 'Unknown' }}<br>
                Size: {{ formatBodySize(contentSize) }}<br>
                Encoding: {{ encoding }}
            </div>
            <details class="binary-raw">
                <summary>View Raw Data</summary>
                <pre class="raw-data">{{ content }}</pre>
            </details>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    content: string
    contentType?: string
    contentSize: number
    encoding: 'utf8' | 'base64'
}

const props = defineProps<Props>()

const isImageContent = computed(() => {
    const contentType = props.contentType?.toLowerCase()
    return contentType?.startsWith('image/')
})

const imageDataUrl = computed(() => {
    if (!isImageContent.value) return ''
    
    const sample = props.content
    const contentType = props.contentType || 'image/png'
    
    if (sample.startsWith('base64:')) {
        return `data:${contentType};base64,${sample.substring(7)}`
    } else if (props.encoding === 'base64') {
        return `data:${contentType};base64,${sample}`
    }
    
    return ''
})

const formatBodySize = (size: number): string => {
    if (size < 1024) return `${size} bytes`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.binary-content {
    background: var(--surface-section);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    padding: var(--space-md);
    flex: 1;
    overflow-y: auto;
}

.image-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
}

.response-image {
    max-width: 100%;
    max-height: 200px;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
}

.image-info {
    font-size: var(--text-xs);
    color: var(--text-color-muted);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.binary-info {
    text-align: center;
}

.binary-type {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin-bottom: var(--space-sm);
}

.binary-details {
    font-size: var(--text-xs);
    color: var(--text-color-muted);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    line-height: var(--leading-relaxed);
    margin-bottom: var(--space-md);
}

.binary-raw {
    text-align: left;
}

.binary-raw summary {
    cursor: pointer;
    font-size: var(--text-xs);
    color: var(--primary-color);
    margin-bottom: var(--space-sm);
}

.raw-data {
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-xs);
    padding: var(--space-sm);
    font-size: var(--text-xs);
    max-height: 150px;
    overflow: auto;
    word-break: break-all;
}
</style>
