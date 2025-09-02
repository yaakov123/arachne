import type { ProxyRuntimeConfig } from '@arachne/proxy'
import type { ProjectSettings } from '@arachne/database'

const baseConfig: ProxyRuntimeConfig = {
    hostFilter: [],
    hostFilterMode: 'whitelist',
    maxBodySize: 1024 * 1024,
}

/**
 * Builds a ProxyRuntimeConfig for a project, merging baseConfig and ProjectSettings
 */
export function buildProjectConfiguration(
    settings: ProjectSettings | null
): ProxyRuntimeConfig {
    return {
        hostFilter: [...baseConfig.hostFilter, ...(settings?.hostFilter || [])],
        hostFilterMode: settings?.hostFilterMode || baseConfig.hostFilterMode,
        maxBodySize: settings?.maxBodySize || baseConfig.maxBodySize,
    }
}

/**
 * Checks if two ProxyRuntimeConfig objects are different.
 */
export function hasConfigurationChanged(
    currentConfig: ProxyRuntimeConfig,
    newConfig: ProxyRuntimeConfig
): boolean {
    return JSON.stringify(currentConfig) !== JSON.stringify(newConfig)
}
