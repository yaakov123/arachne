<template>
    <div class="form-content">
        <div v-for="(value, key) in parsedFormData" :key="key" class="form-field">
            <span class="form-key">{{ key }}:</span>
            <span class="form-value">{{ value }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    content: string
}

const props = defineProps<Props>()

const parsedFormData = computed(() => {
    const result: Record<string, string> = {}
    try {
        const params = new URLSearchParams(props.content)
        for (const [key, value] of params.entries()) {
            result[key] = value
        }
    } catch {
        // Fallback for malformed form data
        const pairs = props.content.split('&')
        for (const pair of pairs) {
            const [key, value] = pair.split('=')
            if (key) {
                result[decodeURIComponent(key)] = decodeURIComponent(value || '')
            }
        }
    }
    return result
})
</script>

<style scoped>
.form-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    background: var(--surface-section);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    padding: var(--space-md);
    flex: 1;
    overflow-y: auto;
}

.form-field {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-xs);
    background: var(--surface-ground);
    border-radius: var(--radius-xs);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
}

.form-key {
    color: var(--color-primary-600);
    font-weight: var(--font-semibold);
    min-width: 120px;
    flex-shrink: 0;
}

.form-value {
    color: var(--text-color);
    word-break: break-all;
}
</style>
