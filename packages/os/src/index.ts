import { OSProviderFactory } from './factory.js'
import type { TrustResult, Platform } from './types.js'

export { OSProviderFactory } from './factory.js'
export type { OSProvider, ProcessInfo, TrustResult, Platform } from './types.js'

// Convenience functions for backward compatibility
export async function enableSystemProxy(host: string, port: number): Promise<void> {
    const provider = OSProviderFactory.create()
    return provider.enableSystemProxy(host, port)
}

export async function disableSystemProxy(): Promise<void> {
    const provider = OSProviderFactory.create()
    return provider.disableSystemProxy()
}

export async function installRootCATrust(store?: { caCertPath(): string }): Promise<TrustResult> {
    const provider = OSProviderFactory.create()
    // For backward compatibility, we need to handle the CertStore parameter
    const certPath = store?.caCertPath() || ''
    return provider.installRootCATrust(certPath)
}

export async function uninstallRootCATrust(): Promise<TrustResult> {
    const provider = OSProviderFactory.create()
    return provider.uninstallRootCATrust()
}

export function platform(): Platform {
    const provider = OSProviderFactory.create()
    return provider.getPlatform()
}
