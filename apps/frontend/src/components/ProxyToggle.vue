<template>
    <div class="proxy-toggle">
        <div class="proxy-status">
            <span
                class="status-dot"
                :class="{ running: proxyRunning, stopped: !proxyRunning }"
            ></span>
            <span class="status-text">{{ proxyRunning ? 'On' : 'Off' }}</span>
        </div>
        <label
            class="switch"
            :title="proxyRunning ? 'Stop Proxy' : 'Start Proxy'"
        >
            <input
                type="checkbox"
                :checked="proxyRunning"
                :disabled="proxyLoading"
                @change="toggleProxy"
                class="switch-input"
            />
            <span class="switch-slider" :class="{ loading: proxyLoading }">
                <span v-if="proxyLoading" class="loading-spinner"></span>
            </span>
        </label>
    </div>
</template>

<script setup lang="ts">
import { useProxy } from '@/composables/useProxy'

const { proxyLoading, proxyRunning, toggleProxy } = useProxy()
</script>

<style scoped>
.proxy-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
}

.proxy-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: background-color 0.2s ease;
}

.status-dot.running {
    background-color: #10b981;
}

.status-dot.stopped {
    background-color: #6b7280;
}

.status-text {
    font-weight: 500;
    color: var(--text-color-secondary, #6b7280);
    min-width: 20px;
}

.switch {
    position: relative;
    display: inline-block;
    width: 2.25rem;
    height: 1.25rem;
    cursor: pointer;
}

.switch-input {
    opacity: 0;
    width: 0;
    height: 0;
}

.switch-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--surface-border, #e5e7eb);
    border-radius: 1.25rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.switch-slider:before {
    position: absolute;
    content: '';
    height: 0.875rem;
    width: 0.875rem;
    left: 0.1875rem;
    background-color: var(--surface-card, #ffffff);
    border-radius: 50%;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.switch-input:checked + .switch-slider {
    background-color: #10b981;
}

.switch-input:checked + .switch-slider:before {
    transform: translateX(1rem);
}

.switch-input:disabled + .switch-slider {
    opacity: 0.6;
    cursor: not-allowed;
}

.switch:hover .switch-input:not(:disabled) + .switch-slider {
    background-color: var(--surface-hover, #f3f4f6);
}

.switch:hover .switch-input:checked:not(:disabled) + .switch-slider {
    background-color: #059669;
}

.loading-spinner {
    width: 10px;
    height: 10px;
    border: 1px solid transparent;
    border-top: 1px solid #6b7280;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    position: absolute;
    z-index: 10;
}

.switch-slider.loading:before {
    opacity: 0.3;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
