import { BaseOSProvider } from './base.js'
import type { ProcessInfo, TrustResult } from '../types.js'
import { run } from '../utils/process.js'
import { spawn } from 'node:child_process'

interface ProxyState {
    service: string
    web: { enabled: boolean; server?: string; port?: number }
    secure: { enabled: boolean; server?: string; port?: number }
}

export class DarwinOSProvider extends BaseOSProvider {
    protected platformName = 'darwin' as const

    private previousState: ProxyState | null = null
    private activeService: string | null = null

    // Allow tests/CI to disable any system proxy modifications
    private readonly DISABLE_SYSTEM_PROXY =
        process.env.ARACHNE_DISABLE_SYSTEM_PROXY === '1'

    async enableSystemProxy(host: string, port: number): Promise<void> {
        if (this.DISABLE_SYSTEM_PROXY) {
            console.warn(
                '[Arachne] System proxy disabled by ARACHNE_DISABLE_SYSTEM_PROXY'
            )
            return
        }

        const service = await this.getDefaultService()
        if (!service) {
            console.warn(
                '[Arachne] No macOS network service found to enable proxy.'
            )
            return
        }

        try {
            // Capture current state once
            if (!this.previousState) {
                this.previousState = {
                    service,
                    web: await this.getWebProxy(service),
                    secure: await this.getSecureWebProxy(service),
                }
            }

            // Configure proxies
            await run('networksetup', [
                '-setwebproxy',
                service,
                host,
                String(port),
            ])
            await run('networksetup', [
                '-setsecurewebproxy',
                service,
                host,
                String(port),
            ])
            await run('networksetup', ['-setwebproxystate', service, 'on'])
            await run('networksetup', [
                '-setsecurewebproxystate',
                service,
                'on',
            ])

            this.activeService = service
            console.log(
                `[Arachne] Enabled system proxy on ${service}: ${host}:${port}`
            )
        } catch (e) {
            console.warn('[Arachne] Failed to enable system proxy:', e)
        }
    }

    async disableSystemProxy(): Promise<void> {
        if (this.DISABLE_SYSTEM_PROXY) {
            console.warn(
                '[Arachne] System proxy disabled by ARACHNE_DISABLE_SYSTEM_PROXY'
            )
            return
        }

        const service = this.activeService || (await this.getDefaultService())
        if (!service) {
            console.warn(
                '[Arachne] No macOS network service found to disable proxy.'
            )
            return
        }

        try {
            // Best-effort: turn off if we don't know previous state
            await run('networksetup', ['-setwebproxystate', service, 'off'])
            await run('networksetup', [
                '-setsecurewebproxystate',
                service,
                'off',
            ])
        } catch (e) {
            console.warn('[Arachne] Failed to disable/restore system proxy:', e)
        } finally {
            this.previousState = null
            this.activeService = null
            console.log(`[Arachne] System proxy restored on ${service}`)
        }
    }

    async installRootCATrust(certPath: string): Promise<TrustResult> {
        // Check if certificate already exists in System keychain
        if (await this.isCertificateInSystemKeychain()) {
            return {
                ok: true,
                message: 'CA certificate is already trusted in System keychain.',
            }
        }

        // Add trusted root to System keychain (requires admin privileges)
        const args = [
            'add-trusted-cert',
            '-d',
            '-r',
            'trustRoot',
            '-k',
            '/Library/Keychains/System.keychain',
            certPath,
        ]

        // Try elevating with osascript to show system password dialog
        const elevated = await this.runSecurityWithOsascript(args)

        // Verify success by checking if certificate now exists in keychain
        // This is more reliable than relying on exit codes, as some operations
        // may succeed but return non-zero exit codes due to trust setting issues
        if (await this.isCertificateInSystemKeychain()) {
            return {
                ok: true,
                message: 'Successfully installed CA into System keychain.',
            }
        }

        // If certificate still doesn't exist, the operation truly failed
        return {
            ok: false,
            message: `Failed to add trusted cert to System keychain. ${
                elevated.message || 'Unknown error'
            }\n\nYou can try manually:\n  sudo security ${args
                .map(this.escapeArg)
                .join(' ')}`,
            code: elevated.code,
        }
    }

    async uninstallRootCATrust(): Promise<TrustResult> {
        // Find all matching certs by common name in the System keychain and delete them.
        const list = await this.runSecurity([
            'find-certificate',
            '-a',
            '-Z',
            '-c',
            'Arachne Proxy Root CA',
            '/Library/Keychains/System.keychain',
        ])
        if (!list.ok) return list

        const hashes = list.message
            .split('\n')
            .map((l) => l.match(/SHA-1 hash: ([A-F0-9]+)/)?.[1])
            .filter((h): h is string => !!h)

        if (hashes.length === 0) {
            return {
                ok: true,
                message:
                    'No matching Arachne Root CA found in System keychain.',
            }
        }

        for (const h of hashes) {
            const elevated = await this.runSecurityWithOsascript([
                'delete-certificate',
                '-Z',
                h,
                '/Library/Keychains/System.keychain',
            ])
            if (!elevated.ok) return elevated
        }

        return {
            ok: true,
            message: `Removed ${hashes.length} certificate(s) from System keychain.`,
        }
    }

    async getProcessForConnection(
        _localPort: number,
        _remoteHost: string,
        _remotePort: number
    ): Promise<ProcessInfo | null> {
        // Future implementation using lsof, netstat, or dtrace
        throw new Error('Process tracking not implemented yet for macOS')
    }

    private async listServices(): Promise<string[]> {
        const r = await run('networksetup', ['-listallnetworkservices'])
        if (!r.ok) return []
        const lines = r.out.split(/\r?\n/)
        // First line is a note about asterisks denoting disabled services
        return lines
            .slice(1)
            .map((s) => s.trim())
            .filter((s) => s && !s.startsWith('*'))
    }

    private async getDefaultService(): Promise<string | null> {
        const envSvc =
            process.env.ARACHNE_PROXY_NETWORK_SERVICE ||
            process.env.ARACHNE_NETWORK_SERVICE
        const services = await this.listServices()
        if (envSvc && services.includes(envSvc)) return envSvc
        if (services.includes('Wi-Fi')) return 'Wi-Fi'
        if (services.includes('Ethernet')) return 'Ethernet'
        return services[0] || null
    }

    private parseGetProxy(out: string): {
        enabled: boolean
        server?: string
        port?: number
    } {
        const res: { enabled: boolean; server?: string; port?: number } = {
            enabled: false,
        }
        for (const line of out.split(/\r?\n/)) {
            const [kRaw, vRaw] = line.split(':')
            if (!kRaw || typeof vRaw === 'undefined') continue
            const k = kRaw.trim().toLowerCase()
            const v = vRaw.trim()
            if (k === 'enabled') res.enabled = /^yes$/i.test(v) || v === '1'
            else if (k === 'server') res.server = v || undefined
            else if (k === 'port') {
                const n = parseInt(v, 10)
                if (!Number.isNaN(n)) res.port = n
            }
        }
        return res
    }

    private async getWebProxy(service: string) {
        const r = await run('networksetup', ['-getwebproxy', service])
        return r.ok ? this.parseGetProxy(r.out) : { enabled: false }
    }

    private async getSecureWebProxy(service: string) {
        const r = await run('networksetup', ['-getsecurewebproxy', service])
        return r.ok ? this.parseGetProxy(r.out) : { enabled: false }
    }

    private async isCertificateInSystemKeychain(): Promise<boolean> {
        const list = await this.runSecurity([
            'find-certificate',
            '-a',
            '-c',
            'Arachne Proxy Root CA',
            '/Library/Keychains/System.keychain',
        ])
        return list.ok && list.message.includes('Arachne Proxy Root CA')
    }

    private escapeArg(s: string): string {
        return /\s/.test(s) ? `'${s.replace(/'/g, "\\'")}'` : s
    }

    private runSecurity(args: string[]): Promise<TrustResult> {
        return new Promise((resolve) => {
            const p = spawn('security', args, { stdio: 'pipe' })
            let out = ''
            let err = ''
            p.stdout.on('data', (d) => (out += d.toString()))
            p.stderr.on('data', (d) => (err += d.toString()))
            p.on('close', (code) => {
                const ok = code === 0
                resolve({
                    ok,
                    message: ok ? out.trim() || 'OK' : err.trim() || out.trim(),
                    code,
                })
            })
            p.on('error', (e) =>
                resolve({ ok: false, message: String(e), code: null })
            )
        })
    }

    private runSecurityWithOsascript(args: string[]): Promise<TrustResult> {
        // Use osascript to show system password dialog for sudo commands
        return new Promise((resolve) => {
            const escapedArgs = args.map(this.escapeArg).join(' ')
            const script = `do shell script "security ${escapedArgs}" with administrator privileges`

            const p = spawn('osascript', ['-e', script], { stdio: 'pipe' })
            let out = ''
            let err = ''

            p.stdout.on('data', (d) => (out += d.toString()))
            p.stderr.on('data', (d) => (err += d.toString()))

            p.on('close', (code) => {
                const ok = code === 0
                resolve({
                    ok,
                    message: ok ? out.trim() || 'OK' : err.trim() || out.trim(),
                    code,
                })
            })

            p.on('error', (e) => {
                resolve({ ok: false, message: String(e), code: null })
            })
        })
    }
}
