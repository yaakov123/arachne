import type { ProjectMetadata } from '@arachne/api-types'
import type { ProxyRuntimeConfig } from '@arachne/proxy'

const baseConfig: ProxyRuntimeConfig = {
    hostFilter: [],
    hostFilterMode: 'whitelist',
    maxBodySize: 1024 * 1024,
}

/**
 * Builds a ProxyRuntimeConfig for a project, merging baseConfig and projectMetadata.
 */
export function buildProjectConfiguration(
    projectMetadata?: ProjectMetadata
): ProxyRuntimeConfig {
    const settings = projectMetadata?.settings

    return {
        hostFilter: [...baseConfig.hostFilter, ...(settings?.hostFilter || [])],
        hostFilterMode: baseConfig.hostFilterMode,
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
