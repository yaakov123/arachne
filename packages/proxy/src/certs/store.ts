import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface CertStoreOptions {
    baseDir?: string
}

export class CertStore {
    private baseDir: string

    static defaultBaseDir(): string {
        return path.join(os.homedir(), '.arachne', 'proxy', 'ca')
    }

    constructor(opts: CertStoreOptions = {}) {
        this.baseDir = opts.baseDir ?? CertStore.defaultBaseDir()
    }

    getBaseDir(): string {
        return this.baseDir
    }

    ensureDirs(): { base: string; certs: string; keys: string } {
        const base = this.baseDir
        const certs = path.join(base, 'certs')
        const keys = path.join(base, 'keys')
        // Ensure base/certs/keys exist and are writable by current user
        this.ensureWritableDir(base)
        this.ensureWritableDir(certs)
        this.ensureWritableDir(keys)
        return { base, certs, keys }
    }

    private ensureWritableDir(dir: string) {
        // Create if missing with secure perms; recursive allows creating parents
        try {
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
        } catch {}
        // Try to tighten perms if the directory exists
        try {
            fs.chmodSync(dir, 0o700)
        } catch {}
        // Verify writability
        try {
            fs.accessSync(dir, fs.constants.W_OK)
        } catch (e: any) {
            const err = new Error(
                `Permission denied: cannot write to ${dir}. Fix ownership/permissions (e.g., chown -R $USER \"${this.baseDir}\"). Original: ${e?.message ?? e}`
            )
            ;(err as any).code = 'EACCES'
            throw err
        }
    }

    caCertPath(): string {
        const { base } = this.ensureDirs()
        return path.join(base, 'ca.crt.pem')
    }

    caKeyPath(): string {
        const { base } = this.ensureDirs()
        return path.join(base, 'ca.key.pem')
    }

    hostCertPath(hostname: string): string {
        const { certs } = this.ensureDirs()
        const safe = hostname.replace(/[^a-zA-Z0-9_.-]/g, '_')
        return path.join(certs, `${safe}.crt.pem`)
    }

    hostKeyPath(hostname: string): string {
        const { keys } = this.ensureDirs()
        const safe = hostname.replace(/[^a-zA-Z0-9_.-]/g, '_')
        return path.join(keys, `${safe}.key.pem`)
    }

    readFileIfExists(p: string): string | undefined {
        try {
            return fs.readFileSync(p, 'utf8')
        } catch {
            return undefined
        }
    }

    writeFileAtomic(p: string, content: string) {
        const dir = path.dirname(p)
        this.ensureWritableDir(dir)
        const tmp = `${p}.${process.pid}.tmp`
        try {
            fs.writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 })
            fs.renameSync(tmp, p)
        } catch (e: any) {
            // Best-effort cleanup
            try {
                if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
            } catch {}
            if (e && (e.code === 'EACCES' || e.code === 'EPERM')) {
                const err = new Error(
                    `Permission denied writing certificate/key at ${p}. Ensure ${dir} is writable by the current user.`
                )
                ;(err as any).code = e.code
                ;(err as any).cause = e
                throw err
            }
            throw e
        }
    }
}
