import { BaseOSProvider } from './base.js'
import type { ProcessInfo, TrustResult } from '../types.js'

export class Win32OSProvider extends BaseOSProvider {
    protected platformName = 'win32' as const

    async enableSystemProxy(_host: string, _port: number): Promise<void> {
        console.warn('[Arachne] System proxy not supported on Windows yet')
    }

    async disableSystemProxy(): Promise<void> {
        console.warn('[Arachne] System proxy not supported on Windows yet')
    }

    async installRootCATrust(_certPath: string): Promise<TrustResult> {
        return {
            ok: false,
            message:
                'Windows trust installation not implemented yet. Please import the CA into Trusted Root Certification Authorities manually.',
        }
    }

    async uninstallRootCATrust(): Promise<TrustResult> {
        return {
            ok: false,
            message:
                'Windows trust removal not implemented. Please remove the CA from the Trusted Root Certification Authorities store manually.',
        }
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
