#!/usr/bin/env node
import { Command } from 'commander'
import { startRecorderProxy } from './index.js'

const program = new Command()
program
  .name('arachne-recorder')
  .description('Start a MITM proxy that records traffic to NDJSON via @arachne/recorder')
  .version('0.1.0')

const parseIntArg = (v: string) => parseInt(v, 10)

program
  .command('start')
  .description('Start the recorder proxy')
  .option('-p, --port <port>', 'Port to listen on', parseIntArg, 8899)
  .option('--host <host>', 'Host to bind to', '127.0.0.1')
  .option('--out <file>', 'NDJSON output file (default: ~/.arachne/recorder/traffic.ndjson)')
  .option('--hosts <csv>', 'Comma-separated host allowlist (record only these hosts)')
  .option('--sample-bodies', 'Record request/response bodies (base64, truncated)', false)
  .option('--max-body-bytes <n>', 'Max bytes to capture for bodies', parseIntArg, 524288)
  .option('--no-ensure-ca', 'Do not auto-create/load the Arachne Root CA')
  .option('--install-trust', 'Attempt to install the Root CA in OS trust (macOS auto)')
  .action(async (opts: {
    port: number
    host: string
    out?: string
    hosts?: string
    sampleBodies: boolean
    maxBodyBytes: number
    ensureCa?: boolean
    installTrust?: boolean
  }) => {
    const { host, port } = await startRecorderProxy({
      host: opts.host,
      port: opts.port,
      ensureCA: opts.ensureCa !== undefined ? opts.ensureCa : true,
      installTrust: !!opts.installTrust,
      recorder: {
        outFile: opts.out,
        hosts: opts.hosts ? String(opts.hosts).split(',') : undefined,
        sampleBodies: !!opts.sampleBodies,
        maxBodyBytes: opts.maxBodyBytes,
      },
    })
    console.log(`Recorder proxy listening on ${host}:${port}`)
  })

program.parseAsync(process.argv)
