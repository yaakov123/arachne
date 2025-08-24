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
        // Provide manual command for user to run instead of automated installation
        const args = [
            'add-trusted-cert',
            '-d',
            '-r',
            'trustRoot',
            '-k',
            '/Library/Keychains/System.keychain',
            certPath,
        ]

        const command = `sudo security ${args.map(this.escapeArg).join(' ')}`
        
        return {
            ok: false,
            message: `To trust the Root CA certificate, please run this command in your terminal:\n\n${command}\n\nThis will add the certificate to your System keychain and mark it as trusted for SSL.`,
            code: null,
        }
    }

    async getTrustInstructions(certPath: string): Promise<{
        trustCommand: string
        untrustCommands: string[]
    }> {
        // Generate trust command
        const trustArgs = [
            'add-trusted-cert',
            '-d',
            '-r',
            'trustRoot',
            '-k',
            '/Library/Keychains/System.keychain',
            certPath,
        ]
        const trustCommand = `sudo security ${trustArgs.map(this.escapeArg).join(' ')}`

        // Find existing certificates to generate untrust commands
        const untrustCommands: string[] = []
        try {
            const list = await this.runSecurity([
                'find-certificate',
                '-a',
                '-Z',
                '-c',
                'Arachne Proxy Root CA',
                '/Library/Keychains/System.keychain',
            ])
            
            if (list.ok) {
                const hashes = list.message
                    .split('\n')
                    .map((l) => l.match(/SHA-1 hash: ([A-F0-9]+)/)?.[1])
                    .filter((h): h is string => !!h)

                for (const hash of hashes) {
                    untrustCommands.push(
                        `sudo security delete-certificate -Z ${hash} /Library/Keychains/System.keychain`
                    )
                }
            }
        } catch {
            // If we can't find existing certs, just provide the generic command
            untrustCommands.push(
                'sudo security find-certificate -a -Z -c "Arachne Proxy Root CA" /Library/Keychains/System.keychain'
            )
            untrustCommands.push(
                'sudo security delete-certificate -Z <hash> /Library/Keychains/System.keychain'
            )
        }

        return { trustCommand, untrustCommands }
    }

    async uninstallRootCATrust(): Promise<TrustResult> {
        // Find all matching certs by common name in the System keychain
        const list = await this.runSecurity([
            'find-certificate',
            '-a',
            '-Z',
            '-c',
            'Arachne Proxy Root CA',
            '/Library/Keychains/System.keychain',
        ])
        if (!list.ok) {
            return {
                ok: false,
                message: `To remove Arachne Root CA certificates, please run:\n\nsudo security find-certificate -a -Z -c "Arachne Proxy Root CA" /Library/Keychains/System.keychain\n\nThen for each SHA-1 hash found, run:\nsudo security delete-certificate -Z <hash> /Library/Keychains/System.keychain`,
                code: list.code,
            }
        }

        const hashes = list.message
            .split('\n')
            .map((l) => l.match(/SHA-1 hash: ([A-F0-9]+)/)?.[1])
            .filter((h): h is string => !!h)

        if (hashes.length === 0) {
            return {
                ok: true,
                message: 'No matching Arachne Root CA found in System keychain.',
            }
        }

        // Provide manual commands for each certificate found
        const commands = hashes.map(h => 
            `sudo security delete-certificate -Z ${h} /Library/Keychains/System.keychain`
        ).join('\n')

        return {
            ok: false,
            message: `Found ${hashes.length} Arachne Root CA certificate(s). To remove them, please run these commands in your terminal:\n\n${commands}`,
            code: null,
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
}
