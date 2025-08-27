export interface ProxyRuntimeConfig {
    /**
     * List of host patterns to ignore during proxy processing.
     * These hosts will be tunneled directly without interception.
     * Supports wildcards (e.g., "*.example.com")
     */
    hostFilter: string[]

    /**
     * Maximum body size in bytes for request/response buffering.
     * Bodies larger than this will not be buffered for plugins.
     */
    maxBodySize: number

    /**
     * Host filter mode - determines how hostFilter is interpreted.
     * - 'blacklist': ignore hosts in the hostFilter list
     * - 'whitelist': only process hosts in the hostFilter list
     */
    hostFilterMode: 'blacklist' | 'whitelist'
}

/**
 * Reactive configuration store that manages proxy runtime configuration.
 * Components hold references to this store and automatically receive updates
 * when configuration changes.
 */
export class ProxyConfigStore {
    private config: ProxyRuntimeConfig

    constructor(initialConfig: ProxyRuntimeConfig) {
        this.config = { ...initialConfig }
    }

    /**
     * Get the current configuration (read-only).
     */
    get current(): Readonly<ProxyRuntimeConfig> {
        return this.config
    }

    /**
     * Update the configuration with new values.
     * Only notifies listeners if the configuration actually changes.
     */
    update(newConfig: Partial<ProxyRuntimeConfig>): void {
        this.config = { ...this.config, ...newConfig }
    }
}
