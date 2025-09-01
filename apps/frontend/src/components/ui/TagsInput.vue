<template>
    <div class="tags-input" :class="wrapperClasses">
        <div class="tags-list">
            <div
                v-for="(tag, index) in tags"
                :key="index"
                class="tag"
                :class="tagClasses"
            >
                <span class="tag-text">{{ tag }}</span>
                <button
                    type="button"
                    class="tag-remove"
                    @click="removeTag(index)"
                    :aria-label="`Remove ${tag} tag`"
                >
                    <X :size="tagIconSize" />
                </button>
            </div>
        </div>

        <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="tag-input"
            :class="inputClasses"
            :placeholder="tags.length === 0 ? placeholder : ''"
            :disabled="disabled"
            :readonly="readonly"
            :maxlength="maxTagLength"
            @keydown="onKeyDown"
            @blur="addCurrentTag"
            @paste="onPaste"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { X } from 'lucide-vue-next'

export interface TagsInputProps {
    /** Tags array (v-model) */
    modelValue?: string[]
    /** Input placeholder */
    placeholder?: string
    /** Input size */
    size?: 'sm' | 'md' | 'lg'
    /** Tag variant */
    variant?: 'default' | 'primary' | 'secondary' | 'outline'
    /** Whether input is disabled */
    disabled?: boolean
    /** Whether input is readonly */
    readonly?: boolean
    /** Maximum number of tags */
    maxTags?: number
    /** Maximum length per tag */
    maxTagLength?: number
    /** Separator characters for splitting tags */
    separators?: string[]
    /** Whether to allow duplicate tags */
    allowDuplicates?: boolean
    /** Whether to trim whitespace from tags */
    trimTags?: boolean
    /** Transform function for tags */
    transform?: (tag: string) => string
    /** Validation function for tags */
    validate?: (tag: string) => boolean | string
    /** Error message */
    error?: string
}

const props = withDefaults(defineProps<TagsInputProps>(), {
    modelValue: () => [],
    placeholder: 'Add tag...',
    size: 'md',
    variant: 'default',
    disabled: false,
    readonly: false,
    maxTagLength: 50,
    separators: () => [',', ';', '\n'],
    allowDuplicates: false,
    trimTags: true,
})

const emit = defineEmits<{
    'update:modelValue': [value: string[]]
    'tag-added': [tag: string]
    'tag-removed': [tag: string, index: number]
    'max-tags-reached': []
    'invalid-tag': [tag: string, reason: string]
}>()

const inputRef = ref<HTMLInputElement>()
const inputValue = ref('')
const tags = ref<string[]>([])

// Initialize from modelValue
watch(
    () => props.modelValue,
    (newValue) => {
        tags.value = [...(newValue || [])]
    },
    { immediate: true }
)

const wrapperClasses = computed(() => [
    'tags-input',
    `tags-input-${props.size}`,
    `tags-input-${props.variant}`,
    {
        'tags-input-disabled': props.disabled,
        'tags-input-readonly': props.readonly,
        'tags-input-error': props.error,
    },
])

const tagClasses = computed(() => [
    'tag',
    `tag-${props.size}`,
    `tag-${props.variant}`,
])

const inputClasses = computed(() => [
    'tag-input',
    `tag-input-${props.size}`,
    {
        'tag-input-disabled': props.disabled,
        'tag-input-readonly': props.readonly,
    },
])

const tagIconSize = computed(() => {
    const sizes = { sm: 10, md: 12, lg: 14 }
    return sizes[props.size] || 12
})

const isMaxTagsReached = computed(() => {
    return props.maxTags ? tags.value.length >= props.maxTags : false
})

// Validation
const validateTag = (tag: string): { valid: boolean; reason?: string } => {
    if (!tag || tag.length === 0) {
        return { valid: false, reason: 'Tag cannot be empty' }
    }

    if (props.maxTagLength && tag.length > props.maxTagLength) {
        return {
            valid: false,
            reason: `Tag cannot exceed ${props.maxTagLength} characters`,
        }
    }

    if (!props.allowDuplicates && tags.value.includes(tag)) {
        return { valid: false, reason: 'Tag already exists' }
    }

    if (props.validate) {
        const result = props.validate(tag)
        if (typeof result === 'string') {
            return { valid: false, reason: result }
        }
        if (result === false) {
            return { valid: false, reason: 'Invalid tag' }
        }
    }

    return { valid: true }
}

// Transform tag
const transformTag = (tag: string): string => {
    let transformed = tag

    if (props.trimTags) {
        transformed = transformed.trim()
    }

    if (props.transform) {
        transformed = props.transform(transformed)
    }

    return transformed
}

// Add tag
const addTag = (tagText: string) => {
    if (props.readonly || props.disabled) return

    if (isMaxTagsReached.value) {
        emit('max-tags-reached')
        return
    }

    const transformed = transformTag(tagText)
    const validation = validateTag(transformed)

    if (!validation.valid) {
        emit('invalid-tag', transformed, validation.reason || 'Invalid tag')
        return
    }

    tags.value.push(transformed)
    updateValue()
    emit('tag-added', transformed)
}

// Remove tag
const removeTag = (index: number) => {
    if (props.readonly || props.disabled) return

    const removedTag = tags.value[index]
    tags.value.splice(index, 1)
    updateValue()
    emit('tag-removed', removedTag, index)
}

// Add current input as tag
const addCurrentTag = () => {
    if (inputValue.value.trim()) {
        addTag(inputValue.value)
        inputValue.value = ''
    }
}

// Handle key events
const onKeyDown = (event: KeyboardEvent) => {
    const { key } = event

    // Handle separators
    if (props.separators.includes(key)) {
        event.preventDefault()
        addCurrentTag()
        return
    }

    // Handle Enter
    if (key === 'Enter') {
        event.preventDefault()
        addCurrentTag()
        return
    }

    // Handle Backspace when input is empty
    if (key === 'Backspace' && !inputValue.value && tags.value.length > 0) {
        event.preventDefault()
        removeTag(tags.value.length - 1)
        return
    }

    // Handle Escape
    if (key === 'Escape') {
        inputValue.value = ''
        inputRef.value?.blur()
        return
    }
}

// Handle paste
const onPaste = (event: ClipboardEvent) => {
    event.preventDefault()
    const pastedText = event.clipboardData?.getData('text') || ''

    // Split by separators and add each as a tag
    const newTags = pastedText
        .split(new RegExp(`[${props.separators.join('')}]`))
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

    newTags.forEach((tag) => addTag(tag))
    inputValue.value = ''
}

// Update value
const updateValue = () => {
    emit('update:modelValue', [...tags.value])
}

// Focus input
const focus = async () => {
    await nextTick()
    inputRef.value?.focus()
}

// Public methods
defineExpose({
    focus,
    addTag,
    removeTag,
    clear: () => {
        tags.value = []
        updateValue()
    },
})
</script>

<style scoped>
.tags-input {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    transition: all var(--transition-fast);
    cursor: text;
}

.tags-input:focus-within:not(.tags-input-disabled):not(.tags-input-readonly) {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.tags-input-error {
    border-color: var(--color-error-500);
}

.tags-input-error:focus-within {
    box-shadow: 0 0 0 3px var(--color-error-100);
}

.tags-input-disabled {
    background: var(--color-neutral-100);
    opacity: 0.6;
    cursor: not-allowed;
}

.tags-input-readonly {
    background: var(--color-neutral-50);
    cursor: default;
}

/* Sizes */
.tags-input-sm {
    padding: var(--space-sm);
    min-height: 32px;
}

.tags-input-md {
    padding: var(--space-md);
    min-height: 40px;
}

.tags-input-lg {
    padding: var(--space-lg);
    min-height: 48px;
}

.tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
}

.tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    white-space: nowrap;
    max-width: 200px;
}

.tag-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tag-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-full);
    transition: all var(--transition-fast);
    flex-shrink: 0;
    padding: 1px;
}

/* Tag sizes */
.tag-sm {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--text-xs);
}

.tag-md {
    padding: var(--space-xs) var(--space-md);
    font-size: var(--text-xs);
}

.tag-lg {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-sm);
}

/* Tag variants */
.tag-default {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
}

.tag-default .tag-remove {
    color: var(--color-neutral-500);
}

.tag-default .tag-remove:hover {
    background: var(--color-neutral-200);
    color: var(--color-neutral-700);
}

.tag-primary {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
}

.tag-primary .tag-remove {
    color: var(--color-primary-600);
}

.tag-primary .tag-remove:hover {
    background: var(--color-primary-200);
    color: var(--color-primary-800);
}

.tag-secondary {
    background: var(--color-neutral-200);
    color: var(--color-neutral-800);
}

.tag-secondary .tag-remove {
    color: var(--color-neutral-600);
}

.tag-secondary .tag-remove:hover {
    background: var(--color-neutral-300);
    color: var(--color-neutral-800);
}

.tag-outline {
    background: transparent;
    color: var(--text-color);
    border: 1px solid var(--surface-border);
}

.tag-outline .tag-remove {
    color: var(--text-color-secondary);
}

.tag-outline .tag-remove:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.tag-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-color);
    font-family: inherit;
    line-height: var(--leading-normal);
}

.tag-input::placeholder {
    color: var(--text-color-secondary);
}

.tag-input-disabled,
.tag-input-readonly {
    cursor: inherit;
}

/* Tag input sizes */
.tag-input-sm {
    min-width: 80px;
    font-size: var(--text-xs);
    padding: var(--space-xs) 0;
}

.tag-input-md {
    min-width: 100px;
    font-size: var(--text-sm);
    padding: var(--space-sm) 0;
}

.tag-input-lg {
    min-width: 120px;
    font-size: var(--text-base);
    padding: var(--space-md) 0;
}

/* Dark theme adjustments */
[data-theme='dark'] .tag-default {
    background: var(--color-neutral-800);
    color: var(--color-neutral-200);
}

[data-theme='dark'] .tag-default .tag-remove {
    color: var(--color-neutral-400);
}

[data-theme='dark'] .tag-default .tag-remove:hover {
    background: var(--color-neutral-700);
    color: var(--color-neutral-200);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .tags-input-md {
        min-height: 36px;
    }

    .tags-input-lg {
        min-height: 44px;
    }

    .tag {
        max-width: 150px;
    }

    .tag-input-md,
    .tag-input-lg {
        min-width: 80px;
    }
}
</style>
