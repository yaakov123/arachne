import type {
    ProxyPlugin,
    HookContextMap,
    ErrorContext,
    BeforeRequestContext,
    AfterRequestContext,
    BeforeResponseContext,
    AfterResponseContext,
    ConnectContext,
} from '../plugins/types'
import type { RequestBuilder, ResponseBuilder } from '../plugins/builders'

/**
 * Manages plugin lifecycle and hook execution for the new simplified API
 */
export class PluginManager {
    private plugins: ProxyPlugin[] = []

    constructor(plugins: ProxyPlugin[] = []) {
        for (const plugin of plugins) {
            this.addPlugin(plugin)
        }
    }

    /**
     * Add a plugin to the manager
     */
    addPlugin(plugin: ProxyPlugin): void {
        // Validate plugin before adding
        if (!plugin.name || typeof plugin.name !== 'string') {
            throw new Error('Plugin must have a valid name')
        }

        // Check for duplicate plugin names
        if (this.plugins.some((p) => p.name === plugin.name)) {
            throw new Error(`Plugin with name '${plugin.name}' already exists`)
        }

        this.plugins.push(plugin)
    }

    /**
     * Remove a plugin by name
     */
    removePlugin(name: string): boolean {
        const index = this.plugins.findIndex((p) => p.name === name)
        if (index >= 0) {
            this.plugins.splice(index, 1)
            return true
        }
        return false
    }

    /**
     * Get all registered plugins
     */
    getPlugins(): readonly ProxyPlugin[] {
        return Object.freeze([...this.plugins])
    }

    /**
     * Check if any plugin has a specific hook
     */
    hasHook<K extends keyof HookContextMap>(hook: K): boolean {
        return this.plugins.some((plugin) => typeof plugin[hook] === 'function')
    }

    /**
     * Check if any plugin has response hooks (for determining if buffering is needed)
     */
    hasResponseHooks(): boolean {
        return this.hasHook('beforeResponse') || this.hasHook('afterResponse')
    }

    /**
     * Execute beforeRequest hooks and return the final request builder
     */
    async executeBeforeRequest(
        ctx: BeforeRequestContext
    ): Promise<RequestBuilder> {
        for (const plugin of this.plugins) {
            if (typeof plugin.beforeRequest === 'function') {
                try {
                    await plugin.beforeRequest(ctx)
                } catch (error) {
                    this.handlePluginError(
                        error,
                        ctx,
                        plugin.name,
                        'beforeRequest'
                    )
                }
            }
        }
        return ctx.request
    }

    /**
     * Execute afterRequest hooks
     */
    async executeAfterRequest(ctx: AfterRequestContext): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.afterRequest === 'function') {
                try {
                    await plugin.afterRequest(ctx)
                } catch (error) {
                    this.handlePluginError(
                        error,
                        ctx,
                        plugin.name,
                        'afterRequest'
                    )
                }
            }
        }
    }

    /**
     * Execute beforeResponse hooks and return the final response builder
     */
    async executeBeforeResponse(
        ctx: BeforeResponseContext
    ): Promise<ResponseBuilder> {
        for (const plugin of this.plugins) {
            if (typeof plugin.beforeResponse === 'function') {
                try {
                    await plugin.beforeResponse(ctx)
                } catch (error) {
                    this.handlePluginError(
                        error,
                        ctx,
                        plugin.name,
                        'beforeResponse'
                    )
                }
            }
        }
        return ctx.response
    }

    /**
     * Execute afterResponse hooks
     */
    async executeAfterResponse(ctx: AfterResponseContext): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.afterResponse === 'function') {
                try {
                    await plugin.afterResponse(ctx)
                } catch (error) {
                    this.handlePluginError(
                        error,
                        ctx,
                        plugin.name,
                        'afterResponse'
                    )
                }
            }
        }
    }

    /**
     * Execute onConnect hooks
     */
    async executeOnConnect(ctx: ConnectContext): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.onConnect === 'function') {
                try {
                    await plugin.onConnect(ctx)
                } catch (error) {
                    this.handlePluginError(error, ctx, plugin.name, 'onConnect')
                }
            }
        }
    }

    /**
     * Execute error hooks
     */
    executeOnError(err: unknown, ctx: ErrorContext): void {
        for (const plugin of this.plugins) {
            if (typeof plugin.onError === 'function') {
                try {
                    plugin.onError(err, ctx)
                } catch (error) {
                    // Don't call handlePluginError here to avoid infinite recursion
                    console.error(
                        `Error in plugin '${plugin.name}' onError hook:`,
                        error
                    )
                }
            }
        }
    }

    /**
     * Handle plugin errors by calling error hooks on other plugins
     */
    private handlePluginError(
        error: unknown,
        ctx: ErrorContext,
        pluginName: string,
        hookName: string
    ): void {
        const errorMessage =
            error instanceof Error ? error.message : String(error)
        console.error(
            `Error in plugin '${pluginName}' ${hookName} hook:`,
            errorMessage
        )

        // Call error hooks on other plugins (excluding the one that failed)
        for (const plugin of this.plugins) {
            if (
                plugin.name !== pluginName &&
                typeof plugin.onError === 'function'
            ) {
                try {
                    plugin.onError(error, {
                        ...ctx,
                        pluginName,
                        hookName,
                        originalError: error,
                    })
                } catch (errorHookError) {
                    console.error(
                        `Error in plugin '${plugin.name}' onError hook:`,
                        errorHookError
                    )
                }
            }
        }
    }

    /**
     * Legacy method for backward compatibility - will be removed
     * @deprecated Use specific execute methods instead
     */
    async runHook<K extends keyof HookContextMap>(
        hook: K,
        ctx: HookContextMap[K]
    ): Promise<void> {
        console.warn(
            `Legacy runHook method called with '${hook}' - this method is deprecated`
        )

        switch (hook) {
            case 'onConnect':
                await this.executeOnConnect(ctx as ConnectContext)
                break
            default:
                console.warn(
                    `Legacy hook '${hook}' is not supported in new API`
                )
        }
    }
}
