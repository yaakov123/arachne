import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Define monorepo projects. Each folder under packages/ is treated as a project.
        // Project-level configs (if present) will be picked up automatically.
        projects: ['packages/*'],

        // Root-level reporters apply to all projects. Keep default unless you need more.
        reporters: 'default',
    },
})
