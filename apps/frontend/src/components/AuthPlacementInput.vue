<template>
    <div class="auth-placement">
        <label v-if="label" class="form-label">{{ label }}</label>

        <div class="placement-type-selector">
            <label class="form-label">Placement Type</label>
            <select
                v-model="placementType"
                class="form-select"
                @change="onPlacementTypeChange"
            >
                <option value="header">HTTP Header</option>
                <option value="query">Query Parameter</option>
                <option value="body-form">Form Data</option>
                <option value="body-json">JSON Body</option>
                <option value="body-raw">Raw Body</option>
                <option value="url-path">URL Path</option>
                <option value="cookie">Cookie</option>
            </select>
        </div>

        <!-- Header Placement -->
        <div v-if="placementType === 'header'" class="placement-config">
            <div class="form-group">
                <label class="form-label">Header Name *</label>
                <input
                    v-model="headerName"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': error }"
                    placeholder="Authorization"
                    @input="updateValue"
                />
            </div>
            <div class="form-group">
                <label class="form-label">Prefix</label>
                <input
                    v-model="headerPrefix"
                    type="text"
                    class="form-input"
                    placeholder="Bearer "
                    @input="updateValue"
                />
                <small class="form-help"
                    >Optional prefix (e.g., "Bearer " for Authorization
                    header)</small
                >
            </div>
            <div class="form-group">
                <label class="form-label">Suffix</label>
                <input
                    v-model="headerSuffix"
                    type="text"
                    class="form-input"
                    placeholder=""
                    @input="updateValue"
                />
            </div>
            <div class="form-group">
                <label class="form-label">Encoding</label>
                <select
                    v-model="headerEncoding"
                    class="form-select"
                    @change="updateValue"
                >
                    <option value="none">None</option>
                    <option value="base64">Base64</option>
                    <option value="url">URL Encoding</option>
                </select>
            </div>
        </div>

        <!-- Query Parameter Placement -->
        <div v-else-if="placementType === 'query'" class="placement-config">
            <div class="form-group">
                <label class="form-label">Parameter Name *</label>
                <input
                    v-model="queryName"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': error }"
                    placeholder="api_key"
                    @input="updateValue"
                />
            </div>
            <div class="form-group">
                <label class="form-label">Encoding</label>
                <select
                    v-model="queryEncoding"
                    class="form-select"
                    @change="updateValue"
                >
                    <option value="none">None</option>
                    <option value="url">URL Encoding</option>
                </select>
            </div>
        </div>

        <!-- Form Data Placement -->
        <div v-else-if="placementType === 'body-form'" class="placement-config">
            <div class="form-group">
                <label class="form-label">Field Name *</label>
                <input
                    v-model="formName"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': error }"
                    placeholder="token"
                    @input="updateValue"
                />
            </div>
            <div class="form-group">
                <label class="form-label">Encoding</label>
                <select
                    v-model="formEncoding"
                    class="form-select"
                    @change="updateValue"
                >
                    <option value="none">None</option>
                    <option value="url">URL Encoding</option>
                </select>
            </div>
        </div>

        <!-- JSON Body Placement -->
        <div v-else-if="placementType === 'body-json'" class="placement-config">
            <div class="form-group">
                <label class="form-label">JSON Path *</label>
                <input
                    v-model="jsonPath"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': error }"
                    placeholder="auth.token"
                    @input="updateValue"
                />
                <small class="form-help"
                    >Dot notation path (e.g., "auth.token" or
                    "credentials.apiKey")</small
                >
            </div>
            <div class="form-group">
                <div class="form-toggle">
                    <input
                        id="merge-json"
                        v-model="jsonMerge"
                        type="checkbox"
                        class="toggle-input"
                        @change="updateValue"
                    />
                    <label for="merge-json" class="toggle-label">
                        <span class="toggle-switch"></span>
                        <span class="toggle-text"
                            >Merge with existing JSON</span
                        >
                    </label>
                </div>
                <small class="form-help"
                    >If disabled, replaces entire request body</small
                >
            </div>
        </div>

        <!-- Raw Body Placement -->
        <div v-else-if="placementType === 'body-raw'" class="placement-config">
            <div class="form-group">
                <label class="form-label">Content Type</label>
                <input
                    v-model="rawContentType"
                    type="text"
                    class="form-input"
                    placeholder="application/octet-stream"
                    @input="updateValue"
                />
            </div>
            <div class="form-group">
                <label class="form-label">Encoding</label>
                <select
                    v-model="rawEncoding"
                    class="form-select"
                    @change="updateValue"
                >
                    <option value="none">None</option>
                    <option value="base64">Base64</option>
                </select>
            </div>
        </div>

        <!-- URL Path Placement -->
        <div v-else-if="placementType === 'url-path'" class="placement-config">
            <div class="form-group">
                <label class="form-label">Path Template *</label>
                <input
                    v-model="pathTemplate"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': error }"
                    placeholder="/api/{token}/users"
                    @input="updateValue"
                />
                <small class="form-help"
                    >Template with placeholder (e.g.,
                    "/api/{token}/users")</small
                >
            </div>
            <div class="form-group">
                <label class="form-label">Placeholder Name *</label>
                <input
                    v-model="pathPlaceholder"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': error }"
                    placeholder="token"
                    @input="updateValue"
                />
                <small class="form-help"
                    >Name of the placeholder in the template (without
                    braces)</small
                >
            </div>
        </div>

        <!-- Cookie Placement -->
        <div v-else-if="placementType === 'cookie'" class="placement-config">
            <div class="form-group">
                <label class="form-label">Cookie Name *</label>
                <input
                    v-model="cookieName"
                    type="text"
                    class="form-input"
                    :class="{ 'form-input-error': error }"
                    placeholder="auth_token"
                    @input="updateValue"
                />
            </div>
            <div class="form-group">
                <label class="form-label">Cookie Options</label>
                <div class="cookie-options">
                    <div class="form-group">
                        <label class="form-label">Domain</label>
                        <input
                            v-model="cookieDomain"
                            type="text"
                            class="form-input"
                            placeholder=".example.com"
                            @input="updateValue"
                        />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Path</label>
                        <input
                            v-model="cookiePath"
                            type="text"
                            class="form-input"
                            placeholder="/"
                            @input="updateValue"
                        />
                    </div>
                    <div class="form-group">
                        <label class="form-label">SameSite</label>
                        <select
                            v-model="cookieSameSite"
                            class="form-select"
                            @change="updateValue"
                        >
                            <option value="">Default</option>
                            <option value="strict">Strict</option>
                            <option value="lax">Lax</option>
                            <option value="none">None</option>
                        </select>
                    </div>
                </div>
                <div class="cookie-flags">
                    <div class="form-toggle">
                        <input
                            id="cookie-secure"
                            v-model="cookieSecure"
                            type="checkbox"
                            class="toggle-input"
                            @change="updateValue"
                        />
                        <label for="cookie-secure" class="toggle-label">
                            <span class="toggle-switch"></span>
                            <span class="toggle-text">Secure</span>
                        </label>
                    </div>
                    <div class="form-toggle">
                        <input
                            id="cookie-httponly"
                            v-model="cookieHttpOnly"
                            type="checkbox"
                            class="toggle-input"
                            @change="updateValue"
                        />
                        <label for="cookie-httponly" class="toggle-label">
                            <span class="toggle-switch"></span>
                            <span class="toggle-text">HttpOnly</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <span v-if="error" class="form-error">{{ error }}</span>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AuthPlacementConfig } from '@/types'

// Props
interface Props {
    modelValue?: AuthPlacementConfig
    label?: string
    error?: string
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: () => ({ type: 'header', name: '' } as AuthPlacementConfig),
})

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: AuthPlacementConfig]
}>()

// Local state
const placementType = ref<AuthPlacementConfig['type']>('header')

// Header fields
const headerName = ref('')
const headerPrefix = ref('')
const headerSuffix = ref('')
const headerEncoding = ref<'base64' | 'url' | 'none'>('none')

// Query fields
const queryName = ref('')
const queryEncoding = ref<'url' | 'none'>('none')

// Form fields
const formName = ref('')
const formEncoding = ref<'url' | 'none'>('none')

// JSON fields
const jsonPath = ref('')
const jsonMerge = ref(true)

// Raw body fields
const rawContentType = ref('')
const rawEncoding = ref<'base64' | 'none'>('none')

// URL path fields
const pathTemplate = ref('')
const pathPlaceholder = ref('')

// Cookie fields
const cookieName = ref('')
const cookieDomain = ref('')
const cookiePath = ref('')
const cookieSecure = ref(false)
const cookieHttpOnly = ref(false)
const cookieSameSite = ref<'strict' | 'lax' | 'none' | ''>('')

// Initialize from modelValue
const initializeFromModel = () => {
    if (!props.modelValue) return

    placementType.value = props.modelValue.type

    switch (props.modelValue.type) {
        case 'header':
            headerName.value = props.modelValue.name || ''
            headerPrefix.value = props.modelValue.prefix || ''
            headerSuffix.value = props.modelValue.suffix || ''
            headerEncoding.value = props.modelValue.encoding || 'none'
            break
        case 'query':
            queryName.value = props.modelValue.name || ''
            queryEncoding.value = props.modelValue.encoding || 'none'
            break
        case 'body-form':
            formName.value = props.modelValue.name || ''
            formEncoding.value = props.modelValue.encoding || 'none'
            break
        case 'body-json':
            jsonPath.value = props.modelValue.path || ''
            jsonMerge.value = props.modelValue.merge !== false
            break
        case 'body-raw':
            rawContentType.value = props.modelValue.contentType || ''
            rawEncoding.value = props.modelValue.encoding || 'none'
            break
        case 'url-path':
            pathTemplate.value = props.modelValue.template || ''
            pathPlaceholder.value = props.modelValue.placeholder || ''
            break
        case 'cookie':
            cookieName.value = props.modelValue.name || ''
            cookieDomain.value = props.modelValue.options?.domain || ''
            cookiePath.value = props.modelValue.options?.path || ''
            cookieSecure.value = props.modelValue.options?.secure || false
            cookieHttpOnly.value = props.modelValue.options?.httpOnly || false
            cookieSameSite.value = props.modelValue.options?.sameSite || ''
            break
    }
}

// Watch for external changes
watch(() => props.modelValue, initializeFromModel, {
    immediate: true,
    deep: true,
})

// Methods
const onPlacementTypeChange = () => {
    // Reset all fields when type changes
    headerName.value = ''
    headerPrefix.value = ''
    headerSuffix.value = ''
    headerEncoding.value = 'none'

    queryName.value = ''
    queryEncoding.value = 'none'

    formName.value = ''
    formEncoding.value = 'none'

    jsonPath.value = ''
    jsonMerge.value = true

    rawContentType.value = ''
    rawEncoding.value = 'none'

    pathTemplate.value = ''
    pathPlaceholder.value = ''

    cookieName.value = ''
    cookieDomain.value = ''
    cookiePath.value = ''
    cookieSecure.value = false
    cookieHttpOnly.value = false
    cookieSameSite.value = ''

    updateValue()
}

const updateValue = () => {
    let newValue: AuthPlacementConfig

    switch (placementType.value) {
        case 'header':
            newValue = {
                type: 'header',
                name: headerName.value,
                prefix: headerPrefix.value || undefined,
                suffix: headerSuffix.value || undefined,
                encoding:
                    headerEncoding.value !== 'none'
                        ? headerEncoding.value
                        : undefined,
            }
            break
        case 'query':
            newValue = {
                type: 'query',
                name: queryName.value,
                encoding:
                    queryEncoding.value !== 'none'
                        ? queryEncoding.value
                        : undefined,
            }
            break
        case 'body-form':
            newValue = {
                type: 'body-form',
                name: formName.value,
                encoding:
                    formEncoding.value !== 'none'
                        ? formEncoding.value
                        : undefined,
            }
            break
        case 'body-json':
            newValue = {
                type: 'body-json',
                path: jsonPath.value,
                merge: jsonMerge.value,
            }
            break
        case 'body-raw':
            newValue = {
                type: 'body-raw',
                contentType: rawContentType.value || undefined,
                encoding:
                    rawEncoding.value !== 'none'
                        ? rawEncoding.value
                        : undefined,
            }
            break
        case 'url-path':
            newValue = {
                type: 'url-path',
                template: pathTemplate.value,
                placeholder: pathPlaceholder.value,
            }
            break
        case 'cookie':
            const options: any = {}
            if (cookieDomain.value) options.domain = cookieDomain.value
            if (cookiePath.value) options.path = cookiePath.value
            if (cookieSecure.value) options.secure = cookieSecure.value
            if (cookieHttpOnly.value) options.httpOnly = cookieHttpOnly.value
            if (cookieSameSite.value) options.sameSite = cookieSameSite.value

            newValue = {
                type: 'cookie',
                name: cookieName.value,
                options: Object.keys(options).length > 0 ? options : undefined,
            }
            break
        default:
            newValue = { type: 'header', name: '' }
    }

    emit('update:modelValue', newValue)
}
</script>

<style scoped>
.auth-placement {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
}

.placement-type-selector {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.placement-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--surface-section);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-border);
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.form-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

.form-input,
.form-select {
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
}

.form-input:focus,
.form-select:focus {
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

.cookie-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-lg);
}

.cookie-flags {
    display: flex;
    gap: var(--space-xl);
    flex-wrap: wrap;
}

@media (max-width: 768px) {
    .cookie-flags {
        flex-direction: column;
        gap: var(--space-lg);
    }
}
</style>
