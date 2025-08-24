<template>
    <pre class="xml-content" v-html="formattedXml"></pre>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    content: string
}

const props = defineProps<Props>()

const formattedXml = computed(() => {
    try {
        // Basic XML/HTML formatting with indentation
        const formatted = props.content
            .replace(/></g, '>\n<')
            .replace(/^\s*\n/gm, '')
        return syntaxHighlightXml(formatted)
    } catch {
        return escapeHtml(props.content)
    }
})

const syntaxHighlightXml = (xml: string): string => {
    return xml
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/(&lt;\/?)([\w-]+)(.*?)(&gt;)/g, '$1<span class="xml-tag">$2</span>$3$4')
        .replace(/([\w-]+)=("[^"]*")/g, '<span class="xml-attr">$1</span>=<span class="xml-value">$2</span>')
}

const escapeHtml = (text: string): string => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}
</script>

<style scoped>
.xml-content {
    background: var(--surface-section);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    padding: var(--space-md);
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    overflow: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 300px;
}

/* XML/HTML Syntax Highlighting */
.xml-content :deep(.xml-tag) {
    color: var(--color-primary-600);
    font-weight: var(--font-semibold);
}

.xml-content :deep(.xml-attr) {
    color: var(--color-info-600);
}

.xml-content :deep(.xml-value) {
    color: var(--color-success-600);
}
</style>
