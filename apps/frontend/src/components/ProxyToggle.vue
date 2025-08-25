<template>
  <div class="proxy-toggle">
    <div class="proxy-status">
      <span class="status-dot" :class="{ 'running': proxyRunning, 'stopped': !proxyRunning }"></span>
      <span class="status-text">{{ proxyRunning ? 'On' : 'Off' }}</span>
    </div>
    <button 
      class="toggle-btn" 
      :class="{ 'running': proxyRunning, 'loading': proxyLoading }"
      :disabled="proxyLoading"
      @click="toggleProxy"
      :title="proxyRunning ? 'Stop Proxy' : 'Start Proxy'"
    >
      <span v-if="proxyLoading" class="loading-spinner"></span>
      <Play v-else-if="!proxyRunning" :size="12" />
      <Square v-else :size="12" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Play, Square } from 'lucide-vue-next'
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

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 4px;
  background: var(--surface-card, #ffffff);
  color: var(--text-color-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover:not(:disabled) {
  background: var(--surface-hover, #f8f9fa);
  border-color: var(--primary-color, #3b82f6);
  color: var(--primary-color, #3b82f6);
}

.toggle-btn.running {
  color: #dc2626;
}

.toggle-btn.running:hover:not(:disabled) {
  border-color: #dc2626;
  color: #dc2626;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 1px solid transparent;
  border-top: 1px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
