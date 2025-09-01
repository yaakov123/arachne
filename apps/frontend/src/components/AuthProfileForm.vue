<template>
    <form @submit.prevent="handleSubmit" class="auth-profile-form">
        <!-- Basic Information -->
        <div class="form-section">
            <h4 class="section-title">Basic Information</h4>

            <div class="form-group">
                <label for="name" class="form-label">Name *</label>
                <input
                    id="name"
                    v-model="formData.name"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': errors.name }"
                    placeholder="Enter auth profile name"
                    required
                />
                <span v-if="errors.name" class="form-error">{{
                    errors.name
                }}</span>
            </div>

            <div class="form-group">
                <label for="description" class="form-label">Description</label>
                <textarea
                    id="description"
                    v-model="formData.description"
                    class="form-textarea"
                    placeholder="Optional description for this auth profile"
                    rows="3"
                />
            </div>

            <div class="form-group">
                <label for="method" class="form-label"
                    >Authentication Method *</label
                >
                <select
                    id="method"
                    v-model="formData.method"
                    class="form-select"
                    :class="{ 'form-input-error': errors.method }"
                    required
                >
                    <option value="">Select method...</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api-key">API Key</option>
                    <option value="basic">Basic Auth</option>
                    <option value="jwt">JWT</option>
                    <option value="oauth2">OAuth 2.0</option>
                    <option value="custom-header">Custom Header</option>
                    <option value="custom">Custom</option>
                </select>
                <span v-if="errors.method" class="form-error">{{
                    errors.method
                }}</span>
            </div>
        </div>

        <!-- Method-specific Configuration -->
        <div v-if="formData.method" class="form-section">
            <h4 class="section-title">
                {{ getMethodTitle(formData.method) }} Configuration
            </h4>

            <div class="method-config">
                <!-- Bearer Token -->
                <BearerAuthConfig
                    v-if="formData.method === 'bearer'"
                    ref="authConfigRef"
                    v-model="formData.authConfig"
                    :errors="getMethodErrors()"
                />

                <!-- API Key -->
                <ApiKeyAuthConfig
                    v-else-if="formData.method === 'api-key'"
                    ref="authConfigRef"
                    v-model="formData.authConfig"
                    :errors="getMethodErrors()"
                />

                <!-- Basic Auth -->
                <BasicAuthConfig
                    v-else-if="formData.method === 'basic'"
                    ref="authConfigRef"
                    v-model="formData.authConfig"
                    :errors="getMethodErrors()"
                />

                <!-- JWT -->
                <JwtAuthConfig
                    v-else-if="formData.method === 'jwt'"
                    ref="authConfigRef"
                    v-model="formData.authConfig"
                    :errors="getMethodErrors()"
                />

                <!-- OAuth 2.0 -->
                <OAuth2AuthConfig
                    v-else-if="formData.method === 'oauth2'"
                    ref="authConfigRef"
                    v-model="formData.authConfig"
                    :errors="getMethodErrors()"
                />

                <!-- Custom Header -->
                <CustomHeaderAuthConfig
                    v-else-if="formData.method === 'custom-header'"
                    ref="authConfigRef"
                    v-model="formData.authConfig"
                    :errors="getMethodErrors()"
                />

                <!-- Custom -->
                <CustomAuthConfig
                    v-else-if="formData.method === 'custom'"
                    ref="authConfigRef"
                    v-model="formData.authConfig"
                    :errors="getMethodErrors()"
                />
            </div>
        </div>

        <!-- Advanced Settings -->
        <div class="form-section">
            <h4 class="section-title">Advanced Settings</h4>

            <div class="form-row">
                <div class="form-group">
                    <label for="priority" class="form-label">Priority</label>
                    <input
                        id="priority"
                        v-model.number="formData.priority"
                        type="number"
                        class="form-input"
                        min="0"
                        max="1000"
                        placeholder="100"
                    />
                    <small class="form-help"
                        >Higher priority profiles are applied first when
                        multiple profiles match</small
                    >
                </div>

                <div class="form-group">
                    <label class="form-label">Status</label>
                    <div class="form-toggle">
                        <input
                            id="enabled"
                            v-model="formData.enabled"
                            type="checkbox"
                            class="toggle-input"
                        />
                        <label for="enabled" class="toggle-label">
                            <span class="toggle-switch"></span>
                            <span class="toggle-text">{{
                                formData.enabled ? 'Enabled' : 'Disabled'
                            }}</span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label for="tags" class="form-label">Tags</label>
                <TagsInput
                    v-model="formData.tags"
                    placeholder="Add tags for organization..."
                />
            </div>
        </div>

        <!-- Conditions -->
        <div class="form-section">
            <h4 class="section-title">Conditions</h4>
            <div class="alert alert-info">
                <Info :size="16" />
                <span
                    >Configure when this auth profile should be applied. Leave
                    empty to apply to all requests.</span
                >
            </div>

            <!-- URL and Host Patterns -->
            <div class="form-row">
                <div class="form-group">
                    <label for="urlPattern" class="form-label"
                        >URL Pattern</label
                    >
                    <input
                        id="urlPattern"
                        v-model="formData.conditions.urlPattern"
                        type="text"
                        class="form-input"
                        placeholder="e.g., /api/v1/*, https://api.example.com/*"
                    />
                    <small class="form-help"
                        >Regular expression or glob pattern for URL
                        matching</small
                    >
                </div>

                <div class="form-group">
                    <label for="hostPattern" class="form-label"
                        >Host Pattern</label
                    >
                    <input
                        id="hostPattern"
                        v-model="formData.conditions.hostPattern"
                        type="text"
                        class="form-input"
                        placeholder="e.g., *.api.example.com, api.example.com"
                    />
                    <small class="form-help"
                        >Regular expression or glob pattern for host
                        matching</small
                    >
                </div>
            </div>

            <!-- HTTP Methods -->
            <div class="form-group">
                <label class="form-label">HTTP Methods</label>
                <div class="methods-grid">
                    <label
                        v-for="method in [
                            'GET',
                            'POST',
                            'PUT',
                            'DELETE',
                            'PATCH',
                            'HEAD',
                            'OPTIONS',
                        ]"
                        :key="method"
                        class="method-checkbox"
                    >
                        <input
                            v-model="formData.conditions.methods"
                            type="checkbox"
                            :value="method"
                            class="checkbox-input"
                        />
                        <span class="checkbox-label">{{ method }}</span>
                    </label>
                </div>
                <small class="form-help"
                    >Select specific HTTP methods, or leave empty for all
                    methods</small
                >
            </div>

            <!-- Header Conditions -->
            <div class="form-group">
                <label class="form-label">Header Conditions</label>
                <div class="conditions-list">
                    <div
                        v-for="(condition, index) in formData.conditions
                            .headerConditions"
                        :key="`header-${index}`"
                        class="condition-item"
                    >
                        <input
                            v-model="condition.name"
                            type="text"
                            class="form-input condition-name"
                            placeholder="Header name"
                        />
                        <select
                            v-model="condition.exists"
                            class="form-select condition-exists"
                        >
                            <option :value="undefined">Any value</option>
                            <option :value="true">Must exist</option>
                            <option :value="false">Must not exist</option>
                        </select>
                        <input
                            v-if="condition.exists !== false"
                            v-model="condition.value"
                            type="text"
                            class="form-input condition-value"
                            placeholder="Header value (optional)"
                        />
                        <button
                            type="button"
                            class="btn-remove"
                            @click="removeHeaderCondition(index)"
                        >
                            ×
                        </button>
                    </div>
                    <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        @click="addHeaderCondition"
                    >
                        + Add Header Condition
                    </button>
                </div>
                <small class="form-help"
                    >Apply auth only when specific headers are
                    present/absent</small
                >
            </div>

            <!-- Query Conditions -->
            <div class="form-group">
                <label class="form-label">Query Parameter Conditions</label>
                <div class="conditions-list">
                    <div
                        v-for="(condition, index) in formData.conditions
                            .queryConditions"
                        :key="`query-${index}`"
                        class="condition-item"
                    >
                        <input
                            v-model="condition.name"
                            type="text"
                            class="form-input condition-name"
                            placeholder="Parameter name"
                        />
                        <select
                            v-model="condition.exists"
                            class="form-select condition-exists"
                        >
                            <option :value="undefined">Any value</option>
                            <option :value="true">Must exist</option>
                            <option :value="false">Must not exist</option>
                        </select>
                        <input
                            v-if="condition.exists !== false"
                            v-model="condition.value"
                            type="text"
                            class="form-input condition-value"
                            placeholder="Parameter value (optional)"
                        />
                        <button
                            type="button"
                            class="btn-remove"
                            @click="removeQueryCondition(index)"
                        >
                            ×
                        </button>
                    </div>
                    <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        @click="addQueryCondition"
                    >
                        + Add Query Condition
                    </button>
                </div>
                <small class="form-help"
                    >Apply auth only when specific query parameters are
                    present/absent</small
                >
            </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
            <button
                type="button"
                class="btn btn-secondary"
                @click="$emit('cancel')"
            >
                Cancel
            </button>
            <button
                type="submit"
                class="btn btn-primary"
                :disabled="isSubmitting || !isFormValid"
            >
                <Loader2 v-if="isSubmitting" class="spinner" :size="16" />
                {{ isEditMode ? 'Update Profile' : 'Create Profile' }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Loader2, Info } from 'lucide-vue-next'
import type { AuthProfile } from '@arachne/database'
import {
    BearerAuthConfig,
    ApiKeyAuthConfig,
    BasicAuthConfig,
    JwtAuthConfig,
    OAuth2AuthConfig,
    CustomHeaderAuthConfig,
    CustomAuthConfig,
    createDefaultBearerConfig,
    createDefaultApiKeyConfig,
    createDefaultBasicConfig,
    createDefaultJwtConfig,
    createDefaultOAuth2Config,
    createDefaultCustomHeaderConfig,
    createDefaultCustomConfig,
} from './auth'
import TagsInput from './TagsInput.vue'

// Props
interface Props {
    profile?: AuthProfile | null
    isSubmitting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    profile: null,
    isSubmitting: false,
})

// Emits
const emit = defineEmits<{
    submit: [data: any]
    cancel: []
}>()

// Computed
const isEditMode = computed(() => !!props.profile)

// Auth config component reference
const authConfigRef = ref<any>(null)

// Form data
const formData = ref({
    name: '',
    description: '',
    method: '',
    authConfig: {} as any,
    conditions: {
        urlPattern: '',
        hostPattern: '',
        methods: [] as string[],
        headerConditions: [] as Array<{
            name: string
            exists?: boolean
            value?: string
        }>,
        queryConditions: [] as Array<{
            name: string
            exists?: boolean
            value?: string
        }>,
    },
    priority: 100,
    enabled: true,
    tags: [] as string[],
})

// Errors
const errors = ref<Record<string, string>>({})

// Initialize form data
const initializeForm = () => {
    if (props.profile) {
        formData.value = {
            name: props.profile.name,
            description: props.profile.description || '',
            method: props.profile.method,
            authConfig: JSON.parse(JSON.stringify(props.profile.authConfig)),
            conditions: props.profile.conditions
                ? {
                      urlPattern:
                          typeof props.profile.conditions.urlPattern ===
                          'string'
                              ? props.profile.conditions.urlPattern
                              : props.profile.conditions.urlPattern?.toString() ||
                                '',
                      hostPattern:
                          typeof props.profile.conditions.hostPattern ===
                          'string'
                              ? props.profile.conditions.hostPattern
                              : props.profile.conditions.hostPattern?.toString() ||
                                '',
                      methods: Array.isArray(props.profile.conditions.methods)
                          ? [...props.profile.conditions.methods]
                          : [],
                      headerConditions: Array.isArray(
                          props.profile.conditions.headerConditions
                      )
                          ? props.profile.conditions.headerConditions.map(
                                (hc) => ({
                                    name: hc.name,
                                    exists: hc.exists,
                                    value:
                                        typeof hc.value === 'string'
                                            ? hc.value
                                            : hc.value?.toString() || '',
                                })
                            )
                          : [],
                      queryConditions: Array.isArray(
                          props.profile.conditions.queryConditions
                      )
                          ? props.profile.conditions.queryConditions.map(
                                (qc) => ({
                                    name: qc.name,
                                    exists: qc.exists,
                                    value:
                                        typeof qc.value === 'string'
                                            ? qc.value
                                            : qc.value?.toString() || '',
                                })
                            )
                          : [],
                  }
                : {
                      urlPattern: '',
                      hostPattern: '',
                      methods: [],
                      headerConditions: [],
                      queryConditions: [],
                  },
            priority: props.profile.priority || 100,
            enabled: props.profile.enabled !== false,
            tags: Array.isArray(props.profile.tags)
                ? [...props.profile.tags]
                : [],
        }
    } else {
        // Reset to defaults
        formData.value = {
            name: '',
            description: '',
            method: '',
            authConfig: {},
            conditions: {
                urlPattern: '',
                hostPattern: '',
                methods: [],
                headerConditions: [],
                queryConditions: [],
            },
            priority: 100,
            enabled: true,
            tags: [],
        }
    }
    errors.value = {}
}

// Watch for profile changes
watch(() => props.profile, initializeForm, { immediate: true })

// Watch method changes to initialize auth config
watch(
    () => formData.value.method,
    (newMethod) => {
        if (!newMethod) {
            formData.value.authConfig = {}
            return
        }

        // Initialize auth config based on method
        switch (newMethod) {
            case 'bearer':
                formData.value.authConfig = createDefaultBearerConfig()
                break
            case 'api-key':
                formData.value.authConfig = createDefaultApiKeyConfig()
                break
            case 'basic':
                formData.value.authConfig = createDefaultBasicConfig()
                break
            case 'jwt':
                formData.value.authConfig = createDefaultJwtConfig()
                break
            case 'oauth2':
                formData.value.authConfig = createDefaultOAuth2Config()
                break
            case 'custom-header':
                formData.value.authConfig = createDefaultCustomHeaderConfig()
                break
            case 'custom':
                formData.value.authConfig = createDefaultCustomConfig()
                break
        }
    }
)

// Validation
const isFormValid = computed(() => {
    return (
        formData.value.name.trim() &&
        formData.value.method &&
        Object.keys(errors.value).length === 0
    )
})

// Methods
const getMethodTitle = (method: string): string => {
    const titles: Record<string, string> = {
        bearer: 'Bearer Token',
        'api-key': 'API Key',
        basic: 'Basic Authentication',
        jwt: 'JWT Token',
        oauth2: 'OAuth 2.0',
        'custom-header': 'Custom Header',
        custom: 'Custom Authentication',
    }
    return titles[method] || method
}

const getMethodErrors = (): Record<string, string> => {
    // Filter errors that are related to the auth config
    const methodErrors: Record<string, string> = {}
    for (const [key, value] of Object.entries(errors.value)) {
        if (key.startsWith('authConfig.')) {
            const cleanKey = key.replace('authConfig.', '')
            methodErrors[cleanKey] = value
        }
    }
    return methodErrors
}

const validateForm = (): boolean => {
    errors.value = {}

    if (!formData.value.name.trim()) {
        errors.value.name = 'Name is required'
    }

    if (!formData.value.method) {
        errors.value.method = 'Authentication method is required'
    }

    // Method-specific validation using auth component validation
    if (formData.value.method && authConfigRef.value?.validate) {
        const authErrors = authConfigRef.value.validate()
        for (const [key, value] of Object.entries(authErrors)) {
            if (typeof value === 'string') {
                errors.value[`authConfig.${key}`] = value
            }
        }
    }

    return Object.keys(errors.value).length === 0
}

const handleSubmit = () => {
    if (!validateForm()) {
        return
    }

    // Clean up conditions - only include non-empty values
    const cleanConditions = {
        urlPattern: formData.value.conditions.urlPattern?.trim() || undefined,
        hostPattern: formData.value.conditions.hostPattern?.trim() || undefined,
        methods:
            formData.value.conditions.methods.length > 0
                ? formData.value.conditions.methods
                : undefined,
        headerConditions: formData.value.conditions.headerConditions
            .filter((hc) => hc.name.trim())
            .map((hc) => ({
                name: hc.name.trim(),
                exists: hc.exists,
                value: hc.value?.trim() || undefined,
            })),
        queryConditions: formData.value.conditions.queryConditions
            .filter((qc) => qc.name.trim())
            .map((qc) => ({
                name: qc.name.trim(),
                exists: qc.exists,
                value: qc.value?.trim() || undefined,
            })),
    }

    // Only include conditions if any are specified
    const hasConditions =
        cleanConditions.urlPattern ||
        cleanConditions.hostPattern ||
        cleanConditions.methods ||
        cleanConditions.headerConditions.length > 0 ||
        cleanConditions.queryConditions.length > 0

    const submitData = {
        name: formData.value.name.trim(),
        description: formData.value.description?.trim() || undefined,
        method: formData.value.method,
        authConfig: formData.value.authConfig,
        conditions: hasConditions ? cleanConditions : undefined,
        priority: formData.value.priority,
        enabled: formData.value.enabled,
        tags: formData.value.tags.filter((tag) => tag.trim()),
    }

    emit('submit', submitData)
}

// Condition management methods
const addHeaderCondition = () => {
    formData.value.conditions.headerConditions.push({
        name: '',
        exists: undefined,
        value: '',
    })
}

const removeHeaderCondition = (index: number) => {
    formData.value.conditions.headerConditions.splice(index, 1)
}

const addQueryCondition = () => {
    formData.value.conditions.queryConditions.push({
        name: '',
        exists: undefined,
        value: '',
    })
}

const removeQueryCondition = (index: number) => {
    formData.value.conditions.queryConditions.splice(index, 1)
}

// Expose methods for parent component
defineExpose({
    initializeForm,
    validateForm,
})
</script>

<style scoped>
.auth-profile-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
}

.form-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
}

.section-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0;
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--surface-border);
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xl);
}

.form-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

.form-input,
.form-select,
.form-textarea {
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-input-error {
    border-color: var(--color-error-500);
}

.form-input-error:focus {
    box-shadow: 0 0 0 3px var(--color-error-100);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.form-error {
    font-size: var(--text-xs);
    color: var(--color-error-600);
    font-weight: var(--font-medium);
}

.form-help {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
}

.form-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
}

.toggle-input {
    display: none;
}

.toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    cursor: pointer;
}

.toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--color-neutral-300);
    border-radius: var(--radius-full);
    transition: background-color var(--transition-fast);
}

.toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: var(--radius-full);
    transition: transform var(--transition-fast);
}

.toggle-input:checked + .toggle-label .toggle-switch {
    background: var(--primary-color);
}

.toggle-input:checked + .toggle-label .toggle-switch::after {
    transform: translateX(20px);
}

.toggle-text {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

.method-config {
    background: var(--surface-section);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-border);
}

.alert {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-lg);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
}

.alert-info {
    background: var(--color-info-50);
    color: var(--color-info-700);
    border: 1px solid var(--color-info-200);
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-lg);
    padding-top: var(--space-xl);
    border-top: 1px solid var(--surface-border);
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-decoration: none;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700);
}

.btn-secondary {
    background: transparent;
    color: var(--text-color-secondary);
    border: 1px solid var(--surface-border);
}

.btn-secondary:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.spinner {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

/* Conditions styling */
.methods-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-md);
    margin-top: var(--space-sm);
}

.method-checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    transition: background-color var(--transition-fast);
}

.method-checkbox:hover {
    background: var(--surface-hover);
}

.checkbox-input {
    margin: 0;
    accent-color: var(--primary-color);
}

.checkbox-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

.conditions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.condition-item {
    display: grid;
    grid-template-columns: 2fr 1fr 2fr auto;
    gap: var(--space-md);
    align-items: center;
    padding: var(--space-md);
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
}

.condition-name,
.condition-value {
    min-width: 0;
}

.condition-exists {
    min-width: 120px;
}

.btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-error-500);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-lg);
    font-weight: bold;
    transition: background-color var(--transition-fast);
}

.btn-remove:hover {
    background: var(--color-error-600);
}

.btn-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-xs);
}

@media (max-width: 768px) {
    .form-row {
        grid-template-columns: 1fr;
        gap: var(--space-lg);
    }

    .form-actions {
        flex-direction: column-reverse;
    }

    .btn {
        width: 100%;
        justify-content: center;
    }

    .methods-grid {
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    }

    .condition-item {
        grid-template-columns: 1fr;
        gap: var(--space-sm);
    }

    .condition-exists {
        min-width: auto;
    }
}
</style>
