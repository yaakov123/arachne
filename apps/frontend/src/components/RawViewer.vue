<template>
    <div class="raw-viewer">
        <div class="raw-content" v-html="coloredContent"></div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FullTransaction } from '@arachne/database'

interface Props {
    transaction?: FullTransaction
}

const props = defineProps<Props>()

const rawContent = computed(() => {
    if (props.transaction) {
        // Show both request and response
        return (
            formatRequest(props.transaction) +
            '\n\n' +
            formatResponse(props.transaction)
        )
    }
    return 'No data available'
})

const coloredContent = computed(() => {
    const content = rawContent.value
    if (content === 'No data available') {
        return `<span class="no-data">${content}</span>`
    }

    return colorizeHttpContent(content)
})

const formatRequest = (transaction: FullTransaction): string => {
    const lines: string[] = []

    // Request line
    const url =
        transaction.urlPath +
        (transaction.urlQuery ? `?${transaction.urlQuery}` : '')
    lines.push(`${transaction.method} ${url} HTTP/1.1`)

    // Host header (should be first)
    lines.push(
        `Host: ${transaction.urlHost}${
            transaction.urlPort ? `:${transaction.urlPort}` : ''
        }`
    )

    // Other headers
    transaction.requestHeaders
        .filter((h) => h.name.toLowerCase() !== 'host')
        .forEach((header) => {
            lines.push(`${header.name}: ${header.value}`)
        })

    // Empty line before body
    lines.push('')

    // Body (if present)
    if (transaction.requestBody?.sample) {
        if (transaction.requestBody.encoding === 'base64') {
            lines.push('[Binary content - base64 encoded]')
            lines.push(transaction.requestBody.sample)
        } else {
            lines.push(transaction.requestBody.sample)
        }
    }

    return lines.join('\n')
}

const formatResponse = (transaction: FullTransaction): string => {
    const lines: string[] = []

    // Status line
    const statusMessage =
        transaction.statusMessage ||
        getDefaultStatusMessage(transaction.statusCode)
    lines.push(`HTTP/1.1 ${transaction.statusCode} ${statusMessage}`)

    // Headers
    transaction.responseHeaders.forEach((header) => {
        lines.push(`${header.name}: ${header.value}`)
    })

    // Empty line before body
    lines.push('')

    // Body (if present)
    if (transaction.responseBody?.sample) {
        if (transaction.responseBody.encoding === 'base64') {
            lines.push('[Binary content - base64 encoded]')
            lines.push(transaction.responseBody.sample)
        } else {
            lines.push(transaction.responseBody.sample)
        }
    }

    return lines.join('\n')
}

const getDefaultStatusMessage = (statusCode: number | null): string => {
    if (!statusCode) return 'Unknown'
    const statusMessages: Record<number, string> = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        301: 'Moved Permanently',
        302: 'Found',
        304: 'Not Modified',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
    }
    return statusMessages[statusCode] || 'Unknown'
}

const colorizeHttpContent = (content: string): string => {
    const lines = content.split('\n')
    const coloredLines: string[] = []

    let inRequestBody = false
    let inResponseBody = false
    let isFirstLine = true

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Empty line - usually separates headers from body
        if (line.trim() === '') {
            if (i > 0 && !inRequestBody && !inResponseBody) {
                // Next non-empty line will be body
                const nextNonEmptyIndex = lines.findIndex(
                    (l, idx) => idx > i && l.trim() !== ''
                )
                if (nextNonEmptyIndex !== -1) {
                    if (lines[0].startsWith('HTTP/')) {
                        inResponseBody = true
                    } else {
                        inRequestBody = true
                    }
                }
            }
            coloredLines.push('')
            continue
        }

        // Request line (GET /path HTTP/1.1)
        if (isFirstLine && line.match(/^[A-Z]+ .+ HTTP\/\d\.\d$/)) {
            const parts = line.split(' ')
            const method = `<span class="http-method">${parts[0]}</span>`
            const url = `<span class="http-url">${parts
                .slice(1, -1)
                .join(' ')}</span>`
            const version = `<span class="http-version">${
                parts[parts.length - 1]
            }</span>`
            coloredLines.push(`${method} ${url} ${version}`)
            isFirstLine = false
            continue
        }

        // Response status line (HTTP/1.1 200 OK)
        if (isFirstLine && line.match(/^HTTP\/\d\.\d \d{3}/)) {
            const parts = line.split(' ')
            const version = `<span class="http-version">${parts[0]}</span>`
            const statusCode = parseInt(parts[1])
            const statusClass = getStatusClass(statusCode)
            const status = `<span class="http-status ${statusClass}">${parts[1]}</span>`
            const message = `<span class="http-status-message">${parts
                .slice(2)
                .join(' ')}</span>`
            coloredLines.push(`${version} ${status} ${message}`)
            isFirstLine = false
            continue
        }

        // Headers (Name: Value)
        if (!inRequestBody && !inResponseBody && line.includes(':')) {
            const colonIndex = line.indexOf(':')
            const headerName = line.substring(0, colonIndex)
            const headerValue = line.substring(colonIndex + 1)
            const nameClass = getHeaderClass(headerName.toLowerCase())
            coloredLines.push(
                `<span class="http-header-name ${nameClass}">${escapeHtml(
                    headerName
                )}</span><span class="http-colon">:</span><span class="http-header-value">${escapeHtml(
                    headerValue
                )}</span>`
            )
            continue
        }

        // Body content
        if (inRequestBody || inResponseBody) {
            // Check if it's a binary content indicator
            if (line.startsWith('[Binary content')) {
                coloredLines.push(
                    `<span class="http-binary-indicator">${escapeHtml(
                        line
                    )}</span>`
                )
            } else {
                // Try to detect and colorize JSON
                const trimmedLine = line.trim()
                if (
                    (trimmedLine.startsWith('{') ||
                        trimmedLine.startsWith('[')) &&
                    (trimmedLine.endsWith('}') || trimmedLine.endsWith(']'))
                ) {
                    try {
                        JSON.parse(line)
                        coloredLines.push(
                            `<span class="http-body-json">${escapeHtml(
                                line
                            )}</span>`
                        )
                    } catch {
                        coloredLines.push(
                            `<span class="http-body">${escapeHtml(line)}</span>`
                        )
                    }
                } else {
                    coloredLines.push(
                        `<span class="http-body">${escapeHtml(line)}</span>`
                    )
                }
            }
            continue
        }

        // Default case
        coloredLines.push(escapeHtml(line))
        isFirstLine = false
    }

    return coloredLines.join('\n')
}

const getStatusClass = (statusCode: number): string => {
    if (statusCode >= 200 && statusCode < 300) return 'status-success'
    if (statusCode >= 300 && statusCode < 400) return 'status-redirect'
    if (statusCode >= 400 && statusCode < 500) return 'status-client-error'
    if (statusCode >= 500) return 'status-server-error'
    return 'status-info'
}

const getHeaderClass = (headerName: string): string => {
    if (headerName === 'host') return 'header-host'
    if (headerName.includes('content-')) return 'header-content'
    if (
        headerName.includes('auth') ||
        headerName === 'cookie' ||
        headerName === 'set-cookie'
    )
        return 'header-auth'
    if (
        headerName.includes('cache') ||
        headerName.includes('etag') ||
        headerName.includes('expires')
    )
        return 'header-cache'
    return 'header-standard'
}

const escapeHtml = (text: string): string => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}
</script>

<style scoped>
.raw-viewer {
    height: 100%;
    overflow: auto;
    background: var(--surface-ground);
}

.raw-content {
    margin: 0;
    padding: var(--space-md);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--text-color);
    background: transparent;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-wrap: break-word;
}

/* HTTP Method styling */
:deep(.http-method) {
    color: #0052a3;
    font-weight: bold;
}

/* HTTP URL styling */
:deep(.http-url) {
    color: #006600;
}

/* HTTP Version styling */
:deep(.http-version) {
    color: #4a4a4a;
    font-weight: normal;
}

/* HTTP Status Code styling */
:deep(.http-status) {
    font-weight: bold;
}

:deep(.http-status.status-success) {
    color: #16a34a; /* Darker green for 2xx */
}

:deep(.http-status.status-redirect) {
    color: #d97706; /* Darker orange for 3xx */
}

:deep(.http-status.status-client-error) {
    color: #dc2626; /* Darker red for 4xx */
}

:deep(.http-status.status-server-error) {
    color: #b91c1c; /* Even darker red for 5xx */
}

:deep(.http-status.status-info) {
    color: #2563eb; /* Darker blue for 1xx */
}

/* HTTP Status Message styling */
:deep(.http-status-message) {
    color: var(--text-color-secondary);
}

/* Header Name styling */
:deep(.http-header-name) {
    color: #7c2d92; /* Darker purple for header names */
    font-weight: 500;
}

:deep(.http-header-name.header-host) {
    color: #0052a3; /* Darker blue for Host header */
}

:deep(.http-header-name.header-content) {
    color: #047857; /* Darker teal for Content-* headers */
}

:deep(.http-header-name.header-auth) {
    color: #b91c1c; /* Darker red for auth/cookie headers */
}

:deep(.http-header-name.header-cache) {
    color: #6b21a8; /* Darker purple for cache headers */
}

/* Header colon styling */
:deep(.http-colon) {
    color: var(--text-color-secondary);
}

/* Header Value styling */
:deep(.http-header-value) {
    color: var(--text-color);
}

/* Body content styling */
:deep(.http-body) {
    color: var(--text-color);
}

:deep(.http-body-json) {
    color: #0369a1; /* Darker cyan for JSON content */
}

:deep(.http-binary-indicator) {
    color: #d97706; /* Darker orange for binary indicators */
    font-style: italic;
}

/* No data message */
:deep(.no-data) {
    color: var(--text-color-secondary);
    font-style: italic;
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
    :deep(.http-method) {
        color: #3b82f6; /* Vibrant blue for dark theme */
    }

    :deep(.http-url) {
        color: #22c55e; /* Vibrant green for dark theme */
    }

    :deep(.http-version) {
        color: #6b7280; /* Medium gray for dark theme */
    }

    :deep(.http-status.status-success) {
        color: #22c55e; /* Vibrant green for 2xx in dark */
    }

    :deep(.http-status.status-redirect) {
        color: #f59e0b; /* Vibrant orange for 3xx in dark */
    }

    :deep(.http-status.status-client-error) {
        color: #ef4444; /* Vibrant red for 4xx in dark */
    }

    :deep(.http-status.status-server-error) {
        color: #dc2626; /* Strong red for 5xx in dark */
    }

    :deep(.http-status.status-info) {
        color: #3b82f6; /* Vibrant blue for 1xx in dark */
    }

    :deep(.http-header-name) {
        color: #8b5cf6; /* Vibrant purple for dark theme */
    }

    :deep(.http-header-name.header-host) {
        color: #3b82f6; /* Vibrant blue for dark theme */
    }

    :deep(.http-header-name.header-content) {
        color: #059669; /* Vibrant teal for dark theme */
    }

    :deep(.http-header-name.header-auth) {
        color: #ef4444; /* Vibrant red for auth headers in dark */
    }

    :deep(.http-header-name.header-cache) {
        color: #7c3aed; /* Vibrant purple for cache headers in dark */
    }

    :deep(.http-body-json) {
        color: #06b6d4; /* Vibrant cyan for dark theme */
    }

    :deep(.http-binary-indicator) {
        color: #f59e0b; /* Vibrant orange for binary indicators in dark */
    }
}
</style>
