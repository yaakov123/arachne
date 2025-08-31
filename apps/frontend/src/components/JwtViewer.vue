<template>
    <div class="jwt-viewer" ref="viewerRef">
        <!-- Clickable token that triggers popover -->
        <div class="jwt-token-trigger" @click="togglePopover">
            <span class="jwt-token-preview">{{ tokenPreview }}</span>
            <span class="jwt-expand-hint">🔍</span>
        </div>

        <!-- Popover overlay -->
        <div
            v-if="showPopover"
            class="jwt-popover-overlay"
            @click="closePopover"
        >
            <div class="jwt-popover" @click.stop>
                <div class="jwt-header">
                    <span class="jwt-title">Decoded JWT</span>
                    <button
                        @click="closePopover"
                        class="jwt-collapse-btn"
                        title="Close"
                    >
                        ×
                    </button>
                </div>

                <div v-if="decodedJWT" class="jwt-content">
                    <!-- Header Section -->
                    <div class="jwt-section">
                        <h4 class="jwt-section-title">Header</h4>
                        <div class="jwt-json">
                            <pre>{{
                                JSON.stringify(decodedJWT.header, null, 2)
                            }}</pre>
                        </div>
                    </div>

                    <!-- Payload Section -->
                    <div class="jwt-section">
                        <h4 class="jwt-section-title">Payload</h4>
                        <div class="jwt-json">
                            <pre>{{
                                JSON.stringify(decodedJWT.payload, null, 2)
                            }}</pre>
                        </div>

                        <!-- Common JWT claims with special formatting -->
                        <div v-if="hasCommonClaims" class="jwt-claims">
                            <h5 class="jwt-claims-title">Common Claims</h5>
                            <div class="jwt-claims-list">
                                <div
                                    v-if="decodedJWT.payload.iss"
                                    class="jwt-claim"
                                >
                                    <span class="jwt-claim-key"
                                        >Issuer (iss):</span
                                    >
                                    <span class="jwt-claim-value">{{
                                        decodedJWT.payload.iss
                                    }}</span>
                                </div>
                                <div
                                    v-if="decodedJWT.payload.sub"
                                    class="jwt-claim"
                                >
                                    <span class="jwt-claim-key"
                                        >Subject (sub):</span
                                    >
                                    <span class="jwt-claim-value">{{
                                        decodedJWT.payload.sub
                                    }}</span>
                                </div>
                                <div
                                    v-if="decodedJWT.payload.aud"
                                    class="jwt-claim"
                                >
                                    <span class="jwt-claim-key"
                                        >Audience (aud):</span
                                    >
                                    <span class="jwt-claim-value">{{
                                        formatAudience(decodedJWT.payload.aud)
                                    }}</span>
                                </div>
                                <div
                                    v-if="decodedJWT.payload.exp"
                                    class="jwt-claim"
                                >
                                    <span class="jwt-claim-key"
                                        >Expires (exp):</span
                                    >
                                    <span
                                        class="jwt-claim-value"
                                        :class="{
                                            'jwt-expired': isTokenExpired,
                                        }"
                                    >
                                        {{
                                            formatUnixTimestamp(
                                                decodedJWT.payload.exp
                                            )
                                        }}
                                        <span
                                            v-if="isTokenExpired"
                                            class="jwt-expired-label"
                                            >(EXPIRED)</span
                                        >
                                    </span>
                                </div>
                                <div
                                    v-if="decodedJWT.payload.iat"
                                    class="jwt-claim"
                                >
                                    <span class="jwt-claim-key"
                                        >Issued At (iat):</span
                                    >
                                    <span class="jwt-claim-value">{{
                                        formatUnixTimestamp(
                                            decodedJWT.payload.iat
                                        )
                                    }}</span>
                                </div>
                                <div
                                    v-if="decodedJWT.payload.nbf"
                                    class="jwt-claim"
                                >
                                    <span class="jwt-claim-key"
                                        >Not Before (nbf):</span
                                    >
                                    <span class="jwt-claim-value">{{
                                        formatUnixTimestamp(
                                            decodedJWT.payload.nbf
                                        )
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Signature Section -->
                    <div class="jwt-section">
                        <h4 class="jwt-section-title">Signature</h4>
                        <div class="jwt-signature">
                            <code>{{ decodedJWT.signature }}</code>
                        </div>
                    </div>
                </div>

                <!-- Error state -->
                <div v-else class="jwt-error">
                    <p>Failed to decode JWT. Showing original value:</p>
                    <div class="jwt-original-value">{{ token }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
    decodeJWT,
    formatUnixTimestamp,
    isExpired,
    type DecodedJWT,
} from '../utils/jwt'

interface Props {
    token: string
}

const props = defineProps<Props>()

const showPopover = ref(false)
const decodedJWT = ref<DecodedJWT | null>(null)
const viewerRef = ref<HTMLElement | null>(null)

const tokenPreview = computed(() => {
    const maxLength = 50
    if (props.token.length <= maxLength) {
        return props.token
    }
    return props.token.substring(0, maxLength) + '...'
})

const hasCommonClaims = computed(() => {
    if (!decodedJWT.value) return false
    const payload = decodedJWT.value.payload
    return !!(
        payload.iss ||
        payload.sub ||
        payload.aud ||
        payload.exp ||
        payload.iat ||
        payload.nbf
    )
})

const isTokenExpired = computed(() => {
    if (!decodedJWT.value?.payload.exp) return false
    return isExpired(decodedJWT.value.payload.exp)
})

const togglePopover = () => {
    showPopover.value = !showPopover.value

    // Decode JWT when opening popover for the first time
    if (showPopover.value && !decodedJWT.value) {
        decodedJWT.value = decodeJWT(props.token)
    }
}

const closePopover = () => {
    showPopover.value = false
}

const formatAudience = (aud: string | string[]): string => {
    if (Array.isArray(aud)) {
        return aud.join(', ')
    }
    return aud
}

// Try to decode on mount to validate the token
onMounted(() => {
    // We don't decode immediately to avoid performance issues with many JWTs
    // Only decode when user clicks to expand
})
</script>

<style scoped>
.jwt-viewer {
    position: relative;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--text-xs);
}

.jwt-token-trigger {
    cursor: pointer;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    border: 1px solid var(--surface-border);
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    max-width: 100%;
}

.jwt-token-trigger:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
}

.jwt-popover-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
}

.jwt-popover {
    background: var(--surface-card);
    border-radius: var(--radius-xl);
    border: 1px solid var(--surface-border);
    box-shadow: var(--shadow-xl);
    max-width: 90vw;
    max-height: 90vh;
    overflow: auto;
    min-width: 600px;
}

.jwt-token-preview {
    color: var(--text-color-secondary);
    word-break: break-all;
    flex: 1;
}

.jwt-expand-hint {
    color: var(--text-color-muted);
    font-size: var(--text-sm);
    white-space: nowrap;
}

.jwt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-lg) var(--space-xl);
    border-bottom: 1px solid var(--surface-border);
    background: var(--surface-section);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.jwt-title {
    font-weight: var(--font-semibold);
    color: var(--text-color);
}

.jwt-collapse-btn {
    background: none;
    border: none;
    font-size: var(--text-xl);
    cursor: pointer;
    color: var(--text-color-muted);
    padding: var(--space-xs);
    width: var(--space-2xl);
    height: var(--space-2xl);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
}

.jwt-collapse-btn:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.jwt-content {
    padding: var(--space-xl);
}

.jwt-section {
    margin-bottom: var(--space-xl);
}

.jwt-section:last-child {
    margin-bottom: 0;
}

.jwt-section-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-color);
    margin: 0 0 var(--space-md) 0;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--surface-border);
}

.jwt-json {
    background: var(--surface-section);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    overflow-x: auto;
    border: 1px solid var(--surface-border);
}

.jwt-json pre {
    margin: 0;
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.jwt-claims {
    margin-top: var(--space-lg);
}

.jwt-claims-title {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color-muted);
    margin: 0 0 var(--space-md) 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.jwt-claims-list {
    display: grid;
    gap: var(--space-sm);
}

.jwt-claim {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-lg);
    align-items: start;
    padding: var(--space-md);
    background: var(--surface-section);
    border-radius: var(--radius-md);
    border: 1px solid var(--surface-border);
}

.jwt-claim-key {
    font-weight: var(--font-semibold);
    color: var(--text-color);
    white-space: nowrap;
    font-size: var(--text-sm);
}

.jwt-claim-value {
    color: var(--text-color-secondary);
    word-break: break-all;
    font-size: var(--text-sm);
}

.jwt-claim-value.jwt-expired {
    color: var(--color-error-600);
}

.jwt-expired-label {
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    margin-left: var(--space-sm);
    color: var(--color-error-700);
}

.jwt-signature {
    background: var(--surface-section);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    overflow-x: auto;
    border: 1px solid var(--surface-border);
}

.jwt-signature code {
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
    word-break: break-all;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.jwt-error {
    padding: var(--space-xl);
    text-align: center;
}

.jwt-error p {
    color: var(--color-error-600);
    margin: 0 0 var(--space-lg) 0;
    font-size: var(--text-base);
}

.jwt-original-value {
    background: var(--surface-section);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    color: var(--text-color-secondary);
    word-break: break-all;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    border: 1px solid var(--surface-border);
}

/* Responsive design */
@media (max-width: 768px) {
    .jwt-popover {
        min-width: 0;
        margin: var(--space-md);
        max-width: calc(100vw - var(--space-xl));
    }

    .jwt-header {
        padding: var(--space-md) var(--space-lg);
    }

    .jwt-content {
        padding: var(--space-lg);
    }

    .jwt-claim {
        grid-template-columns: 1fr;
        gap: var(--space-sm);
    }

    .jwt-claim-key {
        font-size: var(--text-xs);
        color: var(--text-color-muted);
    }
}
</style>
