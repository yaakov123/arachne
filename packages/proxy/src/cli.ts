#!/usr/bin/env node
import { Command } from 'commander'
import fs from 'node:fs'
import { CertificateAuthority } from './certs/ca.js'
import { installRootCATrust, uninstallRootCATrust } from '@arachne/os'
import { CertStore } from './certs/store.js'
import { MitmProxyServer } from './proxy/server.js'
import { createLoggerPlugin } from './plugins/logger.js'
import { createDemoRewritePlugin } from './plugins/rewriter.js'

const program = new Command()
program
    .name('arachne-proxy')
    .description('Arachne MITM HTTPS proxy with plugin system')
    .version('0.1.0')

// Only elevate specific subcommands (handled inside trust.ts). If the user ran this
// entire CLI with sudo, drop privileges for file operations to avoid creating
// root-owned files under ~/.arachne.
function dropPrivilegesForFileOps() {
    try {
        const getEuid = (process as any).geteuid as (() => number) | undefined
        if (!getEuid) return
        if (getEuid() !== 0) return // not root
        const sudoUid = process.env.SUDO_UID
        const sudoGid = process.env.SUDO_GID
        if (sudoGid) {
            try {
                ;(process as any).setgid?.(Number(sudoGid))
            } catch {}
        }
        if (sudoUid) {
            try {
                ;(process as any).setuid?.(Number(sudoUid))
            } catch {}
        } else {
            console.error(
                'Refusing to run as root: re-run without sudo to avoid permission issues.'
            )
            process.exit(1)
        }
    } catch {
        // Ignore inability to drop; proceed, but warn
        console.warn(
            'Warning: could not drop root privileges; this may create root-owned files.'
        )
    }
}

program
    .command('init-ca')
    .description(
        'Generate a root CA for the proxy and save it to ~/.arachne/proxy/ca'
    )
    .action(async () => {
        const ca = new CertificateAuthority()
        const { certPem } = await ca.ensureRootCA()
        console.log('Root CA generated at ~/.arachne/proxy/ca')
        console.log(certPem)
    })

program
    .command('install-ca')
    .description(
        'Install the root CA into the OS trust store (macOS automated, others show instructions)'
    )
    .action(async () => {
        const ca = new CertificateAuthority()
        await ca.ensureRootCA()
        const res = await installRootCATrust()
        console.log(res.message)
        if (!res.ok) process.exitCode = 1
    })

program
    .command('start')
    .description('Start the proxy server')
    .option(
        '-p, --port <port>',
        'Port to listen on',
        (v) => parseInt(v, 10),
        8899
    )
    .option('--host <host>', 'Host to bind to', '127.0.0.1')
    .option(
        '--store <path>',
        'Path to the certificate store directory',
        CertStore.defaultBaseDir()
    )
    .action(async (opts) => {
        const ca = new CertificateAuthority({ store: { baseDir: opts.store } })
        await ca.ensureRootCA()
        const plugins = [createLoggerPlugin(), createDemoRewritePlugin()]
        const proxy = new MitmProxyServer({
            port: opts.port,
            host: opts.host,
            ca,
            plugins,
        })
        const { host, port } = await proxy.start()
        console.log(`Arachne proxy listening on ${host}:${port}`)
        console.log(
            'Ensure your browser/system is configured to use this HTTP proxy and that the Arachne Root CA is trusted.'
        )

        let stopping = false
        const shutdown = async (code = 0) => {
            console.log('[Arachne] Shutting down...')
            if (stopping) return
            stopping = true
            try {
                await proxy.stop()
            } catch (e) {
                console.error('Error during shutdown:', e)
            } finally {
                process.exit(code)
            }
        }

        process.on('SIGINT', () => shutdown(0))
        process.on('SIGTERM', () => shutdown(0))
        process.on('uncaughtException', async (err) => {
            console.error('Uncaught exception:', err)
            await shutdown(1)
        })
        process.on('unhandledRejection', async (reason) => {
            console.error('Unhandled rejection:', reason)
            await shutdown(1)
        })
    })

program
    .command('rotate')
    .description(
        'Rotate the root CA: untrust and remove the old CA, then generate a new one'
    )
    .option(
        '--store <path>',
        'Path to the certificate store directory',
        CertStore.defaultBaseDir()
    )
    .action(async (opts) => {
        // Ensure subsequent file operations run as the invoking user, not root
        dropPrivilegesForFileOps()
        console.log('Untrusting existing Arachne Root CA (if present)...')
        const untrust = await uninstallRootCATrust()
        console.log(untrust.message)
        if (!untrust.ok) {
            console.warn(
                'Proceeding with rotation despite untrust failure/non-automation on this platform.'
            )
        }

        console.log(`Removing CA directory: ${opts.store}`)
        try {
            fs.rmSync(opts.store, { recursive: true, force: true })
        } catch (e) {
            console.error('Failed to remove CA directory:', e)
        }

        console.log('Generating a fresh Root CA...')
        const ca = new CertificateAuthority({ store: { baseDir: opts.store } })
        const { certPem } = await ca.ensureRootCA()
        console.log('New Root CA generated at', opts.store)
        console.log(certPem)
        console.log(
            'Trusting the new Root CA in the OS trust store (where supported)...'
        )
        const trust = await installRootCATrust()
        console.log(trust.message)
        if (!trust.ok) {
            console.warn(
                'The CA was generated but not automatically trusted. You may need to run with elevated privileges or follow the printed instructions.'
            )
            process.exitCode = 1
        }
    })

program.parseAsync(process.argv)
