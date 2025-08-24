import { platform } from 'node:os'
import type { OSProvider, ProcessInfo, Platform } from '../types.js'

export abstract class BaseOSProvider implements OSProvider {
    protected abstract platformName: Platform

    // System proxy methods (to be implemented by each platform)
    abstract enableSystemProxy(host: string, port: number): Promise<void>
    abstract disableSystemProxy(): Promise<void>


    abstract getTrustInstructions(certPath: string): Promise<{
        trustCommand: string
        untrustCommands: string[]
    }>

    // Network process tracking (to be implemented by each platform)
    abstract getProcessForConnection(
        localPort: number,
        remoteHost: string,
        remotePort: number
    ): Promise<ProcessInfo | null>

    // Common implementations
    isSupported(): boolean {
        return this.platformName === platform()
    }

    getPlatform(): Platform {
        const p = platform() as Platform
        if (p === 'darwin' || p === 'win32' || p === 'linux') return p
        return 'linux'
    }
}
