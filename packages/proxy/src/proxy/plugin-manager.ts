import type { 
    ConnectContext, 
    ProxyPlugin, 
    RequestContext,
    WebSocketUpgradeContext,
    WebSocketMessageContext,
    WebSocketCloseContext
} from '../plugins/types.js'

export class PluginManager {
    private plugins: ProxyPlugin[] = []

    constructor(plugins: ProxyPlugin[] = []) {
        this.plugins = [...plugins]
    }

    addPlugin(plugin: ProxyPlugin): void {
        this.plugins.push(plugin)
    }

    hasHook<K extends keyof ProxyPlugin>(hook: K): boolean {
        return this.plugins.some(p => typeof p[hook] === 'function')
    }

    async runHook<K extends keyof ProxyPlugin>(
        hook: K, 
        ctx: RequestContext | ConnectContext | WebSocketUpgradeContext | WebSocketMessageContext | WebSocketCloseContext
    ): Promise<void> {
        for (const plugin of this.plugins) {
            try {
                const fn = plugin[hook]
                if (typeof fn === 'function') {
                    await (fn as any).call(plugin, ctx)
                }
            } catch (e) {
                this.handlePluginError(e, ctx)
            }
        }
    }

    private handlePluginError(err: unknown, ctx: any): void {
        for (const plugin of this.plugins) {
            try {
                plugin.onError?.(err, ctx)
            } catch {
                // Swallow errors in error handlers to prevent infinite loops
            }
        }
    }
}
