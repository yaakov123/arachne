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

export interface MemoryAdapterOptions {
  normalizePaths?: boolean
  maxCaptureBytes?: number
}

type EndpointKey = string // `${method} ${path}`

interface MutableEndpointAggregate {
  method: string
  path: string
  hits: number
  firstSeen: number
  lastSeen: number
  queryKeys: Set<string>
  requestHeaderNames: Set<string>
  responseHeaderNames: Set<string>
  statusCodes: Set<number>
  requestContentTypes: Set<string>
  responseContentTypes: Set<string>
  sampleRequestBody?: string
  sampleResponseBody?: string
}

interface MutableHostAggregate {
  host: string
  endpoints: Map<EndpointKey, MutableEndpointAggregate>
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private hosts = new Map<string, MutableHostAggregate>()
  private normalizePaths: boolean
  private maxCaptureBytes: number

  constructor(opts: MemoryAdapterOptions = {}) {
    this.normalizePaths = !!opts.normalizePaths
    this.maxCaptureBytes = typeof opts.maxCaptureBytes === 'number' ? opts.maxCaptureBytes : 1024 * 1024
  }

  reset(): void { this.hosts.clear() }

  snapshot(): InventoryTree {
    const hostsObj: InventoryTree['hosts'] = {}
    for (const [host, agg] of this.hosts) {
      const endpointsObj: HostRecord['endpoints'] = {}
      for (const [key, ep] of agg.endpoints) {
        const rec: EndpointRecord = {
          method: ep.method,
          path: ep.path,
          hits: ep.hits,
          firstSeen: new Date(ep.firstSeen).toISOString(),
          lastSeen: new Date(ep.lastSeen).toISOString(),
          queryKeys: [...ep.queryKeys].sort(),
          requestHeaderNames: [...ep.requestHeaderNames].sort(),
          responseHeaderNames: [...ep.responseHeaderNames].sort(),
          statusCodes: [...ep.statusCodes].sort((a, b) => a - b),
          requestContentTypes: [...ep.requestContentTypes].sort(),
          responseContentTypes: [...ep.responseContentTypes].sort(),
        }
        if (ep.sampleRequestBody !== undefined) rec.sampleRequestBody = ep.sampleRequestBody
        if (ep.sampleResponseBody !== undefined) rec.sampleResponseBody = ep.sampleResponseBody
        endpointsObj[key] = rec
      }
      hostsObj[host] = { host, endpoints: endpointsObj }
    }
    return { hosts: hostsObj }
  }

  recordRequest(ctx: RequestContext): void {
    const now = Date.now()
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(host, method, path)
    ep.hits += 1
    ep.lastSeen = now
    if (ep.firstSeen === 0) ep.firstSeen = now

    // Query keys
    for (const key of ctx.url.searchParams.keys()) ep.queryKeys.add(key)

    // Request header names
    for (const name of Object.keys(ctx.headers || {})) ep.requestHeaderNames.add(name.toLowerCase())

    // Request content type
    const ct = headerToString(ctx.headers?.['content-type'] as any)
    if (ct) ep.requestContentTypes.add(ct.toLowerCase())
  }

  recordResponse(ctx: ResponseContext): void {
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(host, method, path)
    ep.statusCodes.add(ctx.statusCode || 0)

    // Response header names
    for (const name of Object.keys(ctx.responseHeaders || {})) ep.responseHeaderNames.add(name.toLowerCase())

    // Response content type
    const ct = headerToString((ctx.responseHeaders as any)?.['content-type'])
    if (ct) ep.responseContentTypes.add(ct.toLowerCase())
  }

  recordRequestBody(ctx: RequestBodyContext, sample: string): void {
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(host, method, path)
    if (ep.sampleRequestBody === undefined) ep.sampleRequestBody = this.limitSample(sample)
  }

  recordResponseBody(ctx: ResponseBodyContext, sample: string): void {
    const host = ctx.url.hostname
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(host, method, path)
    if (ep.sampleResponseBody === undefined) ep.sampleResponseBody = this.limitSample(sample)
  }

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
      ep = {
        method,
        path,
        hits: 0,
        firstSeen: 0,
        lastSeen: 0,
        queryKeys: new Set(),
        requestHeaderNames: new Set(),
        responseHeaderNames: new Set(),
        statusCodes: new Set(),
        requestContentTypes: new Set(),
        responseContentTypes: new Set(),
      }
      hostAgg.endpoints.set(key, ep)
    }
    return ep
  }
}

function headerToString(h: string | string[] | undefined): string | undefined {
  if (typeof h === 'string') return h
  if (Array.isArray(h)) return h[0]
  return undefined
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
