<template>
  <button
    @click="toggleTheme"
    class="toggle-switch"
    :class="{ dark: isDark }"
    :title="`Switch to ${isDark ? 'light' : 'dark'} theme`"
    :aria-label="`Switch to ${isDark ? 'light' : 'dark'} theme`"
  >
    <div class="toggle-track">
      <div class="icon-container left">
        <Sun :size="14" />
      </div>
      <div class="icon-container right">
        <Moon :size="14" />
      </div>
      <div class="toggle-slider"></div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import { Sun, Moon } from 'lucide-vue-next'

const { toggleTheme, isDark } = useTheme()
</script>

<style scoped>
.toggle-switch {
  position: relative;
  width: 60px;
  height: 32px;
  background-color: var(--surface-border, #e5e7eb);
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  padding: 0;
}

.toggle-switch:hover {
  background-color: var(--color-neutral-300, #d1d5db);
}

.toggle-switch.dark {
  background-color: var(--primary-color, #3b82f6);
}

.toggle-switch.dark:hover {
  background-color: var(--primary-color-dark, #2563eb);
}

.toggle-track {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
}

.icon-container {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--text-color-secondary, #6b7280);
  transition: all 0.2s ease;
  z-index: 1;
}

.icon-container.left {
  left: 2px;
}

.icon-container.right {
  right: 2px;
}

.toggle-switch.dark .icon-container.left {
  color: rgba(255, 255, 255, 0.6);
}

.toggle-switch.dark .icon-container.right {
  color: white;
}

.toggle-switch:not(.dark) .icon-container.left {
  color: var(--primary-color, #3b82f6);
}

.toggle-switch:not(.dark) .icon-container.right {
  color: var(--text-color-secondary, #6b7280);
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 28px;
  height: 28px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
  z-index: 2;
}

.toggle-switch.dark .toggle-slider {
  transform: translateX(28px);
}

.toggle-switch:focus {
  outline: 2px solid var(--primary-color, #3b82f6);
  outline-offset: 2px;
}
</style>
