<template>
    <div
        class="traffic-entry"
        :data-transaction-id="transaction.id"
        :class="{
            selected: isSelected,
            'parent-highlighted': isParentHighlighted,
            'is-original': transaction.repeaterGroup?.isOriginal,
            'is-repeated': transaction.repeaterGroup?.isRepeated,
            'has-children': hasRepeatedRequests,
        }"
        @click="handleEntryClick"
        @contextmenu="showContextMenu"
    >
        <!-- Collapse/Expand controls - moved to far left -->
        <div class="expand-controls">
            <button
                v-if="hasRepeatedRequests"
                class="expand-button"
                @click.stop="toggleExpanded"
                :title="
                    isExpanded
                        ? 'Collapse repeated requests'
                        : 'Expand repeated requests'
                "
            >
                <ChevronDown v-if="isExpanded" :size="14" />
                <ChevronRight v-else :size="14" />
                <span class="repeat-count">{{ repeatCount }}</span>
            </button>
            <div
                v-else-if="transaction.repeaterGroup?.isRepeated"
                class="nested-indent"
            >
                <RotateCcw :size="12" class="repeat-icon" />
            </div>
        </div>

        <div
            class="entry-method"
            :class="getMethodClass(transaction.request.method)"
        >
            {{ transaction.request.method }}
        </div>

        <div class="entry-url" :title="transaction.request.url.full">
            {{ transaction.request.url.path
            }}{{
                transaction.request.url.query
                    ? '?' + transaction.request.url.query
                    : ''
            }}
        </div>

        <div
            class="entry-status"
            :style="{
                color: transaction.response?.statusCode
                    ? getStatusTextColor(transaction.response.statusCode)
                    : 'var(--text-color-muted)',
            }"
        >
            {{ transaction.response?.statusCode || '-' }}
        </div>
        <div class="entry-size">
            {{ formatSize(transaction.summary.responseSize || 0) }}
        </div>
        <div class="entry-time">
            {{
                transaction.timing.duration
                    ? transaction.timing.duration.toFixed(0) + 'ms'
                    : '-'
            }}
        </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
        <div
            v-if="contextMenuVisible"
            class="context-menu"
            :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
            @click="hideContextMenu"
        >
            <div class="context-menu-item" @click="copyUrl">
                <Link :size="14" />
                Copy URL
            </div>
            <div class="context-menu-item" @click="copyCurl">
                <Terminal :size="14" />
                Copy as cURL
            </div>
            <div
                v-if="!transaction.repeaterGroup?.isRepeated"
                class="context-menu-separator"
            ></div>
            <div
                v-if="!transaction.repeaterGroup?.isRepeated"
                class="context-menu-item"
                @click="repeatRequest"
                :class="{ disabled: isRepeating }"
            >
                <RotateCcw :size="14" />
                {{ isRepeating ? 'Repeating...' : 'Repeat Request' }}
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
    ChevronDown,
    ChevronRight,
    RotateCcw,
    Link,
    Terminal,
} from 'lucide-vue-next'
import type { TransactionWithMeta } from '../stores/transactions'
import { useTransactionsStore } from '../stores/transactions'
import { getMethodClass, getStatusTextColor } from '../utils/http-colors'

interface Props {
    transaction: TransactionWithMeta
    isSelected: boolean
    isParentHighlighted?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
    select: [transaction: TransactionWithMeta]
}>()

// Get store instance
const store = useTransactionsStore()

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const isRepeating = ref(false)

// Computed properties
const hasRepeatedRequests = computed(
    () =>
        props.transaction.repeaterGroup?.isOriginal &&
        (props.transaction.repeaterGroup?.childTransactionIds.length ?? 0) > 0
)

const isExpanded = computed(
    () => props.transaction.repeaterGroup?.isExpanded ?? false
)

const repeatCount = computed(
    () => props.transaction.repeaterGroup?.childTransactionIds.length ?? 0
)

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

const repeatRequest = async () => {
    if (isRepeating.value) return

    isRepeating.value = true
    try {
        await store.repeatRequest(props.transaction.id)
    } catch (error) {
        console.error('Failed to repeat request:', error)
        // TODO: Show user-friendly error message
    } finally {
        isRepeating.value = false
    }
}

const copyUrl = () => {
    navigator.clipboard.writeText(props.transaction.request.url.full)
}

const copyCurl = () => {
    // TODO: Generate cURL command
    console.log('Copy as cURL not implemented yet')
}

const toggleExpanded = () => {
    if (props.transaction.repeaterGroup?.isOriginal) {
        store.toggleGroupExpansion(props.transaction.id)
    }
}

// Helper function to format file sizes
function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.traffic-entry {
    display: grid;
    grid-template-columns: 40px 80px 1fr 80px 80px 80px;
    gap: var(--space-md);
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
/* 
.traffic-entry.is-repeated:hover {
    background: var(--color-neutral-100);
}

.traffic-entry.has-children:hover {
    background: var(--surface-hover);
} */

.traffic-entry.selected {
    background: var(--color-primary-50);
}

.traffic-entry.selected.is-repeated {
    background: var(--color-neutral-100);
}

.traffic-entry.selected.has-children {
    background: var(--color-primary-50);
}

.traffic-entry.parent-highlighted {
    background: var(--color-neutral-50);
    opacity: 0.9;
}

/* Repeater-specific styling */
.traffic-entry.is-repeated {
    opacity: 0.8;
    background: var(--color-neutral-50);
    border-left: 2px solid var(--color-neutral-300);
    margin-left: var(--space-md);
    position: relative;
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

.repeat-icon {
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

.repeat-count {
    background: var(--color-neutral-200);
    color: var(--text-color-muted);
    padding: 2px 6px;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    min-width: 16px;
    text-align: center;
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
