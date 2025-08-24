<template>
    <div class="monaco-body-viewer">


        <div class="viewer-content">
            <MonacoEditor
                :content="formattedContent"
                :language="monacoLanguage"
                :height="editorHeight"
                :read-only="true"
                :minimap="showMinimap"
                :word-wrap="wordWrap"
                :font-size="fontSize"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MonacoEditor from './MonacoEditor.vue'

interface Props {
    content: string
    detectedFormat?: string
    contentType?: string
    contentSize?: number
    encoding?: 'utf8' | 'base64'
    editorHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
    editorHeight: '400px'
})

const showMinimap = ref(false)
const wordWrap = ref<'on' | 'off'>('on')
const fontSize = ref(12)

// Determine Monaco language based on detected format and content type
const monacoLanguage = computed(() => {
    const format = props.detectedFormat?.toLowerCase()
    const contentType = props.contentType?.toLowerCase()

    // Map detected formats to Monaco languages
    switch (format) {
        case 'json':
            return 'json'
        case 'xml':
            return 'xml'
        case 'html':
            return 'html'
        case 'css':
            return 'css'
        case 'javascript':
        case 'js':
            return 'javascript'
        case 'typescript':
        case 'ts':
            return 'typescript'
        case 'yaml':
        case 'yml':
            return 'yaml'
        case 'sql':
            return 'sql'
        case 'python':
            return 'python'
        case 'java':
            return 'java'
        case 'csharp':
        case 'c#':
            return 'csharp'
        case 'cpp':
        case 'c++':
            return 'cpp'
        case 'go':
            return 'go'
        case 'rust':
            return 'rust'
        case 'php':
            return 'php'
        case 'ruby':
            return 'ruby'
        case 'shell':
        case 'bash':
            return 'shell'
        case 'markdown':
        case 'md':
            return 'markdown'
        default:
            break
    }

    // Fallback to content type detection
    if (contentType) {
        if (contentType.includes('json')) return 'json'
        if (contentType.includes('xml')) return 'xml'
        if (contentType.includes('html')) return 'html'
        if (contentType.includes('css')) return 'css'
        if (contentType.includes('javascript')) return 'javascript'
        if (contentType.includes('yaml')) return 'yaml'
        if (contentType.includes('sql')) return 'sql'
    }

    return 'plaintext'
})

// Format content for Monaco editor
const formattedContent = computed(() => {
    const format = props.detectedFormat?.toLowerCase()
    
    try {
        switch (format) {
            case 'json':
                const parsed = JSON.parse(props.content)
                return JSON.stringify(parsed, null, 2)
            case 'xml':
            case 'html':
                // Basic XML/HTML formatting
                return props.content
                    .replace(/></g, '>\n<')
                    .replace(/^\s*\n/gm, '')
            default:
                return props.content
        }
    } catch {
        return props.content
    }
})


</script>

<style scoped>
.monaco-body-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: var(--space-sm);
}

.viewer-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-sm);
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
}

.editor-info {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--text-color);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
}

.icon {
    font-size: var(--text-sm);
}

.format-info {
    color: var(--text-color-muted);
    font-weight: var(--font-semibold);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.viewer-content {
    flex: 1;
    min-height: 0;
}
</style>
