import { platform } from 'node:os'
import type { OSProvider } from './types.js'
import { DarwinOSProvider } from './providers/darwin.js'
import { Win32OSProvider } from './providers/win32.js'
import { LinuxOSProvider } from './providers/linux.js'

export class OSProviderFactory {
    private static instance: OSProvider | null = null

    /**
     * Create an OS provider for the current platform
     */
    static create(): OSProvider {
        if (!this.instance) {
            this.instance = this.createForPlatform(platform())
        }
        return this.instance
    }

    /**
     * Create an OS provider for a specific platform
     */
    static createForPlatform(platformName: string): OSProvider {
        switch (platformName) {
            case 'darwin':
                return new DarwinOSProvider()
            case 'win32':
                return new Win32OSProvider()
            case 'linux':
                return new LinuxOSProvider()
            default:
                // Default to Linux for unknown platforms
                console.warn(`[Arachne] Unknown platform '${platformName}', defaulting to Linux provider`)
                return new LinuxOSProvider()
        }
    }

    /**
     * Reset the singleton instance (useful for testing)
     */
    static reset(): void {
        this.instance = null
    }
}
