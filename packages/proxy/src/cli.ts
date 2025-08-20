#!/usr/bin/env node
import { Command } from 'commander'
import fs from 'node:fs'
import { CertificateAuthority } from './certs/ca.js'
import { installRootCATrust, uninstallRootCATrust } from './certs/trust.js'
import { caBaseDir } from './certs/store.js'
import { MitmProxyServer } from './proxy/server.js'
import { createLoggerPlugin } from './plugins/logger.js'
import { createDemoRewritePlugin } from './plugins/rewriter.js'

const program = new Command()
program
  .name('arachne-proxy')
  .description('Arachne MITM HTTPS proxy with plugin system')
  .version('0.1.0')

program
  .command('init-ca')
  .description('Generate a root CA for the proxy and save it to ~/.arachne/proxy/ca')
  .action(async () => {
    const ca = new CertificateAuthority()
    const { certPem } = await ca.ensureRootCA()
    console.log('Root CA generated at ~/.arachne/proxy/ca')
    console.log(certPem)
  })

program
  .command('install-ca')
  .description('Install the root CA into the OS trust store (macOS automated, others show instructions)')
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
  .option('-p, --port <port>', 'Port to listen on', (v) => parseInt(v, 10), 8899)
  .option('--host <host>', 'Host to bind to', '127.0.0.1')
  .action(async (opts) => {
    const ca = new CertificateAuthority()
    await ca.ensureRootCA()
    const plugins = [createLoggerPlugin(), createDemoRewritePlugin()]
    const proxy = new MitmProxyServer({ port: opts.port, host: opts.host, ca, plugins })
    const { host, port } = await proxy.start()
    console.log(`Arachne proxy listening on ${host}:${port}`)
    console.log('Ensure your browser/system is configured to use this HTTP proxy and that the Arachne Root CA is trusted.')

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
  .description('Rotate the root CA: untrust and remove the old CA, then generate a new one')
  .action(async () => {
    console.log('Untrusting existing Arachne Root CA (if present)...')
    const untrust = await uninstallRootCATrust()
    console.log(untrust.message)
    if (!untrust.ok) {
      console.warn('Proceeding with rotation despite untrust failure/non-automation on this platform.')
    }

    const base = caBaseDir()
    console.log(`Removing CA directory: ${base}`)
    try {
      fs.rmSync(base, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to remove CA directory:', e)
    }

    console.log('Generating a fresh Root CA...')
    const ca = new CertificateAuthority()
    const { certPem } = await ca.ensureRootCA()
    console.log('New Root CA generated at ~/.arachne/proxy/ca')
    console.log(certPem)
    console.log('Trusting the new Root CA in the OS trust store (where supported)...')
    const trust = await installRootCATrust()
    console.log(trust.message)
    if (!trust.ok) {
      console.warn('The CA was generated but not automatically trusted. You may need to run with elevated privileges or follow the printed instructions.')
      process.exitCode = 1
    }
  })

program.parseAsync(process.argv)
