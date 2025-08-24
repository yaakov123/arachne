<template>
    <pre class="json-content" v-html="formattedJson"></pre>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    content: string
}

const props = defineProps<Props>()

const formattedJson = computed(() => {
    try {
        const parsed = JSON.parse(props.content)
        const formatted = JSON.stringify(parsed, null, 2)
        return syntaxHighlightJson(formatted)
    } catch {
        return escapeHtml(props.content)
    }
})

const syntaxHighlightJson = (json: string): string => {
    return json
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'json-number'
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key'
                } else {
                    cls = 'json-string'
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean'
            } else if (/null/.test(match)) {
                cls = 'json-null'
            }
            return `<span class="${cls}">${escapeHtml(match)}</span>`
        })
}

const escapeHtml = (text: string): string => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}
</script>

<style scoped>
.json-content {
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

/* JSON Syntax Highlighting */
.json-content :deep(.json-key) {
    color: var(--color-primary-600);
    font-weight: var(--font-semibold);
}

.json-content :deep(.json-string) {
    color: var(--color-success-600);
}

.json-content :deep(.json-number) {
    color: var(--color-info-600);
}

.json-content :deep(.json-boolean) {
    color: var(--color-warning-600);
    font-weight: var(--font-semibold);
}

.json-content :deep(.json-null) {
    color: var(--text-color-muted);
    font-style: italic;
}
</style>
