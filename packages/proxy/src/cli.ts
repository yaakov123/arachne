#!/usr/bin/env node
import { Command } from 'commander'
import { CertificateAuthority } from './certs/ca.js'
import { installRootCATrust } from './certs/trust.js'
import { MitmProxyServer } from './proxy/server.js'
import { createLoggerPlugin } from './plugins/logger.js'

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
    const proxy = new MitmProxyServer({ port: opts.port, host: opts.host, ca, plugins: [createLoggerPlugin()] })
    const { host, port } = await proxy.start()
    console.log(`Arachne proxy listening on ${host}:${port}`)
    console.log('Ensure your browser/system is configured to use this HTTP proxy and that the Arachne Root CA is trusted.')
  })

program.parseAsync(process.argv)
