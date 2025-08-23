<template>
  <button
    @click="toggleTheme"
    class="theme-toggle"
    :title="`Switch to ${isDark ? 'light' : 'dark'} theme`"
    :aria-label="`Switch to ${isDark ? 'light' : 'dark'} theme`"
  >
    <i 
      :class="isDark ? 'pi pi-sun' : 'pi pi-moon'"
      class="text-lg"
    ></i>
  </button>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { toggleTheme, isDark } = useTheme()
</script>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
  color: var(--text-color);
}

.theme-toggle:hover {
  background-color: var(--surface-hover);
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

.theme-toggle:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.theme-toggle:active {
  transform: scale(0.95);
}
</style>
