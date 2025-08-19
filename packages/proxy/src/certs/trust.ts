import { spawn } from 'node:child_process'
import { caCertPath } from './store.js'

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

export async function installRootCATrust(): Promise<TrustResult> {
  const cert = caCertPath()
  switch (platform()) {
    case 'darwin':
      return installOnMac(cert)
    case 'win32':
      return { ok: false, message: 'Windows trust installation not implemented yet. Please import the CA into Trusted Root Certification Authorities manually.' }
    case 'linux':
      return { ok: false, message: linuxInstructions(cert) }
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
  const args = ['add-trusted-cert', '-d', '-r', 'trustRoot', '-k', '/Library/Keychains/System.keychain', certPath]
  const res = await runSecurity(args)
  if (res.ok) return res
  // If failed (likely due to permissions), suggest manual command
  return {
    ok: false,
    message: `Failed to add trusted cert to System keychain. Try running with sudo:\n  sudo security ${args.map(escapeArg).join(' ')}`,
    code: res.code,
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
      resolve({ ok, message: ok ? out.trim() || 'OK' : err.trim() || out.trim(), code })
    })
    p.on('error', (e) => resolve({ ok: false, message: String(e), code: null }))
  })
}
