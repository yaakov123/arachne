import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { MitmProxyServer, CertificateAuthority, installRootCATrust } from '@arachne/proxy'
import type {
  ProxyPlugin,
  ConnectContext,
  RequestContext,
  ResponseContext,
  RequestBodyContext,
  ResponseBodyContext,
} from '@arachne/proxy'

export type TrafficRecorderOptions = {
  outFile?: string
  append?: boolean
  hosts?: string[]
  sampleBodies?: boolean
  maxBodyBytes?: number
  redactHeaders?: string[]
}

export type TrafficRecorder = {
  plugin: ProxyPlugin
  close: () => Promise<void>
}

// Raw NDJSON record types
export type BaseRecord = { ts: number }
export type ConnectRecord = BaseRecord & {
  type: 'connect'
  id: string
  hostname: string
  port: number
  clientIp?: string
}
export type RequestRecord = BaseRecord & {
  type: 'request'
  id: string
  isHttps: boolean
  url: string
  method: string
  headers: Record<string, string | string[]>
  clientIp?: string
}
export type ResponseRecord = BaseRecord & {
  type: 'response'
  id: string
  url: string
  method: string
  statusCode: number
  statusMessage?: string
  headers: Record<string, string | string[]>
}
export type RequestBodyRecord = BaseRecord & {
  type: 'requestBody'
  id: string
  url: string
  method: string
  contentType?: string
  contentEncoding?: string
  bodyB64: string
  truncated: boolean
}
export type ResponseBodyRecord = BaseRecord & {
  type: 'responseBody'
  id: string
  url: string
  method: string
  statusCode: number
  contentType?: string
  contentEncoding?: string
  bodyB64: string
  truncated: boolean
}
export type ErrorRecord = BaseRecord & {
  type: 'error'
  id?: string
  message: string
}
export type TrafficRecord =
  | ConnectRecord
  | RequestRecord
  | ResponseRecord
  | RequestBodyRecord
  | ResponseBodyRecord
  | ErrorRecord

const DEFAULT_REDACT = ['authorization', 'cookie', 'set-cookie']
const DEFAULT_MAX_BODY = 512 * 1024

export function createTrafficRecorder(opts: TrafficRecorderOptions = {}): TrafficRecorder {
  const outFile = opts.outFile || path.join(os.homedir(), '.arachne', 'recorder', 'traffic.ndjson')
  const append = opts.append ?? true
  const sampleBodies = opts.sampleBodies ?? true
  const maxBodyBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BODY
  const redactHeaders = (opts.redactHeaders || DEFAULT_REDACT).map((h) => h.toLowerCase())
  const hostFilter = sanitizeHosts(opts.hosts)

  ensureDirSync(path.dirname(outFile))
  const stream = fs.createWriteStream(outFile, { flags: append ? 'a' : 'w', encoding: 'utf8' })

  function shouldRecordHost(hostname?: string): boolean {
    if (!hostFilter) return true
    if (!hostname) return false
    return hostFilter.has(hostname.toLowerCase())
  }

  async function write(obj: TrafficRecord) {
    const line = JSON.stringify(obj) + '\n'
    if (!stream.write(line)) {
      await once(stream, 'drain')
    }
  }

  function redact(h: Record<string, string | string[]>): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(h || {})) {
      if (redactHeaders.includes(k.toLowerCase())) continue
      out[k] = v
    }
    return out
  }

  function baseRecord<T extends TrafficRecord['type']>(type: T): { ts: number; type: T } {
    return { ts: Date.now(), type }
  }

  function truncateBody(buf: Buffer): { b64: string; truncated: boolean } {
    if (buf.length <= maxBodyBytes) return { b64: buf.toString('base64'), truncated: false }
    return { b64: buf.subarray(0, maxBodyBytes).toString('base64'), truncated: true }
  }

  const plugin: ProxyPlugin = {
    name: 'traffic-recorder',
    async onConnect(ctx: ConnectContext) {
      if (!shouldRecordHost(ctx.hostname)) return
      await write({
        ...baseRecord('connect'),
        id: ctx.id,
        hostname: ctx.hostname,
        port: ctx.port,
        clientIp: ctx.clientIp,
      })
    },
    async onRequest(ctx: RequestContext) {
      if (!shouldRecordHost(ctx.url.hostname)) return
      await write({
        ...baseRecord('request'),
        id: ctx.id,
        isHttps: ctx.isHttps,
        url: ctx.url.toString(),
        method: ctx.method,
        headers: redact(ctx.headers),
        clientIp: ctx.clientIp,
      })
    },
    async onResponse(ctx: ResponseContext) {
      if (!shouldRecordHost(ctx.url.hostname)) return
      await write({
        ...baseRecord('response'),
        id: ctx.id,
        url: ctx.url.toString(),
        method: ctx.method,
        statusCode: ctx.statusCode,
        statusMessage: ctx.statusMessage,
        headers: redact(ctx.responseHeaders),
      })
    },
    async onRequestBody(ctx: RequestBodyContext) {
      if (!sampleBodies) return
      if (!shouldRecordHost(ctx.url.hostname)) return
      const { b64, truncated } = truncateBody(ctx.body)
      await write({
        ...baseRecord('requestBody'),
        id: ctx.id,
        url: ctx.url.toString(),
        method: ctx.method,
        contentType: ctx.contentType,
        contentEncoding: ctx.contentEncoding,
        bodyB64: b64,
        truncated,
      })
    },
    async onResponseBody(ctx: ResponseBodyContext) {
      if (!sampleBodies) return
      if (!shouldRecordHost(ctx.url.hostname)) return
      const { b64, truncated } = truncateBody(ctx.body)
      await write({
        ...baseRecord('responseBody'),
        id: ctx.id,
        url: ctx.url.toString(),
        method: ctx.method,
        statusCode: ctx.statusCode,
        contentType: ctx.contentType,
        contentEncoding: ctx.contentEncoding,
        bodyB64: b64,
        truncated,
      })
    },
    onError(err, ctx) {
      const anyCtx: any = ctx || {}
      const host = anyCtx.url?.hostname || anyCtx.hostname
      if (host && !shouldRecordHost(host)) return
      void write({
        ...baseRecord('error'),
        id: anyCtx.id,
        message: toErrorString(err),
      })
    },
  }

  async function close() {
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve())
      stream.on('error', reject)
    })
  }

  return { plugin, close }
}

function ensureDirSync(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function sanitizeHosts(hosts?: string[] | string | null): Set<string> | null {
  if (!hosts) return null
  const arr = Array.isArray(hosts) ? hosts : String(hosts).split(',')
  const set = new Set<string>()
  for (const h of arr) {
    const v = h.trim().toLowerCase()
    if (v) set.add(v)
  }
  return set.size ? set : null
}

function toErrorString(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  try { return JSON.stringify(err) } catch { return String(err) }
}

// High-level API: create and start a MitmProxyServer with the recorder plugin attached
export type RecorderServerOptions = {
  host?: string
  port?: number
  ca?: CertificateAuthority
  ensureCA?: boolean // default: true (generate/load CA)
  installTrust?: boolean // default: false (side-effectful)
  proxyPlugins?: ProxyPlugin[] // additional plugins to attach after recorder
  recorder?: TrafficRecorderOptions // options forwarded to createTrafficRecorder
}

export type RecorderServer = {
  server: MitmProxyServer
  recorder: TrafficRecorder
  host: string
  port: number
  close: () => Promise<void>
}

export async function startRecorderProxy(options: RecorderServerOptions = {}): Promise<RecorderServer> {
  const ca = options.ca ?? new CertificateAuthority()
  if (options.ensureCA !== false) {
    await ca.ensureRootCA()
  }
  if (options.installTrust) {
    try { await installRootCATrust() } catch {}
  }

  const recorder = createTrafficRecorder(options.recorder)
  const plugins: ProxyPlugin[] = [recorder.plugin, ...(options.proxyPlugins ?? [])]
  const server = new MitmProxyServer({ host: options.host, port: options.port, ca, plugins })
  const { host, port } = await server.start()

  return {
    server,
    recorder,
    host,
    port,
    close: async () => {
      try { await server.stop() } catch {}
      try { await recorder.close() } catch {}
    },
  }
}
