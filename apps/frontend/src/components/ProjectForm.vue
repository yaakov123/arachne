<template>
    <form @submit.prevent="$emit('submit')">
        <div class="form-group">
            <label :for="`${idPrefix}-project-name`">Project Name *</label>
            <input
                :id="`${idPrefix}-project-name`"
                :value="modelValue.name"
                @input="
                    updateField(
                        'name',
                        ($event.target as HTMLInputElement).value
                    )
                "
                type="text"
                class="form-input"
                placeholder="Enter project name"
                required
                maxlength="100"
            />
        </div>

        <div class="form-group">
            <label :for="`${idPrefix}-project-description`">Description</label>
            <textarea
                :id="`${idPrefix}-project-description`"
                :value="modelValue.description"
                @input="
                    updateField(
                        'description',
                        ($event.target as HTMLTextAreaElement).value
                    )
                "
                class="form-textarea"
                placeholder="Optional project description"
                rows="3"
            ></textarea>
        </div>

        <div class="form-group">
            <label :for="`${idPrefix}-project-tags`">Tags</label>
            <div class="tags-input-container">
                <div class="tags-display">
                    <div
                        v-for="(tag, index) in modelValue.tags || []"
                        :key="index"
                        class="tag-chip"
                    >
                        <span class="tag-text">{{ tag }}</span>
                        <button
                            type="button"
                            class="tag-remove"
                            @click="removeTag(index)"
                            :aria-label="`Remove ${tag} tag`"
                        >
                            ×
                        </button>
                    </div>
                    <input
                        :id="`${idPrefix}-project-tags`"
                        v-model="currentTagInput"
                        @keydown="handleTagKeydown"
                        @blur="addCurrentTag"
                        type="text"
                        class="tag-input"
                        placeholder="Add a tag and press Enter"
                        maxlength="50"
                    />
                </div>
            </div>
            <div class="form-help">
                Press Enter or comma to add a tag. Click × to remove tags.
            </div>
        </div>

        <div class="form-section">
            <h4>Project Settings</h4>

            <div class="form-group">
                <label :for="`${idPrefix}-max-transactions`"
                    >Max Transactions</label
                >
                <input
                    :id="`${idPrefix}-max-transactions`"
                    :value="modelValue.settings?.maxTransactions || 10000"
                    @input="
                        updateSetting(
                            'maxTransactions',
                            parseInt(($event.target as HTMLInputElement).value)
                        )
                    "
                    type="number"
                    class="form-input"
                    min="100"
                    max="100000"
                />
                <div class="form-help">
                    Maximum number of transactions to store (100-100,000)
                </div>
            </div>

            <div class="form-group">
                <label :for="`${idPrefix}-retention-days`"
                    >Retention Period (days)</label
                >
                <input
                    :id="`${idPrefix}-retention-days`"
                    :value="modelValue.settings?.retentionDays || 30"
                    @input="
                        updateSetting(
                            'retentionDays',
                            parseInt(($event.target as HTMLInputElement).value)
                        )
                    "
                    type="number"
                    class="form-input"
                    min="1"
                    max="365"
                />
                <div class="form-help">
                    How long to keep transactions before cleanup (1-365 days)
                </div>
            </div>

            <div class="form-group">
                <label :for="`${idPrefix}-host-filter-mode`"
                    >Host Filter Mode</label
                >
                <select
                    :id="`${idPrefix}-host-filter-mode`"
                    :value="hostFilterMode"
                    @change="
                        updateHostFilterMode(
                            ($event.target as HTMLSelectElement).value as
                                | 'blacklist'
                                | 'whitelist'
                        )
                    "
                    class="form-select"
                >
                    <option value="blacklist">
                        Blacklist (ignore specified hosts)
                    </option>
                    <option value="whitelist">
                        Whitelist (only capture specified hosts)
                    </option>
                </select>
                <div class="form-help">
                    Choose whether to ignore specified hosts (blacklist) or only
                    capture specified hosts (whitelist)
                </div>
            </div>

            <div class="form-group">
                <label :for="`${idPrefix}-host-filter`">{{
                    hostFilterMode === 'blacklist'
                        ? 'Hosts to Ignore'
                        : 'Hosts to Capture'
                }}</label>
                <textarea
                    :id="`${idPrefix}-host-filter`"
                    :value="hostFilterInput"
                    @input="
                        updateHostFilterInput(
                            ($event.target as HTMLTextAreaElement).value
                        )
                    "
                    class="form-textarea"
                    :placeholder="
                        hostFilterMode === 'blacklist'
                            ? 'Enter hosts to ignore, one per line. e.g.: analytics.google.com;*.ads.com;localhost:3000'
                            : 'Enter hosts to capture, one per line. e.g.: api.mysite.com;*.mydomain.com;localhost:8080'
                    "
                    rows="3"
                ></textarea>
                <div class="form-help">
                    {{
                        hostFilterMode === 'blacklist'
                            ? 'Hosts to ignore when capturing traffic'
                            : 'Only these hosts will be captured'
                    }}. Supports wildcards (*)
                </div>
            </div>

            <div class="form-group">
                <label :for="`${idPrefix}-max-body-size`"
                    >Max Body Size (MB)</label
                >
                <input
                    :id="`${idPrefix}-max-body-size`"
                    :value="maxBodySizeMB"
                    @input="
                        updateMaxBodySize(
                            parseInt(($event.target as HTMLInputElement).value)
                        )
                    "
                    type="number"
                    class="form-input"
                    min="1"
                    max="100"
                />
                <div class="form-help">
                    Maximum request/response body size to capture (1-100 MB)
                </div>
            </div>
        </div>

        <div class="form-actions">
            <button
                type="button"
                class="btn btn-outline"
                @click="$emit('cancel')"
            >
                Cancel
            </button>
            <button
                type="submit"
                class="btn btn-primary"
                :disabled="!modelValue.name?.trim() || loading"
            >
                <span v-if="loading" class="loading-spinner"></span>
                {{ submitText }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project } from '@arachne/database'

interface Props {
    modelValue: Project
    loading?: boolean
    submitText?: string
    idPrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    submitText: 'Save',
    idPrefix: 'project-form',
})

const emit = defineEmits<{
    'update:modelValue': [value: Project]
    submit: []
    cancel: []
}>()

// Current tag input
const currentTagInput = ref('')

// Computed properties for input fields

const hostFilterInput = computed(() => {
    return (props.modelValue.settings?.hostFilter || []).join('\n')
})

const hostFilterMode = computed(() => {
    return props.modelValue.settings?.hostFilterMode || 'blacklist'
})

const maxBodySizeMB = computed(() => {
    const bytes = props.modelValue.settings?.maxBodySize || 10 * 1024 * 1024
    return Math.round(bytes / (1024 * 1024))
})

// Update methods
function updateField(field: keyof Project, value: string) {
    emit('update:modelValue', {
        ...props.modelValue,
        [field]: value,
    })
}

function updateSetting(setting: string, value: number) {
    emit('update:modelValue', {
        ...props.modelValue,
        settings: {
            ...props.modelValue.settings,
            [setting]: value,
        },
    })
}

// Tag management functions
function addTag(tagText: string) {
    const trimmedTag = tagText.trim()
    if (!trimmedTag) return

    const currentTags = props.modelValue.tags || []

    // Avoid duplicates (case-insensitive)
    if (
        currentTags.some(
            (tag) => tag.toLowerCase() === trimmedTag.toLowerCase()
        )
    ) {
        return
    }

    emit('update:modelValue', {
        ...props.modelValue,
        tags: [...currentTags, trimmedTag],
    })
}

function removeTag(index: number) {
    const currentTags = props.modelValue.tags || []
    const newTags = currentTags.filter((_, i) => i !== index)

    emit('update:modelValue', {
        ...props.modelValue,
        tags: newTags,
    })
}

function addCurrentTag() {
    if (currentTagInput.value.trim()) {
        addTag(currentTagInput.value)
        currentTagInput.value = ''
    }
}

function handleTagKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement
    const value = target.value

    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault()
        addCurrentTag()
    } else if (event.key === 'Backspace' && value === '') {
        // Remove last tag if input is empty and backspace is pressed
        const currentTags = props.modelValue.tags || []
        if (currentTags.length > 0) {
            removeTag(currentTags.length - 1)
        }
    }
}

function updateHostFilterInput(value: string) {
    const hostFilter = value
        .split('\n')
        .map((host) => host.trim())
        .filter((host) => host.length > 0)

    emit('update:modelValue', {
        ...props.modelValue,
        settings: {
            ...props.modelValue.settings,
            hostFilter,
        },
    })
}

function updateHostFilterMode(mode: 'blacklist' | 'whitelist') {
    emit('update:modelValue', {
        ...props.modelValue,
        settings: {
            ...props.modelValue.settings,
            hostFilterMode: mode,
        },
    })
}

function updateMaxBodySize(sizeMB: number) {
    const sizeBytes = sizeMB * 1024 * 1024
    emit('update:modelValue', {
        ...props.modelValue,
        settings: {
            ...props.modelValue.settings,
            maxBodySize: sizeBytes,
        },
    })
}
</script>

<style scoped>
/* Form Styles */
.form-group {
    margin-bottom: var(--space-lg);
}

.form-group label {
    display: block;
    font-weight: var(--font-medium);
    color: var(--text-color);
    margin-bottom: var(--space-sm);
}

.form-input,
.form-textarea,
.form-select {
    width: 100%;
    padding: var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--text-color);
    background: var(--surface-card);
    transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.form-help {
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
    margin-top: var(--space-xs);
}

.form-section {
    margin-top: var(--space-xl);
    padding-top: var(--space-xl);
    border-top: 1px solid var(--surface-border);
}

.form-section h4 {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-color);
    margin: 0 0 var(--space-lg) 0;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    margin-top: var(--space-xl);
    padding-top: var(--space-xl);
    border-top: 1px solid var(--surface-border);
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 120px;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-700);
}

.btn-outline {
    background-color: transparent;
    color: var(--primary-color);
    border-color: var(--primary-color);
}

.btn-outline:hover:not(:disabled) {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* Tag Input Styles */
.tags-input-container {
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    transition: border-color var(--transition-fast);
}

.tags-input-container:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.tags-display {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    padding: var(--space-sm);
    align-items: center;
    min-height: 44px;
}

.tag-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    max-width: 200px;
}

.tag-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tag-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: none;
    color: var(--color-primary-600);
    cursor: pointer;
    border-radius: 50%;
    font-size: 14px;
    font-weight: bold;
    line-height: 1;
    padding: 0;
    transition: all var(--transition-fast);
    flex-shrink: 0;
}

.tag-remove:hover {
    background: var(--color-primary-200);
    color: var(--color-primary-800);
}

.tag-input {
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-color);
    font-size: var(--text-base);
    padding: var(--space-xs);
    flex: 1;
    min-width: 120px;
}

.tag-input::placeholder {
    color: var(--text-color-secondary);
}

/* Responsive */
@media (max-width: 768px) {
    .form-actions {
        flex-direction: column;
    }

    .tags-display {
        padding: var(--space-xs);
    }

    .tag-input {
        min-width: 100px;
    }
}
</style>
