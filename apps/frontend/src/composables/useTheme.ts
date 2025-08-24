import { ref, onMounted, watch, readonly, computed, onUnmounted } from 'vue'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'arachne-theme'

// Get current theme from document (already applied in main.ts)
function getCurrentTheme(): Theme {
  if (typeof document !== 'undefined') {
    return document.documentElement.hasAttribute('data-theme') ? 'dark' : 'light'
  }
  return 'light'
}

// Get system preference
function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// Get stored theme or system preference
function getStoredTheme(): Theme | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  }
  return null
}

// Apply theme to document
function applyTheme(newTheme: Theme) {
  if (typeof document !== 'undefined') {
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }
}

// Save theme to localStorage
function saveTheme(newTheme: Theme) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
  }
}

// Global reactive theme state - initialize with current theme from document
const theme = ref<Theme>(getCurrentTheme())

// Global system theme change listener cleanup function
let systemThemeCleanup: (() => void) | null = null

export function useTheme() {
  // Initialize theme on first use
  onMounted(() => {
    // Sync with current document state (already applied in main.ts)
    theme.value = getCurrentTheme()

    // Listen for system theme changes only if no theme is stored
    if (typeof window !== 'undefined' && window.matchMedia && !systemThemeCleanup) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if no theme is stored (user hasn't made a choice)
        if (!getStoredTheme()) {
          const newTheme = e.matches ? 'dark' : 'light'
          theme.value = newTheme
          applyTheme(newTheme)
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      
      // Store cleanup function globally to avoid duplicate listeners
      systemThemeCleanup = () => {
        mediaQuery.removeEventListener('change', handleChange)
        systemThemeCleanup = null
      }
    }
  })

  // Cleanup system theme listener when component unmounts
  onUnmounted(() => {
    if (systemThemeCleanup) {
      systemThemeCleanup()
    }
  })

  // Watch for theme changes and apply them
  watch(theme, (newTheme) => {
    applyTheme(newTheme)
    saveTheme(newTheme)
  })

  // Toggle between light and dark
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // Set specific theme
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
  }

  return {
    theme: readonly(theme),
    toggleTheme,
    setTheme,
    isDark: computed(() => theme.value === 'dark'),
    isLight: computed(() => theme.value === 'light')
  }
}
