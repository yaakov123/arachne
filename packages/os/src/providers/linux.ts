import { BaseOSProvider } from './base.js'
import type { ProcessInfo, TrustResult } from '../types.js'

export class LinuxOSProvider extends BaseOSProvider {
    protected platformName = 'linux' as const

    async enableSystemProxy(_host: string, _port: number): Promise<void> {
        console.warn('[Arachne] System proxy not supported on Linux yet')
    }

    async disableSystemProxy(): Promise<void> {
        console.warn('[Arachne] System proxy not supported on Linux yet')
    }

    async installRootCATrust(certPath: string): Promise<TrustResult> {
        return {
            ok: false,
            message: this.getLinuxInstallInstructions(certPath),
        }
    }

    async uninstallRootCATrust(): Promise<TrustResult> {
        return {
            ok: false,
            message: [
                'Linux trust removal is distro-dependent. Try one of the following:',
                '- Debian/Ubuntu: remove /usr/local/share/ca-certificates/arachne-proxy.crt then run: sudo update-ca-certificates --fresh',
                '- RHEL/CentOS/Fedora: remove /etc/pki/ca-trust/source/anchors/arachne-proxy.pem then run: sudo update-ca-trust',
                'Then restart your browser.',
            ].join('\n'),
        }
    }

    async getProcessForConnection(
        _localPort: number,
        _remoteHost: string,
        _remotePort: number
    ): Promise<ProcessInfo | null> {
        // Future implementation using netstat, ss, or /proc filesystem
        throw new Error('Process tracking not implemented yet for Linux')
    }

    private getLinuxInstallInstructions(certPath: string): string {
        return [
            'Linux trust installation is distro-dependent. Try one of the following:',
            `- Debian/Ubuntu: sudo cp "${certPath}" /usr/local/share/ca-certificates/arachne-proxy.crt && sudo update-ca-certificates`,
            `- RHEL/CentOS/Fedora: sudo cp "${certPath}" /etc/pki/ca-trust/source/anchors/arachne-proxy.pem && sudo update-ca-trust`,
            'Then restart your browser.',
        ].join('\n')
    }
}
