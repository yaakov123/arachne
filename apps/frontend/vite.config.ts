import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue(), vueDevTools(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        proxy: {
            // Allow frontend to call backend via same-origin paths during dev
            '/health': {
                target: process.env.BACKEND_ORIGIN || process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8080',
                changeOrigin: true,
            },
            '/api': {
                target: process.env.BACKEND_ORIGIN || process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8080',
                changeOrigin: true,
            },
            '/ws': {
                target: process.env.BACKEND_ORIGIN || process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8080',
                ws: true,
                changeOrigin: true,
            },
        },
    },
})
