<template>
    <div class="proxy-toggle">
        <button
            class="power-button"
            :class="{
                on: proxyRunning,
                off: !proxyRunning,
                loading: proxyLoading,
            }"
            :title="proxyRunning ? 'Stop Proxy' : 'Start Proxy'"
            :disabled="proxyLoading"
            @click="toggleProxy"
        >
            <Power :size="16" class="power-icon" />
            <span v-if="proxyLoading" class="loading-spinner"></span>
        </button>
    </div>
</template>

<script setup lang="ts">
import { Power } from 'lucide-vue-next'
import { useProxy } from '@/composables/useProxy'

const { proxyLoading, proxyRunning, toggleProxy } = useProxy()
</script>

<style scoped>
.proxy-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
}

.power-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: transparent;
}

.power-button:hover {
    background-color: var(--surface-hover, #f8f9fa);
    transform: scale(1.05);
}

.power-button:active {
    transform: scale(0.95);
}

.power-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.power-button:disabled:hover {
    transform: none;
    background: transparent;
}

/* Power button states */
.power-button.on .power-icon {
    color: #10b981; /* Green when on */
}

.power-button.off .power-icon {
    color: #6b7280; /* Gray when off */
}

.power-button.on:hover .power-icon {
    color: #059669; /* Darker green on hover when on */
}

.power-button.off:hover .power-icon {
    color: #374151; /* Darker gray on hover when off */
}

.power-icon {
    transition: color 0.2s ease;
}

.loading-spinner {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top: 2px solid var(--text-color-secondary, #6b7280);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.power-button.loading .power-icon {
    opacity: 0.3;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
