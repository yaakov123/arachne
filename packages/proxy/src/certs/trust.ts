import { spawn } from 'node:child_process'
import { CertStore } from './store.js'

export type Platform = 'darwin' | 'win32' | 'linux'

export function platform(): Platform {
    const p = process.platform as Platform
    if (p === 'darwin' || p === 'win32' || p === 'linux') return p
    return 'linux'
}

export interface TrustResult {
    ok: boolean
    message: string
    code?: number | null
}

export async function installRootCATrust(
    store: CertStore = new CertStore()
): Promise<TrustResult> {
    const cert = store.caCertPath()
    switch (platform()) {
        case 'darwin':
            return installOnMac(cert)
        case 'win32':
            return {
                ok: false,
                message:
                    'Windows trust installation not implemented yet. Please import the CA into Trusted Root Certification Authorities manually.',
            }
        case 'linux':
            return { ok: false, message: linuxInstructions(cert) }
    }
}

export async function uninstallRootCATrust(): Promise<TrustResult> {
    switch (platform()) {
        case 'darwin':
            return uninstallOnMac()
        case 'win32':
            return {
                ok: false,
                message:
                    'Windows trust removal not implemented. Please remove the CA from the Trusted Root Certification Authorities store manually.',
            }
        case 'linux':
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
}

function linuxInstructions(certPath: string): string {
    return [
        'Linux trust installation is distro-dependent. Try one of the following:',
        `- Debian/Ubuntu: sudo cp "${certPath}" /usr/local/share/ca-certificates/arachne-proxy.crt && sudo update-ca-certificates`,
        `- RHEL/CentOS/Fedora: sudo cp "${certPath}" /etc/pki/ca-trust/source/anchors/arachne-proxy.pem && sudo update-ca-trust`,
        'Then restart your browser.',
    ].join('\n')
}

async function installOnMac(certPath: string): Promise<TrustResult> {
    // Add trusted root to System keychain (requires sudo)
    const args = [
        'add-trusted-cert',
        '-d',
        '-r',
        'trustRoot',
        '-k',
        '/Library/Keychains/System.keychain',
        certPath,
    ]
    const res = await runSecurity(args)
    if (res.ok) return res
    // Try elevating only this subcommand with sudo
    const elevated = await runSecuritySudo(args)
    if (elevated.ok)
        return { ok: true, message: 'Installed CA into System keychain.' }
    // If failed (likely due to permissions or user cancelled), suggest manual command
    return {
        ok: false,
        message: `Failed to add trusted cert to System keychain. You can try:\n  sudo security ${args.map(escapeArg).join(' ')}`,
        code: elevated.code ?? res.code,
    }
}

function escapeArg(s: string): string {
    return /\s/.test(s) ? `'${s.replace(/'/g, "\\'")}'` : s
}

function runSecurity(args: string[]): Promise<TrustResult> {
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

function runSecuritySudo(args: string[]): Promise<TrustResult> {
    // Elevate just this subcommand; inherit stdio to allow password prompt
    return new Promise((resolve) => {
        const p = spawn('sudo', ['security', ...args], { stdio: 'inherit' })
        p.on('close', (code) => {
            const ok = code === 0
            resolve({
                ok,
                message: ok ? 'OK' : `security exited with code ${code}`,
                code,
            })
        })
        p.on('error', (e) =>
            resolve({ ok: false, message: String(e), code: null })
        )
    })
}

async function uninstallOnMac(): Promise<TrustResult> {
    // Find all matching certs by common name in the System keychain and delete them.
    const list = await runSecurity([
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
            message: 'No matching Arachne Root CA found in System keychain.',
        }
    }

    for (const h of hashes) {
        const del = await runSecurity([
            'delete-certificate',
            '-Z',
            h,
            '/Library/Keychains/System.keychain',
        ])
        if (!del.ok) {
            const elevated = await runSecuritySudo([
                'delete-certificate',
                '-Z',
                h,
                '/Library/Keychains/System.keychain',
            ])
            if (!elevated.ok) return elevated
        }
    }
    return {
        ok: true,
        message: `Removed ${hashes.length} certificate(s) from System keychain.`,
    }
}
