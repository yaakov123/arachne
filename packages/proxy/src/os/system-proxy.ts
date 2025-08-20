import { spawn } from 'node:child_process'
import { platform } from '../certs/trust.js'

interface ProxyState {
  service: string
  web: { enabled: boolean; server?: string; port?: number }
  secure: { enabled: boolean; server?: string; port?: number }
}

let previousState: ProxyState | null = null
let activeService: string | null = null

function run(cmd: string, args: string[]): Promise<{ ok: boolean; code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'pipe' })
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d.toString()))
    p.stderr.on('data', (d) => (err += d.toString()))
    p.on('close', (code) => resolve({ ok: code === 0, code, out, err }))
    p.on('error', () => resolve({ ok: false, code: null, out, err: 'failed to spawn' }))
  })
}

async function listServices(): Promise<string[]> {
  const r = await run('networksetup', ['-listallnetworkservices'])
  if (!r.ok) return []
  const lines = r.out.split(/\r?\n/)
  // First line is a note about asterisks denoting disabled services
  return lines
    .slice(1)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('*'))
}

async function getDefaultService(): Promise<string | null> {
  const envSvc = process.env.ARACHNE_PROXY_NETWORK_SERVICE || process.env.ARACHNE_NETWORK_SERVICE
  const services = await listServices()
  if (envSvc && services.includes(envSvc)) return envSvc
  if (services.includes('Wi-Fi')) return 'Wi-Fi'
  if (services.includes('Ethernet')) return 'Ethernet'
  return services[0] || null
}

function parseGetProxy(out: string): { enabled: boolean; server?: string; port?: number } {
  const res: { enabled: boolean; server?: string; port?: number } = { enabled: false }
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

async function getWebProxy(service: string) {
  const r = await run('networksetup', ['-getwebproxy', service])
  return r.ok ? parseGetProxy(r.out) : { enabled: false }
}

async function getSecureWebProxy(service: string) {
  const r = await run('networksetup', ['-getsecurewebproxy', service])
  return r.ok ? parseGetProxy(r.out) : { enabled: false }
}

export async function enableSystemProxy(host: string, port: number): Promise<void> {
  if (platform() !== 'darwin') return
  const service = (await getDefaultService())
  if (!service) {
    console.warn('[Arachne] No macOS network service found to enable proxy.')
    return
  }

  try {
    // Capture current state once
    if (!previousState) {
      previousState = {
        service,
        web: await getWebProxy(service),
        secure: await getSecureWebProxy(service),
      }

    }

    // Configure proxies
    await run('networksetup', ['-setwebproxy', service, host, String(port)])
    await run('networksetup', ['-setsecurewebproxy', service, host, String(port)])
    await run('networksetup', ['-setwebproxystate', service, 'on'])
    await run('networksetup', ['-setsecurewebproxystate', service, 'on'])

    activeService = service
    console.log(`[Arachne] Enabled system proxy on ${service}: ${host}:${port}`)
  } catch (e) {
    console.warn('[Arachne] Failed to enable system proxy:', e)
  }
}

export async function disableSystemProxy(): Promise<void> {
  if (platform() !== 'darwin') return
  const service = activeService || (await getDefaultService())
  if (!service) return

  try {
    if (previousState && previousState.service === service) {
      // Restore prior settings
      const w = previousState.web
      const s = previousState.secure
      if (w.enabled) {
        if (w.server && w.port) await run('networksetup', ['-setwebproxy', service, w.server, String(w.port)])
        await run('networksetup', ['-setwebproxystate', service, 'on'])
      } else {
        await run('networksetup', ['-setwebproxystate', service, 'off'])
      }

      if (s.enabled) {
        if (s.server && s.port) await run('networksetup', ['-setsecurewebproxy', service, s.server, String(s.port)])
        await run('networksetup', ['-setsecurewebproxystate', service, 'on'])
      } else {
        await run('networksetup', ['-setsecurewebproxystate', service, 'off'])
      }
    } else {
      // Best-effort: turn off if we don't know previous state
      await run('networksetup', ['-setwebproxystate', service, 'off'])
      await run('networksetup', ['-setsecurewebproxystate', service, 'off'])
    }
  } catch (e) {
    console.warn('[Arachne] Failed to disable/restore system proxy:', e)
  } finally {
    previousState = null
    activeService = null
    console.log(`[Arachne] System proxy restored on ${service}`)
  }
}
