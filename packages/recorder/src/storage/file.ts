import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type {
  StorageAdapter,
  InventoryTree,
  HostRecord,
  EndpointRecord,
  RequestContext,
  ResponseContext,
  RequestBodyContext,
  ResponseBodyContext,
} from '../types.js'

export interface FileAdapterOptions {
  outDir?: string // defaults to ~/.arachne/recorder
  normalizePaths?: boolean
  maxCaptureBytes?: number
}

type EndpointKey = string // `${method} ${path}`

interface MutableInteraction {
  id: string
  timestamp: number
  request: {
    query: { key: string; value: string }[]
    headers: { key: string; value: string }[]
    body?: string
  }
  response?: {
    statusCode?: number
    headers: { key: string; value: string }[]
    body?: string
  }
}

interface MutableEndpointAggregate {
  method: string
  path: string
  hits: number
  firstSeen: number
  lastSeen: number
  // Per-request interactions
  interactions: Map<string, MutableInteraction>
}

interface MutableHostAggregate {
  host: string
  endpoints: Map<EndpointKey, MutableEndpointAggregate>
}

export class FileStorageAdapter implements StorageAdapter {
  private hosts = new Map<string, MutableHostAggregate>()
  private normalizePaths: boolean
  private maxCaptureBytes: number
  private outDir: string
  private writeChains = new Map<string, Promise<void>>()

  constructor(opts: FileAdapterOptions = {}) {
    this.normalizePaths = !!opts.normalizePaths
    this.maxCaptureBytes = typeof opts.maxCaptureBytes === 'number' ? opts.maxCaptureBytes : 1024 * 1024
    const home = os.homedir() || '.'
    this.outDir = opts.outDir || path.join(home, '.arachne', 'recorder')
  }

  reset(): void {
    this.hosts.clear()
  }

  snapshot(): InventoryTree {
    const hostsObj: InventoryTree['hosts'] = {}
    for (const [host, agg] of this.hosts) {
      hostsObj[host] = this.serializeHostAggregate(agg)
    }
    return { hosts: hostsObj }
  }

  recordRequest(ctx: RequestContext): void {
    const now = Date.now()
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    if (method === 'OPTIONS') return
    const ep = this.getEndpoint(host, method, path)
    ep.hits += 1
    ep.lastSeen = now
    if (ep.firstSeen === 0) ep.firstSeen = now

    // Create/ensure interaction and capture per-request metadata
    const interaction = this.ensureInteraction(ep, ctx, now)
    if (interaction.request.query.length === 0) interaction.request.query = this.searchParamsToPairs(ctx.url.searchParams)
    if (interaction.request.headers.length === 0) interaction.request.headers = this.headersToPairs(ctx.headers || {})

    void this.enqueueWriteHost(host)
  }

  recordResponse(ctx: ResponseContext): void {
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    if (method === 'OPTIONS') return
    const ep = this.getEndpoint(host, method, path)

    // Update interaction with response metadata
    const interaction = this.ensureInteraction(ep, ctx, Date.now())
    interaction.response = interaction.response || { headers: [] }
    interaction.response.statusCode = ctx.statusCode
    interaction.response.headers = this.headersToPairs(ctx.responseHeaders || {})

    void this.enqueueWriteHost(host)
  }

  recordRequestBody(ctx: RequestBodyContext, sample: string): void {
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(host, method, path)
    // Attach body to the corresponding interaction
    const interaction = this.ensureInteraction(ep, ctx, Date.now())
    interaction.request.body = this.limitSample(sample)

    void this.enqueueWriteHost(host)
  }

  recordResponseBody(ctx: ResponseBodyContext, sample: string): void {
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(host, method, path)
    // Attach body to the corresponding interaction
    const interaction = this.ensureInteraction(ep, ctx, Date.now())
    interaction.response = interaction.response || { headers: [] }
    interaction.response.body = this.limitSample(sample)

    void this.enqueueWriteHost(host)
  }

  // Ensure a MutableInteraction exists for this endpoint and context id
  private ensureInteraction(ep: MutableEndpointAggregate, ctx: RequestContext, now: number): MutableInteraction {
    let it = ep.interactions.get(ctx.id)
    if (!it) {
      it = {
        id: ctx.id,
        timestamp: now,
        request: {
          query: this.searchParamsToPairs(ctx.url.searchParams),
          headers: this.headersToPairs(ctx.headers || {}),
        },
      }
      ep.interactions.set(ctx.id, it)
    }
    return it
  }

  private headersToPairs(headers: Record<string, string | string[]>): { key: string; value: string }[] {
    const pairs: { key: string; value: string }[] = []
    for (const [name, raw] of Object.entries(headers || {})) {
      const lname = name.toLowerCase()
      if (Array.isArray(raw)) {
        for (const v of raw) pairs.push({ key: lname, value: String(v) })
      } else if (raw !== undefined) {
        pairs.push({ key: lname, value: String(raw) })
      }
    }
    return pairs
  }

  private searchParamsToPairs(sp: URLSearchParams): { key: string; value: string }[] {
    const pairs: { key: string; value: string }[] = []
    for (const [k, v] of sp.entries()) pairs.push({ key: k, value: String(v) })
    return pairs
  }

  // (aggregated key-value maps removed)

  private limitSample(s: string): string {
    if (s.length <= this.maxCaptureBytes) return s
    return s.slice(0, this.maxCaptureBytes)
  }

  private getEndpoint(host: string, method: string, path: string): MutableEndpointAggregate {
    let hostAgg = this.hosts.get(host)
    if (!hostAgg) {
      hostAgg = { host, endpoints: new Map() }
      this.hosts.set(host, hostAgg)
    }
    const key: EndpointKey = `${method} ${path}`
    let ep = hostAgg.endpoints.get(key)
    if (!ep) {
      ep = { method, path, hits: 0, firstSeen: 0, lastSeen: 0, interactions: new Map() }
      hostAgg.endpoints.set(key, ep)
    }
    return ep
  }

  private serializeHostAggregate(agg: MutableHostAggregate): HostRecord {
    const endpointsObj: HostRecord['endpoints'] = {}
    for (const [key, ep] of agg.endpoints) {
      const rec: EndpointRecord = {
        method: ep.method,
        path: ep.path,
        hits: ep.hits,
        firstSeen: new Date(ep.firstSeen).toISOString(),
        lastSeen: new Date(ep.lastSeen).toISOString(),
        interactions: [...ep.interactions.values()]
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((i) => ({
            id: i.id,
            timestamp: new Date(i.timestamp).toISOString(),
            request: { ...i.request },
            response: i.response ? { ...i.response } : undefined,
          })),
      }
      endpointsObj[key] = rec
    }
    return { host: agg.host, endpoints: endpointsObj }
  }

  private async enqueueWriteHost(host: string): Promise<void> {
    const prev = this.writeChains.get(host) || Promise.resolve()
    const next = prev.then(async () => {
      const agg = this.hosts.get(host)
      if (!agg) return
      const hostRecord = this.serializeHostAggregate(agg)
      const dir = this.outDir
      const file = path.join(dir, sanitizeFilename(host) + '.json')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(file, JSON.stringify(hostRecord, null, 2), 'utf8')
    }).catch(() => { /* swallow to keep chain alive */ })
    this.writeChains.set(host, next)
    await next
  }
}

// Very lightweight path normalizer: numeric, UUIDv4, 24-hex -> {id}
function normalizePath(pathname: string): string {
  const segs = pathname.split('/').filter((s) => s.length > 0)
  const norm = segs.map((s) => (isLikelyId(s) ? '{id}' : s))
  return '/' + norm.join('/')
}

function isLikelyId(s: string): boolean {
  if (/^\d{2,}$/.test(s)) return true // long number
  if (/^[0-9a-fA-F]{24}$/.test(s)) return true // 24 hex
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return true // uuid v4
  return false
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}
