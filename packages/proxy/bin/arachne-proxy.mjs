#!/usr/bin/env node
// ESM launcher for the compiled CLI. Run `npm run build -w @arachne/proxy` first.
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const distCli = resolve(here, '../dist/cli.js')

import(pathToFileURL(distCli).href).catch((err) => {
  console.error('[arachne-proxy] Failed to load CLI. Did you run the build?', err)
  process.exit(1)
})
