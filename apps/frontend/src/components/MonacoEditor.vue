<template>
    <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

const emit = defineEmits<{
    error: []
}>()

interface Props {
    content: string
    language?: string
    theme?: 'vs' | 'vs-dark' | 'hc-black'
    readOnly?: boolean
    minimap?: boolean
    lineNumbers?: boolean
    wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded'
    fontSize?: number
    height?: string
}

const props = withDefaults(defineProps<Props>(), {
    language: 'plaintext',
    theme: 'vs',
    readOnly: true,
    minimap: false,
    lineNumbers: true,
    wordWrap: 'on',
    fontSize: 12,
    height: '400px'
})

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const initEditor = async () => {
    if (!editorContainer.value) return

    try {
        editor = monaco.editor.create(editorContainer.value, {
            value: props.content,
            language: props.language,
            theme: props.theme,
            readOnly: props.readOnly,
            minimap: { enabled: props.minimap },
            lineNumbers: props.lineNumbers ? 'on' : 'off',
            wordWrap: props.wordWrap,
            fontSize: props.fontSize,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            contextmenu: false,
            folding: true,
            renderWhitespace: 'selection',
            scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
            },
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            overviewRulerLanes: 0
        })

        // Set up theme based on CSS variables
        setupTheme(monaco)
        
    } catch (error) {
        console.error('Failed to initialize Monaco editor:', error)
        emit('error')
    }
}

const setupTheme = (monacoInstance: typeof monaco) => {
    // Define custom theme based on CSS variables
    monacoInstance.editor.defineTheme('arachne-light', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'd73a49', fontStyle: 'bold' },
            { token: 'string', foreground: '032f62' },
            { token: 'number', foreground: '005cc5' },
            { token: 'regexp', foreground: '032f62' },
            { token: 'type', foreground: '6f42c1' },
            { token: 'delimiter', foreground: '24292e' },
            { token: 'tag', foreground: '22863a' },
            { token: 'attribute.name', foreground: '6f42c1' },
            { token: 'attribute.value', foreground: '032f62' }
        ],
        colors: {
            'editor.background': '#ffffff',
            'editor.foreground': '#24292e',
            'editor.lineHighlightBackground': '#f6f8fa',
            'editor.selectionBackground': '#0366d625',
            'editorLineNumber.foreground': '#959da5',
            'editorLineNumber.activeForeground': '#24292e'
        }
    })

    monacoInstance.editor.defineTheme('arachne-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'ff7b72', fontStyle: 'bold' },
            { token: 'string', foreground: 'a5d6ff' },
            { token: 'number', foreground: '79c0ff' },
            { token: 'regexp', foreground: 'a5d6ff' },
            { token: 'type', foreground: 'ffa657' },
            { token: 'delimiter', foreground: 'f0f6fc' },
            { token: 'tag', foreground: '7ee787' },
            { token: 'attribute.name', foreground: 'ffa657' },
            { token: 'attribute.value', foreground: 'a5d6ff' }
        ],
        colors: {
            'editor.background': '#0d1117',
            'editor.foreground': '#f0f6fc',
            'editor.lineHighlightBackground': '#161b22',
            'editor.selectionBackground': '#264f78',
            'editorLineNumber.foreground': '#6e7681',
            'editorLineNumber.activeForeground': '#f0f6fc'
        }
    })

    // Use light theme by default, can be changed based on app theme
    monacoInstance.editor.setTheme('arachne-light')
}

const updateContent = () => {
    if (editor && editor.getValue() !== props.content) {
        editor.setValue(props.content)
    }
}

const updateLanguage = () => {
    if (editor) {
        const model = editor.getModel()
        if (model) {
            monaco.editor.setModelLanguage(model, props.language)
        }
    }
}

const resizeEditor = () => {
    if (editor) {
        editor.layout()
    }
}

// Watch for prop changes
watch(() => props.content, updateContent)
watch(() => props.language, updateLanguage)

onMounted(async () => {
    await nextTick()
    await initEditor()
    
    // Handle window resize
    window.addEventListener('resize', resizeEditor)
})

onUnmounted(() => {
    if (editor) {
        editor.dispose()
        editor = null
    }
    window.removeEventListener('resize', resizeEditor)
})

// Expose methods for parent components
defineExpose({
    getEditor: () => editor,
    resizeEditor
})
</script>

<style scoped>
.monaco-editor-container {
    width: 100%;
    height: v-bind(height);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
}

/* Ensure Monaco editor integrates well with the app theme */
.monaco-editor-container :deep(.monaco-editor) {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.monaco-editor-container :deep(.monaco-editor .margin) {
    background-color: var(--surface-ground);
}

.monaco-editor-container :deep(.monaco-editor .monaco-editor-background) {
    background-color: var(--surface-section);
}
</style>
