<template>
    <div class="tab-container">
        <div class="tab-header">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                class="tab-button"
                :class="{ active: activeTab === tab.id }"
                @click="setActiveTab(tab.id)"
                :disabled="tab.disabled"
            >
                {{ tab.label }}
                <span
                    v-if="tab.badge"
                    class="tab-badge"
                    :class="tab.badgeClass"
                >
                    {{ tab.badge }}
                </span>
            </button>
        </div>
        <div class="tab-content">
            <slot :name="activeTab" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

export interface Tab {
    id: string
    label: string
    badge?: string
    badgeClass?: string
    disabled?: boolean
}

interface Props {
    tabs: Tab[]
    defaultTab?: string
}

const props = withDefaults(defineProps<Props>(), {
    defaultTab: '',
})

const emit = defineEmits<{
    tabChanged: [tabId: string]
}>()

const activeTab = ref(props.defaultTab || props.tabs[0]?.id || '')

const setActiveTab = (tabId: string) => {
    if (activeTab.value !== tabId) {
        activeTab.value = tabId
        emit('tabChanged', tabId)
    }
}

// Watch for changes in tabs prop to update activeTab if needed
watch(
    () => props.tabs,
    (newTabs) => {
        if (!newTabs.find((tab) => tab.id === activeTab.value)) {
            activeTab.value = newTabs[0]?.id || ''
        }
    },
    { immediate: true }
)

// Watch for changes in defaultTab prop
watch(
    () => props.defaultTab,
    (newDefaultTab) => {
        if (newDefaultTab && newDefaultTab !== activeTab.value) {
            activeTab.value = newDefaultTab
        }
    }
)
</script>

<style scoped>
.tab-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.tab-header {
    display: flex;
    border-bottom: 1px solid var(--surface-border);
    background: var(--surface-section);
    overflow-x: auto;
    flex-shrink: 0;
}

.tab-button {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-lg);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color-muted);
    transition: all var(--transition-fast);
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    position: relative;
}

.tab-button:hover:not(:disabled) {
    color: var(--text-color);
    background: var(--surface-hover);
}

.tab-button.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    background: var(--surface-ground);
}

.tab-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.tab-badge {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    background: var(--surface-border);
    color: var(--text-color-muted);
}

.tab-button.active .tab-badge {
    background: var(--primary-color);
    color: var(--primary-color-text);
}

/* Badge variants */
.tab-badge.success {
    background: var(--color-success-500);
    color: white;
}

.tab-badge.redirect {
    background: var(--color-info-500);
    color: white;
}

.tab-badge.client-error {
    background: var(--color-warning-500);
    color: white;
}

.tab-badge.server-error {
    background: var(--color-error-500);
    color: white;
}

.tab-badge.size {
    background: var(--color-neutral-300);
    color: var(--text-color);
}

.tab-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
}

/* Responsive design */
@media (max-width: 768px) {
    .tab-button {
        padding: var(--space-sm) var(--space-md);
        font-size: var(--text-xs);
    }

    .tab-content {
        padding: var(--space-md);
    }
}
</style>
