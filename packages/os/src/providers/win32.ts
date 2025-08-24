import { BaseOSProvider } from './base.js'
import type { ProcessInfo } from '../types.js'

export class Win32OSProvider extends BaseOSProvider {
    protected platformName = 'win32' as const

    async enableSystemProxy(_host: string, _port: number): Promise<void> {
        console.warn('[Arachne] System proxy not supported on Windows yet')
    }

    async disableSystemProxy(): Promise<void> {
        console.warn('[Arachne] System proxy not supported on Windows yet')
    }


    async getTrustInstructions(certPath: string): Promise<{ trustCommand: string; untrustCommands: string[] }> {
        return {
            trustCommand: this.getWin32InstallInstructions(certPath),
            untrustCommands: [],
        }
    }

    private getWin32InstallInstructions(certPath: string): string {
        return `certutil -addstore "TrustedPublisher" "${certPath}"`
    }

    async getProcessForConnection(
        _localPort: number,
        _remoteHost: string,
        _remotePort: number
    ): Promise<ProcessInfo | null> {
        // Future implementation using netstat, wmic, or PowerShell
        throw new Error('Process tracking not implemented yet for Windows')
    }
}
