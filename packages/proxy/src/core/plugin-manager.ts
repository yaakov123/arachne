import type { 
    ProxyPlugin, 
    HookContextMap, 
    ErrorContext 
} from '../plugins/types'

export class PluginManager {
    private plugins: ProxyPlugin[] = []

    constructor(plugins: ProxyPlugin[] = []) {
        for (const plugin of plugins) {
            this.addPlugin(plugin)
        }
    }

    addPlugin(plugin: ProxyPlugin): void {
        // Validate plugin before adding
        if (!plugin.name || typeof plugin.name !== 'string') {
            throw new Error('Plugin must have a non-empty string name')
        }
        
        // Check for duplicate plugin names
        if (this.plugins.some(p => p.name === plugin.name)) {
            throw new Error(`Plugin with name '${plugin.name}' is already registered`)
        }
        
        this.plugins.push(plugin)
    }

    hasHook<K extends keyof HookContextMap>(hook: K): boolean {
        return this.plugins.some(p => typeof p[hook] === 'function')
    }

    /** Get all registered plugin names */
    getPluginNames(): string[] {
        return this.plugins.map(p => p.name)
    }

    /** Remove a plugin by name */
    removePlugin(name: string): boolean {
        const index = this.plugins.findIndex(p => p.name === name)
        if (index >= 0) {
            this.plugins.splice(index, 1)
            return true
        }
        return false
    }

    /** Get plugin count */
    getPluginCount(): number {
        return this.plugins.length
    }

    /** Run error hooks for all plugins */
    runErrorHooks(err: unknown, ctx: ErrorContext): void {
        for (const plugin of this.plugins) {
            try {
                plugin.onError?.(err, ctx)
            } catch {
                // Swallow errors in error handlers to prevent infinite loops
            }
        }
    }

    async runHook<K extends keyof HookContextMap>(hook: K, ctx: HookContextMap[K]): Promise<void> {
        for (const plugin of this.plugins) {
            try {
                const fn = plugin[hook] as ((ctx: HookContextMap[K]) => void | Promise<void>) | undefined
                if (typeof fn === 'function') {
                    await fn.call(plugin, ctx)
                }
            } catch (e) {
                this.handlePluginError(e, ctx)
            }
        }
    }

    private handlePluginError(err: unknown, ctx: ErrorContext): void {
        for (const plugin of this.plugins) {
            try {
                plugin.onError?.(err, ctx)
            } catch {
                // Swallow errors in error handlers to prevent infinite loops
            }
        }
    }
}
