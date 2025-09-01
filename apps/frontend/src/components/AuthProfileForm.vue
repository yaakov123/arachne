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

            <!-- Bearer Token -->
            <div v-if="formData.method === 'bearer'" class="method-config">
                <AuthValueSourceInput
                    v-model="formData.authConfig.token"
                    label="Bearer Token *"
                    placeholder="Enter token or configure source"
                    :error="errors['authConfig.token']"
                />
            </div>

            <!-- API Key -->
            <div
                v-else-if="formData.method === 'api-key'"
                class="method-config"
            >
                <AuthValueSourceInput
                    v-model="formData.authConfig.key"
                    label="API Key *"
                    placeholder="Enter API key or configure source"
                    :error="errors['authConfig.key']"
                />
                <AuthPlacementInput
                    v-model="formData.authConfig.placement"
                    label="Key Placement *"
                    :error="errors['authConfig.placement']"
                />
            </div>

            <!-- Basic Auth -->
            <div v-else-if="formData.method === 'basic'" class="method-config">
                <AuthValueSourceInput
                    v-model="formData.authConfig.username"
                    label="Username *"
                    placeholder="Enter username or configure source"
                    :error="errors['authConfig.username']"
                />
                <AuthValueSourceInput
                    v-model="formData.authConfig.password"
                    label="Password *"
                    placeholder="Enter password or configure source"
                    :error="errors['authConfig.password']"
                />
            </div>

            <!-- JWT -->
            <div v-else-if="formData.method === 'jwt'" class="method-config">
                <AuthValueSourceInput
                    v-model="formData.authConfig.token"
                    label="JWT Token *"
                    placeholder="Enter JWT token or configure source"
                    :error="errors['authConfig.token']"
                />
                <AuthPlacementInput
                    v-model="formData.authConfig.placement"
                    label="Token Placement *"
                    :error="errors['authConfig.placement']"
                />
            </div>

            <!-- OAuth 2.0 -->
            <div v-else-if="formData.method === 'oauth2'" class="method-config">
                <AuthValueSourceInput
                    v-model="formData.authConfig.accessToken"
                    label="Access Token *"
                    placeholder="Enter access token or configure source"
                    :error="errors['authConfig.accessToken']"
                />
                <AuthValueSourceInput
                    v-model="formData.authConfig.refreshToken"
                    label="Refresh Token"
                    placeholder="Enter refresh token or configure source"
                    :error="errors['authConfig.refreshToken']"
                />
                <AuthPlacementInput
                    v-model="formData.authConfig.placement"
                    label="Token Placement *"
                    :error="errors['authConfig.placement']"
                />
            </div>

            <!-- Custom Header -->
            <div
                v-else-if="formData.method === 'custom-header'"
                class="method-config"
            >
                <AuthValueSourceInput
                    v-model="formData.authConfig.value"
                    label="Header Value *"
                    placeholder="Enter header value or configure source"
                    :error="errors['authConfig.value']"
                />
                <div class="form-group">
                    <label class="form-label">Header Name *</label>
                    <input
                        v-model="formData.authConfig.placement.name"
                        type="text"
                        class="form-input"
                        placeholder="X-API-Key"
                        required
                    />
                </div>
                <div class="form-group">
                    <label class="form-label">Header Prefix</label>
                    <input
                        v-model="formData.authConfig.placement.prefix"
                        type="text"
                        class="form-input"
                        placeholder="Bearer "
                    />
                </div>
            </div>

            <!-- Custom -->
            <div v-else-if="formData.method === 'custom'" class="method-config">
                <div class="alert alert-info">
                    <Info :size="16" />
                    <span
                        >Custom auth allows you to define multiple placement
                        strategies and values. This is advanced
                        functionality.</span
                    >
                </div>
                <!-- Custom auth would need a more complex UI - simplified for now -->
                <div class="form-group">
                    <label class="form-label">Configuration JSON</label>
                    <textarea
                        v-model="customConfigJson"
                        class="form-textarea"
                        rows="10"
                        placeholder='{"placements": [], "values": {}}'
                    />
                </div>
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
import type {
    AuthMethodConfig,
    AuthValueSource,
    AuthPlacementConfig,
} from '@/types'
import AuthValueSourceInput from './AuthValueSourceInput.vue'
import AuthPlacementInput from './AuthPlacementInput.vue'
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

// Form data
const formData = ref({
    name: '',
    description: '',
    method: '',
    authConfig: {} as any,
    priority: 100,
    enabled: true,
    tags: [] as string[],
})

// Errors
const errors = ref<Record<string, string>>({})

// Custom config JSON for custom method
const customConfigJson = ref('')

// Initialize form data
const initializeForm = () => {
    if (props.profile) {
        formData.value = {
            name: props.profile.name,
            description: props.profile.description || '',
            method: props.profile.method,
            authConfig: JSON.parse(JSON.stringify(props.profile.authConfig)),
            priority: props.profile.priority || 100,
            enabled: props.profile.enabled !== false,
            tags: Array.isArray(props.profile.tags)
                ? [...props.profile.tags]
                : [],
        }

        if (props.profile.method === 'custom') {
            customConfigJson.value = JSON.stringify(
                props.profile.authConfig,
                null,
                2
            )
        }
    } else {
        // Reset to defaults
        formData.value = {
            name: '',
            description: '',
            method: '',
            authConfig: {},
            priority: 100,
            enabled: true,
            tags: [],
        }
        customConfigJson.value = ''
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
                formData.value.authConfig = {
                    method: 'bearer',
                    token: { type: 'static', value: '' },
                }
                break
            case 'api-key':
                formData.value.authConfig = {
                    method: 'api-key',
                    key: { type: 'static', value: '' },
                    placement: { type: 'header', name: 'X-API-Key' },
                }
                break
            case 'basic':
                formData.value.authConfig = {
                    method: 'basic',
                    username: { type: 'static', value: '' },
                    password: { type: 'static', value: '' },
                }
                break
            case 'jwt':
                formData.value.authConfig = {
                    method: 'jwt',
                    token: { type: 'static', value: '' },
                    placement: {
                        type: 'header',
                        name: 'Authorization',
                        prefix: 'Bearer ',
                    },
                }
                break
            case 'oauth2':
                formData.value.authConfig = {
                    method: 'oauth2',
                    accessToken: { type: 'static', value: '' },
                    placement: {
                        type: 'header',
                        name: 'Authorization',
                        prefix: 'Bearer ',
                    },
                }
                break
            case 'custom-header':
                formData.value.authConfig = {
                    method: 'custom-header',
                    value: { type: 'static', value: '' },
                    placement: { type: 'header', name: '', prefix: '' },
                }
                break
            case 'custom':
                formData.value.authConfig = {
                    method: 'custom',
                    placements: [],
                    values: {},
                }
                customConfigJson.value = JSON.stringify(
                    formData.value.authConfig,
                    null,
                    2
                )
                break
        }
    }
)

// Watch custom config JSON
watch(customConfigJson, (newJson) => {
    if (formData.value.method === 'custom') {
        try {
            const parsed = JSON.parse(newJson)
            formData.value.authConfig = { method: 'custom', ...parsed }
        } catch (e) {
            // Invalid JSON, ignore
        }
    }
})

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

const validateForm = (): boolean => {
    errors.value = {}

    if (!formData.value.name.trim()) {
        errors.value.name = 'Name is required'
    }

    if (!formData.value.method) {
        errors.value.method = 'Authentication method is required'
    }

    // Method-specific validation
    if (formData.value.method && formData.value.authConfig) {
        const config = formData.value.authConfig

        switch (formData.value.method) {
            case 'bearer':
                if (!config.token?.value) {
                    errors.value['authConfig.token'] = 'Token is required'
                }
                break
            case 'api-key':
                if (!config.key?.value) {
                    errors.value['authConfig.key'] = 'API key is required'
                }
                if (!config.placement?.name) {
                    errors.value['authConfig.placement'] =
                        'Placement name is required'
                }
                break
            case 'basic':
                if (!config.username?.value) {
                    errors.value['authConfig.username'] = 'Username is required'
                }
                if (!config.password?.value) {
                    errors.value['authConfig.password'] = 'Password is required'
                }
                break
            case 'jwt':
                if (!config.token?.value) {
                    errors.value['authConfig.token'] = 'JWT token is required'
                }
                if (!config.placement?.name) {
                    errors.value['authConfig.placement'] =
                        'Placement name is required'
                }
                break
            case 'oauth2':
                if (!config.accessToken?.value) {
                    errors.value['authConfig.accessToken'] =
                        'Access token is required'
                }
                if (!config.placement?.name) {
                    errors.value['authConfig.placement'] =
                        'Placement name is required'
                }
                break
            case 'custom-header':
                if (!config.value?.value) {
                    errors.value['authConfig.value'] =
                        'Header value is required'
                }
                if (!config.placement?.name) {
                    errors.value['authConfig.placement'] =
                        'Header name is required'
                }
                break
            case 'custom':
                if (customConfigJson.value) {
                    try {
                        JSON.parse(customConfigJson.value)
                    } catch (e) {
                        errors.value['authConfig.custom'] =
                            'Invalid JSON configuration'
                    }
                }
                break
        }
    }

    return Object.keys(errors.value).length === 0
}

const handleSubmit = () => {
    if (!validateForm()) {
        return
    }

    const submitData = {
        name: formData.value.name.trim(),
        description: formData.value.description?.trim() || undefined,
        method: formData.value.method,
        authConfig: formData.value.authConfig,
        priority: formData.value.priority,
        enabled: formData.value.enabled,
        tags: formData.value.tags.filter((tag) => tag.trim()),
    }

    emit('submit', submitData)
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
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    padding: var(--space-xl);
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
}
</style>
