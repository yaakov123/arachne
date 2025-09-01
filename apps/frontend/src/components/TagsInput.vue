<template>
    <div class="tags-input">
        <div class="tags-list">
            <span v-for="(tag, index) in tags" :key="index" class="tag">
                {{ tag }}
                <button
                    type="button"
                    class="tag-remove"
                    @click="removeTag(index)"
                >
                    <X :size="12" />
                </button>
            </span>
        </div>

        <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="tag-input"
            :placeholder="tags.length === 0 ? placeholder : ''"
            @keydown="onKeyDown"
            @blur="addCurrentTag"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

// Props
interface Props {
    modelValue?: string[]
    placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: () => [],
    placeholder: 'Add tag...',
})

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: string[]]
}>()

// Local state
const tags = ref<string[]>([])
const inputValue = ref('')
const inputRef = ref<HTMLInputElement>()

// Initialize from modelValue
watch(
    () => props.modelValue,
    (newValue) => {
        tags.value = [...(newValue || [])]
    },
    { immediate: true }
)

// Methods
const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.value.includes(trimmed)) {
        tags.value.push(trimmed)
        updateValue()
    }
}

const removeTag = (index: number) => {
    tags.value.splice(index, 1)
    updateValue()
}

const addCurrentTag = () => {
    if (inputValue.value.trim()) {
        addTag(inputValue.value)
        inputValue.value = ''
    }
}

const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault()
        addCurrentTag()
    } else if (
        event.key === 'Backspace' &&
        !inputValue.value &&
        tags.value.length > 0
    ) {
        removeTag(tags.value.length - 1)
    }
}

const updateValue = () => {
    emit('update:modelValue', [...tags.value])
}
</script>

<style scoped>
.tags-input {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    min-height: 44px;
    transition: all var(--transition-fast);
}

.tags-input:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
}

.tag-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    color: var(--color-primary-600);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.tag-remove:hover {
    background: var(--color-primary-200);
    color: var(--color-primary-800);
}

.tag-input {
    flex: 1;
    min-width: 120px;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-family: inherit;
}

.tag-input::placeholder {
    color: var(--text-color-secondary);
}
</style>
