<template>
    <div class="collapsible-section">
        <button 
            class="section-toggle" 
            @click="isCollapsed = !isCollapsed"
            :aria-expanded="!isCollapsed"
        >
            <span class="toggle-icon" :class="{ collapsed: isCollapsed }">▼</span>
            <h5>{{ title }}</h5>
            <span v-if="badge" class="section-badge" :class="badgeClass">
                {{ badge }}
            </span>
        </button>
        <div v-show="!isCollapsed" class="section-content">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
    title: string
    badge?: string
    badgeClass?: string
    defaultCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    defaultCollapsed: false
})

const isCollapsed = ref(props.defaultCollapsed)
</script>

<style scoped>
.collapsible-section {
    margin-bottom: var(--space-lg);
}

.section-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    width: 100%;
    padding: var(--space-xs) 0;
    margin-bottom: var(--space-sm);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
    border-radius: var(--radius-sm);
}

.section-toggle:hover {
    background: var(--surface-hover);
}

.toggle-icon {
    font-size: var(--text-xs);
    color: var(--text-color-muted);
    transition: transform var(--transition-fast);
    user-select: none;
}

.toggle-icon.collapsed {
    transform: rotate(-90deg);
}

.section-toggle h5 {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.section-badge {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    margin-left: auto;
}

/* Default badge styles */
.section-badge {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
}

/* Status badge styles */
.section-badge.success {
    background: var(--color-success-50);
    color: var(--color-success-700);
}

.section-badge.redirect {
    background: var(--color-info-50);
    color: var(--color-info-700);
}

.section-badge.client-error {
    background: var(--color-warning-50);
    color: var(--color-warning-700);
}

.section-badge.server-error {
    background: var(--color-error-50);
    color: var(--color-error-700);
}

.section-badge.info {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
}

/* Count badge styles */
.section-badge.count {
    background: transparent;
    color: var(--text-color-muted);
    font-weight: var(--font-normal);
    padding: 0;
    margin-left: var(--space-xs);
}

/* Size badge styles */
.section-badge.size {
    background: transparent;
    color: var(--text-color-muted);
    font-weight: var(--font-normal);
    padding: 0;
    margin-left: var(--space-xs);
}

.section-content {
    /* Content styling is handled by the slotted content */
}
</style>
