<template>
    <div
        class="traffic-entry"
        :data-transaction-id="transaction.id"
        :class="{
            selected: isSelected,
        }"
        @click="handleEntryClick"
        @contextmenu="showContextMenu"
    >
        <div class="entry-expand"></div>
        <div class="entry-method" :class="getMethodClass(transaction.method)">
            {{ transaction.method }}
        </div>

        <div class="entry-url" :title="transaction.urlFull">
            {{ transaction.urlPath
            }}{{ transaction.urlQuery ? '?' + transaction.urlQuery : '' }}
        </div>

        <div
            class="entry-status"
            :style="{
                color: transaction.statusCode
                    ? getStatusTextColor(transaction.statusCode)
                    : 'var(--text-color-muted)',
            }"
        >
            {{ transaction.statusCode || '-' }}
        </div>
        <div class="entry-time">{{ transaction.duration || '-' }}</div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
        <div
            v-if="contextMenuVisible"
            class="context-menu"
            :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
            @click="hideContextMenu"
        >
            <div class="context-menu-item" @click="sendToEditor">
                <Edit :size="14" />
                Send to Editor
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" @click="copyUrl">
                <Link :size="14" />
                Copy URL
            </div>
            <div class="context-menu-item" @click="copyCurl">
                <Terminal :size="14" />
                Copy as cURL
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Link, Terminal, Edit } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useTransactionsStore } from '../stores/transactions'
import { getMethodClass, getStatusTextColor } from '../utils/http-colors'
import type { Transaction } from '@arachne/database'

interface Props {
    transaction: Transaction
    isSelected: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
    select: [transaction: Transaction]
}>()

// Get store instance and router
const store = useTransactionsStore()
const router = useRouter()

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

// Computed properties
// Event handlers
const handleEntryClick = () => {
    emit('select', props.transaction)
}

const showContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    contextMenuX.value = event.clientX
    contextMenuY.value = event.clientY
    contextMenuVisible.value = true

    // Hide on next click anywhere
    document.addEventListener('click', hideContextMenu, { once: true })
}

const hideContextMenu = () => {
    contextMenuVisible.value = false
}

const sendToEditor = () => {
    // Navigate to request editor with transaction data
    router.push({
        name: 'request-editor',
        query: { transactionId: props.transaction.id.toString() },
    })
}

const copyUrl = () => {
    navigator.clipboard.writeText(props.transaction.urlFull)
}

const copyCurl = () => {
    // TODO: Generate cURL command
    console.log('Copy as cURL not implemented yet')
}
</script>

<style scoped>
.traffic-entry {
    display: grid;
    grid-template-columns: var(
        --traffic-grid-columns,
        40px 80px 1fr 80px 100px
    );
    gap: var(--traffic-grid-gap, var(--space-md));
    padding: var(--space-md) var(--space-sm) var(--space-md) 0;
    border-bottom: 1px solid var(--surface-border);
    cursor: pointer;
    transition: background-color var(--transition-fast);
    font-size: var(--text-sm);
    position: relative;
    align-items: center;
}

.traffic-entry:hover {
    background: var(--surface-hover);
}

.traffic-entry.selected {
    background: var(--color-primary-50);
}

.traffic-entry.selected.has-children {
    background: var(--color-primary-50);
}

.traffic-entry.parent-highlighted {
    background: var(--color-neutral-50);
    opacity: 0.9;
}

.traffic-entry.has-children {
    font-weight: var(--font-medium);
}

/* Nested indentation */
.nested-indent {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding-left: var(--space-md);
    color: var(--text-color-muted);
}

/* Expand/collapse controls */
.expand-controls {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
}

.expand-button {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs);
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast);
    color: var(--text-color-muted);
    font-size: var(--text-xs);
}

.expand-button:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.entry-method {
    font-weight: var(--font-semibold);
    text-align: center;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
}

.method-get {
    background: #e3f2fd;
    color: #1976d2;
}
.method-post {
    background: #e8f5e8;
    color: #388e3c;
}
.method-put {
    background: #fff3e0;
    color: #f57c00;
}
.method-patch {
    background: #fce4ec;
    color: #c2185b;
}
.method-delete {
    background: #ffebee;
    color: #d32f2f;
}
.method-head {
    background: #f3e5f5;
    color: #7b1fa2;
}
.method-options {
    background: #e0f2f1;
    color: #00796b;
}

.entry-url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-color);
}

.entry-status {
    text-align: center;
    font-weight: var(--font-semibold);
}

.entry-size,
.entry-time {
    text-align: right;
    color: var(--text-color-muted);
    font-variant-numeric: tabular-nums;
    padding-right: var(--space-sm);
}

/* Responsive adjustments to match header */
@media (max-width: 768px) {
    .traffic-entry {
        grid-template-columns: 32px 60px 1fr 60px 80px;
        gap: var(--space-sm);
        font-size: var(--text-xs);
    }

    .entry-method {
        font-size: var(--text-xs);
        padding: 2px var(--space-xs);
    }
}

@media (max-width: 480px) {
    .traffic-entry {
        grid-template-columns: 24px 50px 1fr 50px;
        gap: var(--space-xs);
    }

    .entry-time {
        display: none;
    }

    .entry-method {
        font-size: 10px;
        padding: 1px 2px;
    }
}

/* Context menu styles */
.context-menu {
    position: fixed;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    min-width: 160px;
}

.context-menu-item {
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    transition: background-color var(--transition-fast);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.context-menu-item:hover {
    background: var(--surface-hover);
}

.context-menu-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.context-menu-item.disabled:hover {
    background: transparent;
}

.context-menu-separator {
    height: 1px;
    background: var(--surface-border);
    margin: var(--space-xs) 0;
}
</style>
