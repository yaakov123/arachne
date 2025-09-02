<template>
    <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { useTheme } from '@/composables/useTheme'

// Import workers using Vite's ?worker syntax
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Configure Monaco Environment
if (typeof window !== 'undefined') {
    window.MonacoEnvironment = {
        getWorker: function (_, label) {
            switch (label) {
                case 'json':
                    return new jsonWorker()
                case 'css':
                case 'scss':
                case 'less':
                    return new cssWorker()
                case 'html':
                case 'handlebars':
                case 'razor':
                    return new htmlWorker()
                case 'typescript':
                case 'javascript':
                    return new tsWorker()
                default:
                    return new editorWorker()
            }
        },
    }
}

const emit = defineEmits<{
    error: []
    'update:content': [content: string]
}>()

interface Props {
    content: string
    language?: string
    readOnly?: boolean
    minimap?: boolean
    lineNumbers?: boolean
    wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded'
    fontSize?: number
}

const props = withDefaults(defineProps<Props>(), {
    language: 'plaintext',
    readOnly: true,
    minimap: false,
    lineNumbers: true,
    wordWrap: 'on',
    fontSize: 12,
})

const { isDark } = useTheme()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const initEditor = async () => {
    if (!editorContainer.value) return

    try {
        // Set up custom themes first
        setupThemes(monaco)

        editor = monaco.editor.create(editorContainer.value, {
            value: props.content,
            language: props.language,
            theme: isDark.value ? 'arachne-dark' : 'arachne-light',
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
                horizontalScrollbarSize: 8,
            },
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            overviewRulerLanes: 0,
        })

        // Add content change listener for v-model support
        if (!props.readOnly) {
            editor.onDidChangeModelContent(() => {
                emit('update:content', editor!.getValue())
            })
        }
    } catch (error) {
        console.error('Failed to initialize Monaco editor:', error)
        emit('error')
    }
}

const setupThemes = (monacoInstance: typeof monaco) => {
    // Get CSS variables from the document
    const getComputedCSSVar = (varName: string) => {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim()
    }

    // Helper to convert CSS color to hex (removing # if present)
    const toHex = (color: string) => {
        return color.replace('#', '')
    }

    // Light theme using app's design system
    monacoInstance.editor.defineTheme('arachne-light', {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
            { token: 'keyword', foreground: '0ea5e9', fontStyle: 'bold' },
            { token: 'string', foreground: '22c55e' },
            { token: 'number', foreground: '3b82f6' },
            { token: 'regexp', foreground: '22c55e' },
            { token: 'type', foreground: '8b5cf6' },
            { token: 'delimiter', foreground: '1e293b' },
            { token: 'tag', foreground: '0ea5e9' },
            { token: 'attribute.name', foreground: '8b5cf6' },
            { token: 'attribute.value', foreground: '22c55e' },
            { token: 'operator', foreground: '0ea5e9' },
            { token: 'variable', foreground: '1e293b' },
            { token: 'function', foreground: '0ea5e9' },
        ],
        colors: {
            'editor.background': '#ffffff',
            'editor.foreground': '#0f172a',
            'editor.lineHighlightBackground': '#f8fafc',
            'editor.selectionBackground': '#0ea5e920',
            'editor.selectionHighlightBackground': '#0ea5e915',
            'editor.findMatchBackground': '#0ea5e930',
            'editor.findMatchHighlightBackground': '#0ea5e920',
            'editorLineNumber.foreground': '#94a3b8',
            'editorLineNumber.activeForeground': '#475569',
            'editorCursor.foreground': '#0ea5e9',
            'editor.wordHighlightBackground': '#0ea5e915',
            'editor.wordHighlightStrongBackground': '#0ea5e925',
            'editorBracketMatch.background': '#0ea5e920',
            'editorBracketMatch.border': '#0ea5e9',
        },
    })

    // Dark theme using app's design system
    monacoInstance.editor.defineTheme('arachne-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
            { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
            { token: 'string', foreground: '22c55e' },
            { token: 'number', foreground: '60a5fa' },
            { token: 'regexp', foreground: '22c55e' },
            { token: 'type', foreground: 'a78bfa' },
            { token: 'delimiter', foreground: 'f8fafc' },
            { token: 'tag', foreground: '38bdf8' },
            { token: 'attribute.name', foreground: 'a78bfa' },
            { token: 'attribute.value', foreground: '22c55e' },
            { token: 'operator', foreground: '38bdf8' },
            { token: 'variable', foreground: 'f8fafc' },
            { token: 'function', foreground: '38bdf8' },
        ],
        colors: {
            'editor.background': '#020617',
            'editor.foreground': '#f8fafc',
            'editor.lineHighlightBackground': '#0f172a',
            'editor.selectionBackground': '#0ea5e930',
            'editor.selectionHighlightBackground': '#0ea5e920',
            'editor.findMatchBackground': '#0ea5e940',
            'editor.findMatchHighlightBackground': '#0ea5e925',
            'editorLineNumber.foreground': '#475569',
            'editorLineNumber.activeForeground': '#94a3b8',
            'editorCursor.foreground': '#38bdf8',
            'editor.wordHighlightBackground': '#0ea5e920',
            'editor.wordHighlightStrongBackground': '#0ea5e930',
            'editorBracketMatch.background': '#0ea5e925',
            'editorBracketMatch.border': '#38bdf8',
            'scrollbarSlider.background': '#334155',
            'scrollbarSlider.hoverBackground': '#475569',
            'scrollbarSlider.activeBackground': '#64748b',
        },
    })
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

const updateTheme = () => {
    if (editor) {
        const theme = isDark.value ? 'arachne-dark' : 'arachne-light'
        monaco.editor.setTheme(theme)
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
// Watch for theme changes
watch(isDark, updateTheme)

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
    resizeEditor,
})
</script>

<style scoped>
.monaco-editor-container {
    width: 100%;
    height: 100%;
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background-color: var(--surface-card);
    transition: border-color var(--transition-fast);
}

.monaco-editor-container:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
}

/* Ensure Monaco editor integrates well with the app theme */
.monaco-editor-container :deep(.monaco-editor) {
    font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas',
        monospace;
}

/* Override Monaco's scrollbar styles to match app theme */
.monaco-editor-container :deep(.monaco-scrollable-element > .scrollbar) {
    background-color: transparent;
}

.monaco-editor-container
    :deep(.monaco-scrollable-element > .scrollbar > .slider) {
    background-color: var(--color-neutral-400);
    border-radius: var(--radius-sm);
}

.monaco-editor-container
    :deep(.monaco-scrollable-element > .scrollbar > .slider:hover) {
    background-color: var(--color-neutral-500);
}

.monaco-editor-container
    :deep(.monaco-scrollable-element > .scrollbar > .slider.active) {
    background-color: var(--color-neutral-600);
}

/* Ensure proper background colors */
.monaco-editor-container :deep(.monaco-editor .margin),
.monaco-editor-container :deep(.monaco-editor .monaco-editor-background) {
    background-color: transparent !important;
}

/* Context menu styling */
.monaco-editor-container :deep(.monaco-menu) {
    background-color: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
}

.monaco-editor-container
    :deep(.monaco-menu .monaco-action-bar .action-item .action-label) {
    color: var(--text-color);
}

.monaco-editor-container
    :deep(.monaco-menu .monaco-action-bar .action-item .action-label:hover) {
    background-color: var(--surface-hover);
}
</style>
