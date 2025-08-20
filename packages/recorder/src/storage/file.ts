import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type {
  StorageAdapter,
  InventoryTree,
  DomainRecord,
  SubdomainRecord,
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

interface MutableSubdomainAggregate {
  subdomain: string
  endpoints: Map<EndpointKey, MutableEndpointAggregate>
}

interface MutableDomainAggregate {
  domain: string
  subdomains: Map<string, MutableSubdomainAggregate>
}

export class FileStorageAdapter implements StorageAdapter {
  private domains = new Map<string, MutableDomainAggregate>()
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
    this.domains.clear()
  }

  snapshot(): InventoryTree {
    const domainsObj: InventoryTree['domains'] = {}
    for (const [domain, agg] of this.domains) {
      domainsObj[domain] = this.serializeDomainAggregate(agg)
    }
    return { domains: domainsObj }
  }

  recordRequest(ctx: RequestContext): void {
    const now = Date.now()
    const host = ctx.url.hostname
    const { domain, subdomain } = this.parseDomainInfo(host)
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(domain, subdomain, method, path)
    ep.hits += 1
    ep.lastSeen = now
    if (ep.firstSeen === 0) ep.firstSeen = now

    for (const key of ctx.url.searchParams.keys()) ep.queryKeys.add(key)
    for (const name of Object.keys(ctx.headers || {})) ep.requestHeaderNames.add(name.toLowerCase())
    const ct = headerToString((ctx.headers as any)?.['content-type'])
    if (ct) ep.requestContentTypes.add(ct.toLowerCase())

    void this.enqueueWriteDomain(domain)
  }

  recordResponse(ctx: ResponseContext): void {
    const host = ctx.url.hostname
    const { domain, subdomain } = this.parseDomainInfo(host)
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(domain, subdomain, method, path)
    ep.statusCodes.add(ctx.statusCode || 0)
    for (const name of Object.keys(ctx.responseHeaders || {})) ep.responseHeaderNames.add(name.toLowerCase())
    const ct = headerToString((ctx.responseHeaders as any)?.['content-type'])
    if (ct) ep.responseContentTypes.add(ct.toLowerCase())

    void this.enqueueWriteDomain(domain)
  }

  recordRequestBody(ctx: RequestBodyContext, sample: string): void {
    const host = ctx.url.hostname
    const { domain, subdomain } = this.parseDomainInfo(host)
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(domain, subdomain, method, path)
    if (ep.sampleRequestBody === undefined) ep.sampleRequestBody = this.limitSample(sample)

    void this.enqueueWriteDomain(domain)
  }

  recordResponseBody(ctx: ResponseBodyContext, sample: string): void {
    const host = ctx.url.hostname
    const { domain, subdomain } = this.parseDomainInfo(host)
    const path = this.normalizePaths ? normalizePath(ctx.url.pathname) : ctx.url.pathname
    const method = (ctx.method || 'GET').toUpperCase()
    const ep = this.getEndpoint(domain, subdomain, method, path)
    if (ep.sampleResponseBody === undefined) ep.sampleResponseBody = this.limitSample(sample)

    void this.enqueueWriteDomain(domain)
  }

  private limitSample(s: string): string {
    if (s.length <= this.maxCaptureBytes) return s
    return s.slice(0, this.maxCaptureBytes)
  }

  private parseDomainInfo(host: string): { domain: string; subdomain: string } {
    const parts = host.split('.')
    if (parts.length <= 2) {
      // Direct domain like example.com or localhost
      return { domain: host, subdomain: 'www' }
    }
    
    // For subdomains like api.example.com or dev.api.example.com
    // Take the last two parts as the root domain
    const domain = parts.slice(-2).join('.')
    const subdomain = parts.slice(0, -2).join('.')
    
    return { domain, subdomain: subdomain || 'www' }
  }

  private getEndpoint(domain: string, subdomain: string, method: string, path: string): MutableEndpointAggregate {
    let domainAgg = this.domains.get(domain)
    if (!domainAgg) {
      domainAgg = { domain, subdomains: new Map() }
      this.domains.set(domain, domainAgg)
    }
    
    let subdomainAgg = domainAgg.subdomains.get(subdomain)
    if (!subdomainAgg) {
      subdomainAgg = { subdomain, endpoints: new Map() }
      domainAgg.subdomains.set(subdomain, subdomainAgg)
    }
    
    const key: EndpointKey = `${method} ${path}`
    let ep = subdomainAgg.endpoints.get(key)
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
      subdomainAgg.endpoints.set(key, ep)
    }
    return ep
  }

  private serializeDomainAggregate(agg: MutableDomainAggregate): DomainRecord {
    const subdomainsObj: DomainRecord['subdomains'] = {}
    for (const [subdomain, subAgg] of agg.subdomains) {
      subdomainsObj[subdomain] = this.serializeSubdomainAggregate(subAgg)
    }
    return { domain: agg.domain, subdomains: subdomainsObj }
  }

  private serializeSubdomainAggregate(agg: MutableSubdomainAggregate): SubdomainRecord {
    const endpointsObj: SubdomainRecord['endpoints'] = {}
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
    return { subdomain: agg.subdomain, endpoints: endpointsObj }
  }

  private async enqueueWriteDomain(domain: string): Promise<void> {
    const prev = this.writeChains.get(domain) || Promise.resolve()
    const next = prev.then(async () => {
      const agg = this.domains.get(domain)
      if (!agg) return
      const domainRecord = this.serializeDomainAggregate(agg)
      const dir = this.outDir
      const file = path.join(dir, sanitizeFilename(domain) + '.json')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(file, JSON.stringify(domainRecord, null, 2), 'utf8')
    }).catch(() => { /* swallow to keep chain alive */ })
    this.writeChains.set(domain, next)
    await next
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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}
