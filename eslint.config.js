import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default [
    js.configs.recommended,
    ...vue.configs['flat/recommended'],
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            globals: {
                Buffer: 'readonly',
                console: 'readonly',
                process: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                NodeJS: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            'no-empty': 'off',
            'no-useless-escape': 'off',
        },
    },
    // Vue Single File Components
    {
        files: ['**/*.vue'],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                // Use TS parser for <script lang="ts">
                parser: tsparser,
                ecmaVersion: 'latest',
                sourceType: 'module',
                extraFileExtensions: ['.vue'],
            },
        },
        rules: {
            'no-empty': 'off',
        },
    },
    // Frontend (browser) files: allow DOM globals
    {
        files: ['apps/frontend/**/*.{ts,tsx,js,jsx,vue}'],
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                WebSocket: 'readonly',
                Event: 'readonly',
                MessageEvent: 'readonly',
                location: 'readonly',
            },
        },
    },
    {
        ignores: ['node_modules/', 'dist/', '.turbo/', './apps/frontend/**'],
    },
]
