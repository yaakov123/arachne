import './assets/main.css'
import './assets/design-system.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useProjectStore } from './stores/project'

// Initialize theme immediately to prevent FOUC
function initializeTheme() {
    const THEME_STORAGE_KEY = 'arachne-theme'

    // Get system preference
    function getSystemTheme() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
        }
        return 'light'
    }

    // Get stored theme or system preference
    function getInitialTheme() {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(THEME_STORAGE_KEY)
            return stored || getSystemTheme()
        }
        return 'light'
    }

    // Apply theme to document
    function applyTheme(theme: string) {
        if (typeof document !== 'undefined') {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark')
            } else {
                document.documentElement.removeAttribute('data-theme')
            }
        }
    }

    const initialTheme = getInitialTheme()
    applyTheme(initialTheme)
}

// Initialize theme before creating the app
initializeTheme()

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Initialize project store before mounting the app
async function initializeApp() {
    try {
        const projectStore = useProjectStore()
        await projectStore.initialize()
        console.log('Project store initialized successfully')

        // Mount the app after project store is initialized
        app.mount('#app')
    } catch (error) {
        console.error('Failed to initialize project store:', error)
        // Mount the app anyway, even if project initialization fails
        app.mount('#app')
    }
}

// Initialize app with project store first
initializeApp()
