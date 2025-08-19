import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export function caBaseDir(): string {
  const dir = path.join(os.homedir(), '.arachne', 'proxy', 'ca')
  return dir
}

export function ensureDirs(): {
  base: string
  certs: string
  keys: string
} {
  const base = caBaseDir()
  const certs = path.join(base, 'certs')
  const keys = path.join(base, 'keys')
  fs.mkdirSync(certs, { recursive: true })
  fs.mkdirSync(keys, { recursive: true })
  return { base, certs, keys }
}

export function caCertPath(): string {
  const { base } = ensureDirs()
  return path.join(base, 'ca.crt.pem')
}

export function caKeyPath(): string {
  const { base } = ensureDirs()
  return path.join(base, 'ca.key.pem')
}

export function hostCertPath(hostname: string): string {
  const { certs } = ensureDirs()
  const safe = hostname.replace(/[^a-zA-Z0-9_.-]/g, '_')
  return path.join(certs, `${safe}.crt.pem`)
}

export function hostKeyPath(hostname: string): string {
  const { keys } = ensureDirs()
  const safe = hostname.replace(/[^a-zA-Z0-9_.-]/g, '_')
  return path.join(keys, `${safe}.key.pem`)
}

export function readFileIfExists(p: string): string | undefined {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return undefined
  }
}

export function writeFileAtomic(p: string, content: string) {
  const tmp = `${p}.${process.pid}.tmp`
  fs.writeFileSync(tmp, content, 'utf8')
  fs.renameSync(tmp, p)
}
