import { OSProviderFactory } from './factory.js'
import type { Platform } from './types.js'

export { OSProviderFactory } from './factory.js'
export type { OSProvider, ProcessInfo, Platform } from './types.js'

// Convenience functions for backward compatibility
export async function enableSystemProxy(host: string, port: number): Promise<void> {
    const provider = OSProviderFactory.create()
    return provider.enableSystemProxy(host, port)
}

export async function disableSystemProxy(): Promise<void> {
    const provider = OSProviderFactory.create()
    return provider.disableSystemProxy()
}

export async function getTrustInstructions(certPath: string): Promise<{
    trustCommand: string
    untrustCommands: string[]
}> {
    const provider = OSProviderFactory.create()
    return provider.getTrustInstructions(certPath)
}

export function platform(): Platform {
    const provider = OSProviderFactory.create()
    return provider.getPlatform()
}
