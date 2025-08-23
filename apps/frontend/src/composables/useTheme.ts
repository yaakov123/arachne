import { ref, onMounted, watch, readonly, computed } from 'vue'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'arachne-theme'

// Reactive theme state
const theme = ref<Theme>('light')

// Get system preference
function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// Get stored theme or system preference
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    return stored || getSystemTheme()
  }
  return 'light'
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

export function useTheme() {
  // Initialize theme on first use
  onMounted(() => {
    const initialTheme = getInitialTheme()
    theme.value = initialTheme
    applyTheme(initialTheme)

    // Listen for system theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if no theme is stored (user hasn't made a choice)
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          const newTheme = e.matches ? 'dark' : 'light'
          theme.value = newTheme
          applyTheme(newTheme)
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      
      // Cleanup listener on unmount
      return () => {
        mediaQuery.removeEventListener('change', handleChange)
      }
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
