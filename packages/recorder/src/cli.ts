#!/usr/bin/env node
import { Command } from 'commander'
import { CertificateAuthority, MitmProxyServer, getDefaultCertStoreOptions } from '@arachne/proxy'
import { createRecorderPlugin } from './plugin.js'
import { InMemoryStorageAdapter } from './storage/memory.js'
import { FileStorageAdapter } from './storage/file.js'
import os from 'os'

const program = new Command()
program
  .name('recorder')
  .description('HTTP/HTTPS MITM API recorder built on @arachne/proxy')
  .version('0.1.0')

program
  .command('start')
  .description('Start the recorder proxy and print the in-memory inventory JSON when it exits')
  .option('-p, --port <port>', 'Port to listen on', (v) => parseInt(v, 10), 8899)
  .option('--host <host>', 'Host to bind to', '127.0.0.1')
  .option('--store <path>', 'Path to the certificate store directory', getDefaultCertStoreOptions().baseDir)
  .option('--capture-bodies', 'Capture small example request/response bodies (up to max bytes)', true)
  .option('--normalize-paths', 'Normalize likely ID segments in paths to {id}', true)
  .option('--max-bytes <n>', 'Max bytes to capture per body sample', (v) => parseInt(v, 10), 1024 * 1024)
  .option('--storage <type>', 'Storage type: memory | file', 'file' )
  .option('--out <dir>', 'Output directory for file storage (defaults to ~/.arachne/recorder)', os.homedir() + '/.arachne/recorder')
  .action(async (opts) => {
    const ca = new CertificateAuthority()
    await ca.ensureRootCA()

    const storage = (String(opts.storage) === 'file')
      ? new FileStorageAdapter({ outDir: opts.out, normalizePaths: !!opts.normalizePaths, maxCaptureBytes: opts.maxBytes })
      : new InMemoryStorageAdapter({ normalizePaths: !!opts.normalizePaths, maxCaptureBytes: opts.maxBytes })

    const { plugin } = createRecorderPlugin({
      storage,
      captureBodies: !!opts.captureBodies,
      normalizePaths: !!opts.normalizePaths,
      maxCaptureBytes: opts.maxBytes,
    })

    const proxy = new MitmProxyServer({ port: opts.port, host: opts.host, ca, plugins: [plugin] })
    const { host, port } = await proxy.start()
    console.log(`Arachne recorder listening on ${host}:${port}`)
    console.log('Use this proxy in your system/browser to record traffic. Press Ctrl+C to stop and output the captured inventory JSON...')

    let stopping = false
    const dumpAndExit = async (code = 0) => {
      console.log('[Arachne:Recorder] Shutting down...')
      if (stopping) return
      stopping = true
      try {
        console.log('[Arachne:Recorder] Stopping proxy server...')
        await proxy.stop()
      } catch (e) {
        console.error('[Arachne:Recorder] Error during shutdown:', e)
      }
      try {
        // const snapshot = storage.snapshot()
        // console.log('\n=== Arachne Recorder Inventory JSON ===')
        // console.log(JSON.stringify(snapshot, null, 2))
      } catch (e) {
        // console.error('[Arachne:Recorder] Failed to output snapshot:', e)
      } finally {
        process.exit(code)
      }
    }

    process.on('SIGINT', () => dumpAndExit(0))
    process.on('SIGTERM', () => dumpAndExit(0))
    process.on('uncaughtException', async (err) => {
      console.error('[Arachne:Recorder] Uncaught exception:', err)
      await dumpAndExit(1)
    })
    process.on('unhandledRejection', async (reason) => {
      console.error('[Arachne:Recorder] Unhandled rejection:', reason)
      await dumpAndExit(1)
    })
  })

program.parseAsync(process.argv)
