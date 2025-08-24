import { spawn } from 'node:child_process'

export interface ProcessResult {
    ok: boolean
    code: number | null
    out: string
    err: string
}

export function run(cmd: string, args: string[]): Promise<ProcessResult> {
    return new Promise((resolve) => {
        const p = spawn(cmd, args, { stdio: 'pipe' })
        let out = ''
        let err = ''
        p.stdout.on('data', (d) => (out += d.toString()))
        p.stderr.on('data', (d) => (err += d.toString()))
        p.on('close', (code) => {
            resolve({ ok: code === 0, code, out, err })
        })
        p.on('error', () => {
            resolve({ ok: false, code: null, out, err: 'failed to spawn' })
        })
    })
}
