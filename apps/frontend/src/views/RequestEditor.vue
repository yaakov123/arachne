<template>
    <div class="request-editor-view">
        <div class="editor-header">
            <h1>Request Editor</h1>
            <p v-if="!isEditingTransaction">
                Create and send HTTP requests to test APIs
            </p>
            <p v-else>
                Editing request from transaction:
                {{ loadedTransaction?.method }} {{ loadedTransaction?.urlPath }}
            </p>
        </div>

        <div class="editor-content">
            <div class="request-section">
                <div class="request-line">
                    <select v-model="httpMethod" class="method-select">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                        <option value="HEAD">HEAD</option>
                        <option value="OPTIONS">OPTIONS</option>
                    </select>

                    <input
                        v-model="requestUrl"
                        type="text"
                        placeholder="Enter request URL..."
                        class="url-input"
                    />

                    <button
                        @click="sendRequest"
                        class="send-button"
                        :disabled="!requestUrl || isLoading"
                    >
                        <Send v-if="!isLoading" :size="16" />
                        <div v-else class="loading-spinner"></div>
                        {{ isLoading ? 'Sending...' : 'Send' }}
                    </button>
                </div>

                <div class="request-details">
                    <TabContainer
                        :tabs="requestTabs"
                        :default-tab="activeRequestTab"
                        @tab-changed="activeRequestTab = $event"
                    >
                        <!-- Headers Tab -->
                        <template #headers>
                            <div class="headers-section">
                                <div class="headers-list">
                                    <div
                                        v-for="(
                                            header, index
                                        ) in requestHeaders"
                                        :key="`header-${index}`"
                                        class="header-row"
                                    >
                                        <input
                                            v-model="header.name"
                                            type="text"
                                            placeholder="Header name"
                                            class="header-input header-name"
                                        />
                                        <input
                                            v-model="header.value"
                                            type="text"
                                            placeholder="Header value"
                                            class="header-input header-value"
                                        />
                                        <button
                                            @click="removeHeader(index)"
                                            class="remove-button"
                                            :disabled="
                                                requestHeaders.length === 1
                                            "
                                            title="Remove header"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                                <button @click="addHeader" class="add-button">
                                    + Add Header
                                </button>
                            </div>
                        </template>

                        <!-- Body Tab -->
                        <template #body>
                            <div class="body-section">
                                <div class="body-controls">
                                    <select
                                        v-model="bodyType"
                                        class="body-type-select"
                                        @change="formatRequestBody"
                                    >
                                        <option value="json">JSON</option>
                                        <option value="text">Text</option>
                                        <option value="form">Form Data</option>
                                        <option value="xml">XML</option>
                                    </select>
                                    <button
                                        @click="formatRequestBody"
                                        class="format-button"
                                        :disabled="!requestBody"
                                        title="Format content"
                                    >
                                        Format
                                    </button>
                                </div>
                                <div class="body-editor">
                                    <MonacoEditor
                                        ref="bodyEditor"
                                        v-model:content="requestBody"
                                        :language="editorLanguage"
                                        :read-only="false"
                                        :minimap="false"
                                        :line-numbers="true"
                                        :word-wrap="'on'"
                                        :font-size="13"
                                    />
                                </div>
                            </div>
                        </template>

                        <!-- Query Params Tab -->
                        <template #params>
                            <div class="params-section">
                                <div class="params-list">
                                    <div
                                        v-for="(param, index) in queryParams"
                                        :key="`param-${index}`"
                                        class="param-row"
                                    >
                                        <input
                                            v-model="param.name"
                                            type="text"
                                            placeholder="Parameter name"
                                            class="param-input param-name"
                                        />
                                        <input
                                            v-model="param.value"
                                            type="text"
                                            placeholder="Parameter value"
                                            class="param-input param-value"
                                        />
                                        <button
                                            @click="removeParam(index)"
                                            class="remove-button"
                                            :disabled="queryParams.length === 1"
                                            title="Remove parameter"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                                <button @click="addParam" class="add-button">
                                    + Add Parameter
                                </button>
                            </div>
                        </template>
                    </TabContainer>
                </div>
            </div>

            <div v-if="response" class="response-section">
                <div class="response-header">
                    <h3>Response</h3>
                    <div class="response-meta">
                        <span
                            class="status-code"
                            :class="getStatusClass(response.status)"
                        >
                            {{ response.status }} {{ response.statusText }}
                        </span>
                        <span class="response-time">{{ response.time }}ms</span>
                    </div>
                </div>

                <TabContainer
                    :tabs="responseTabs"
                    :default-tab="activeResponseTab"
                    @tab-changed="activeResponseTab = $event"
                >
                    <!-- Response Body Tab -->
                    <template #body>
                        <div class="response-body">
                            <pre class="response-content">{{
                                response.body
                            }}</pre>
                        </div>
                    </template>

                    <!-- Response Headers Tab -->
                    <template #headers>
                        <div class="response-headers">
                            <div
                                v-if="
                                    response.headers &&
                                    response.headers.length > 0
                                "
                                class="headers-display"
                            >
                                <div
                                    v-for="(header, index) in response.headers"
                                    :key="`response-header-${index}`"
                                    class="header-display-row"
                                >
                                    <span class="header-name"
                                        >{{ header.name }}:</span
                                    >
                                    <span class="header-value">{{
                                        header.value
                                    }}</span>
                                </div>
                            </div>
                            <p v-else class="section-placeholder">
                                No response headers
                            </p>
                        </div>
                    </template>
                </TabContainer>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Send } from 'lucide-vue-next'
import TabContainer, { type Tab } from '@/components/TabContainer.vue'
import MonacoEditor from '@/components/MonacoEditor.vue'
import { trpc } from '@/services/trpc'
import type { FullTransaction } from '@arachne/database'

// Dependencies
const route = useRoute()

// Request state
const httpMethod = ref('GET')
const requestUrl = ref('')
const isLoading = ref(false)
const loadedTransaction = ref<FullTransaction | null>(null)

// Editable request data
const requestHeaders = ref<Array<{ name: string; value: string }>>([
    { name: '', value: '' },
])
const requestBody = ref('')
const bodyType = ref('json')
const queryParams = ref<Array<{ name: string; value: string }>>([
    { name: '', value: '' },
])

// Tab state
const activeRequestTab = ref('headers')
const activeResponseTab = ref('body')

// Editor references
const bodyEditor = ref<InstanceType<typeof MonacoEditor>>()

// Response state
const response = ref<{
    status: number
    statusText: string
    time: number
    body: string
    headers: Array<{ name: string; value: string }>
} | null>(null)

// Tab definitions
const requestTabs: Tab[] = [
    { id: 'headers', label: 'Headers' },
    { id: 'body', label: 'Body' },
    { id: 'params', label: 'Query Params' },
]

const responseTabs: Tab[] = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers' },
]

// Methods for editing headers and parameters
const addHeader = () => {
    requestHeaders.value.push({ name: '', value: '' })
}

const removeHeader = (index: number) => {
    if (requestHeaders.value.length > 1) {
        requestHeaders.value.splice(index, 1)
    }
}

const addParam = () => {
    queryParams.value.push({ name: '', value: '' })
}

const removeParam = (index: number) => {
    if (queryParams.value.length > 1) {
        queryParams.value.splice(index, 1)
    }
}

// Methods
const sendRequest = async () => {
    if (!requestUrl.value) return

    isLoading.value = true

    try {
        // Build the request with edited data
        const filteredHeaders = requestHeaders.value.filter(
            (h) => h.name.trim() && h.value.trim()
        )
        const filteredParams = queryParams.value.filter(
            (p) => p.name.trim() && p.value.trim()
        )

        // Build URL with query parameters
        let finalUrl = requestUrl.value
        if (filteredParams.length > 0) {
            const urlObj = new URL(finalUrl)
            filteredParams.forEach((param) => {
                urlObj.searchParams.set(param.name, param.value)
            })
            finalUrl = urlObj.toString()
        }

        console.log('Sending request:', {
            method: httpMethod.value,
            url: finalUrl,
            headers: filteredHeaders,
            body: requestBody.value || undefined,
        })

        // Send the actual HTTP request through the backend
        const result = await trpc.requests.send.mutate({
            method: httpMethod.value as
                | 'GET'
                | 'POST'
                | 'PUT'
                | 'PATCH'
                | 'DELETE'
                | 'HEAD'
                | 'OPTIONS',
            url: finalUrl,
            headers: filteredHeaders,
            body: requestBody.value || undefined,
            queryParams: filteredParams,
        })

        response.value = {
            status: result.status,
            statusText: result.statusText,
            time: result.time,
            body: result.body,
            headers: result.headers,
        }
    } catch (error) {
        console.error('Request failed:', error)
        response.value = {
            status: 500,
            statusText: 'Internal Server Error',
            time: 0,
            body: 'Request failed',
            headers: [],
        }
    } finally {
        isLoading.value = false
    }
}

const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return 'status-success'
    if (status >= 300 && status < 400) return 'status-redirect'
    if (status >= 400 && status < 500) return 'status-client-error'
    if (status >= 500) return 'status-server-error'
    return ''
}

// Load transaction data when transactionId is provided
const loadTransactionData = async (transactionId: string) => {
    try {
        const result = await trpc.transactions.getFullTransaction.query({
            id: transactionId,
        })

        if (result.transaction) {
            loadedTransaction.value = result.transaction

            // Populate the form with transaction data
            httpMethod.value = result.transaction.method
            requestUrl.value = result.transaction.urlFull

            // Populate headers
            if (
                result.transaction.requestHeaders &&
                result.transaction.requestHeaders.length > 0
            ) {
                requestHeaders.value = result.transaction.requestHeaders.map(
                    (header) => ({
                        name: header.name,
                        value: header.value,
                    })
                )
            } else {
                requestHeaders.value = [{ name: '', value: '' }]
            }

            // Populate request body
            if (result.transaction.requestBody) {
                requestBody.value = result.transaction.requestBody.sample || ''
                // Try to detect body type from content type
                const contentType = result.transaction.requestHeaders
                    ?.find((h) => h.name.toLowerCase() === 'content-type')
                    ?.value.toLowerCase()
                if (contentType?.includes('application/json')) {
                    bodyType.value = 'json'
                } else if (
                    contentType?.includes('application/xml') ||
                    contentType?.includes('text/xml')
                ) {
                    bodyType.value = 'xml'
                } else if (
                    contentType?.includes('application/x-www-form-urlencoded')
                ) {
                    bodyType.value = 'form'
                } else {
                    bodyType.value = 'text'
                }
            } else {
                requestBody.value = ''
                bodyType.value = 'json'
            }

            // Populate query parameters
            if (result.transaction.urlQuery) {
                const urlParams = new URLSearchParams(
                    result.transaction.urlQuery
                )
                queryParams.value = Array.from(urlParams.entries()).map(
                    ([name, value]) => ({
                        name,
                        value,
                    })
                )
                if (queryParams.value.length === 0) {
                    queryParams.value = [{ name: '', value: '' }]
                }
            } else {
                queryParams.value = [{ name: '', value: '' }]
            }
        }
    } catch (error) {
        console.error('Failed to load transaction:', error)
    }
}

// Watch for transactionId in route query
watch(
    () => route.query.transactionId,
    (transactionId) => {
        if (transactionId && typeof transactionId === 'string') {
            loadTransactionData(transactionId)
        }
    },
    { immediate: true }
)

// Computed property to check if we're editing a loaded transaction
const isEditingTransaction = computed(() => !!loadedTransaction.value)

// Computed property for Monaco Editor language based on body type
const editorLanguage = computed(() => {
    switch (bodyType.value) {
        case 'json':
            return 'json'
        case 'xml':
            return 'xml'
        case 'form':
            return 'plaintext'
        case 'text':
        default:
            return 'plaintext'
    }
})

// Auto-format the request body based on type
const formatRequestBody = () => {
    if (!requestBody.value) return

    try {
        switch (bodyType.value) {
            case 'json':
                const jsonObj = JSON.parse(requestBody.value)
                requestBody.value = JSON.stringify(jsonObj, null, 2)
                break
            case 'xml':
                // Basic XML formatting - could be enhanced with a proper XML formatter
                requestBody.value = requestBody.value
                    .replace(/></g, '>\n<')
                    .replace(/^\s*\n/gm, '')
                break
            // For form and text, we keep as-is
        }
    } catch (error) {
        console.warn('Failed to format body:', error)
    }
}
</script>

<style scoped>
.request-editor-view {
    width: 100%;
    height: 100vh;
    background: var(--surface-ground);
    display: flex;
    flex-direction: column;
}

.editor-header {
    padding: var(--space-lg);
    background: var(--surface-card);
    border-bottom: 1px solid var(--surface-border);
}

.editor-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
}

.editor-header p {
    font-size: 1rem;
    color: var(--text-color-secondary);
    margin: 0;
}

.editor-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-lg);
    gap: var(--space-lg);
    overflow: hidden;
}

.request-section {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.request-line {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--surface-50);
    border-bottom: 1px solid var(--surface-border);
}

.method-select {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    font-weight: 600;
    min-width: 100px;
    cursor: pointer;
}

.method-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.url-input {
    flex: 1;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
}

.url-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.url-input::placeholder {
    color: var(--text-color-secondary);
}

.send-button {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-lg);
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 100px;
    justify-content: center;
}

.send-button:hover:not(:disabled) {
    background: var(--primary-600);
    transform: translateY(-1px);
}

.send-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
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

.request-details {
    flex: 1;
}

.request-details :deep(.tab-container) {
    height: 400px;
}

.request-details :deep(.tab-content) {
    padding: var(--space-md);
}

.response-section {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    flex: 1;
}

.response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    background: var(--surface-50);
    border-bottom: 1px solid var(--surface-border);
}

.response-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
}

.response-meta {
    display: flex;
    align-items: center;
    gap: var(--space-md);
}

.status-code {
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 600;
}

.status-success {
    background: var(--color-green-100);
    color: var(--color-green-800);
}

.status-redirect {
    background: var(--color-blue-100);
    color: var(--color-blue-800);
}

.status-client-error,
.status-server-error {
    background: var(--color-red-100);
    color: var(--color-red-800);
}

.response-time {
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
}

.response-section :deep(.tab-container) {
    height: calc(100% - 60px);
}

.response-section :deep(.tab-content) {
    padding: 0;
    height: calc(100% - 48px);
    overflow-y: auto;
}

.response-body,
.response-headers {
    height: 100%;
    padding: var(--space-md);
}

.response-content {
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--text-color);
    white-space: pre-wrap;
    word-wrap: break-word;
    margin: 0;
    overflow-x: auto;
}

.section-placeholder {
    color: var(--text-color-secondary);
    font-style: italic;
    text-align: center;
    padding: var(--space-lg);
    margin: 0;
}

/* Response headers display */
.headers-display {
    padding: var(--space-md);
}

.header-display-row {
    display: flex;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--surface-border);
}

.header-display-row:last-child {
    border-bottom: none;
}

.header-name {
    font-weight: 600;
    color: var(--text-color);
    min-width: 150px;
    margin-right: var(--space-md);
    flex-shrink: 0;
}

.header-value {
    color: var(--text-color-secondary);
    word-break: break-all;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-sm);
}

/* Editable sections styles */
.headers-section,
.params-section {
    padding: var(--space-md);
}

.headers-list,
.params-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
}

.header-row,
.param-row {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
    gap: var(--space-sm);
    align-items: center;
}

.header-input,
.param-input {
    padding: var(--space-sm);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
}

.header-input:focus,
.param-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.header-input::placeholder,
.param-input::placeholder {
    color: var(--text-color-secondary);
}

.remove-button {
    background: var(--color-red-100);
    color: var(--color-red-700);
    border: 1px solid var(--color-red-200);
    border-radius: var(--radius-md);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: var(--text-lg);
    font-weight: bold;
    transition: all var(--transition-fast);
}

.remove-button:hover:not(:disabled) {
    background: var(--color-red-200);
    color: var(--color-red-800);
}

.remove-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.add-button {
    background: var(--color-green-100);
    color: var(--color-green-700);
    border: 1px solid var(--color-green-200);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    align-self: flex-start;
}

.add-button:hover {
    background: var(--color-green-200);
    color: var(--color-green-800);
}

/* Body section styles */
.body-section {
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    height: 100%;
}

.body-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.format-button {
    background: var(--color-blue-100);
    color: var(--color-blue-700);
    border: 1px solid var(--color-blue-200);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.format-button:hover:not(:disabled) {
    background: var(--color-blue-200);
    color: var(--color-blue-800);
}

.format-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.body-editor {
    flex: 1;
    min-height: 200px;
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.body-type-select {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    color: var(--text-color);
    font-size: var(--text-sm);
    cursor: pointer;
}

.body-type-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--primary-color) 20%, transparent);
}

/* Body type specific styling - now handled by Monaco Editor themes */

/* Dark theme adjustments */
[data-theme='dark'] .status-success {
    background: var(--color-green-900);
    color: var(--color-green-200);
}

[data-theme='dark'] .status-redirect {
    background: var(--color-blue-900);
    color: var(--color-blue-200);
}

[data-theme='dark'] .status-client-error,
[data-theme='dark'] .status-server-error {
    background: var(--color-red-900);
    color: var(--color-red-200);
}

[data-theme='dark'] .remove-button {
    background: var(--color-red-900);
    color: var(--color-red-200);
    border-color: var(--color-red-700);
}

[data-theme='dark'] .remove-button:hover:not(:disabled) {
    background: var(--color-red-800);
    color: var(--color-red-100);
}

[data-theme='dark'] .add-button {
    background: var(--color-green-900);
    color: var(--color-green-200);
    border-color: var(--color-green-700);
}

[data-theme='dark'] .add-button:hover {
    background: var(--color-green-800);
    color: var(--color-green-100);
}

/* Body type colors are now handled by Monaco Editor syntax highlighting */

[data-theme='dark'] .format-button {
    background: var(--color-blue-900);
    color: var(--color-blue-200);
    border-color: var(--color-blue-700);
}

[data-theme='dark'] .format-button:hover:not(:disabled) {
    background: var(--color-blue-800);
    color: var(--color-blue-100);
}
</style>
