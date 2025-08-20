import type {
  ProxyPlugin,
  RequestContext,
  ResponseContext,
  RequestBodyContext,
  ResponseBodyContext,
} from '@arachne/proxy'

export interface RecorderOptions {
  storage?: StorageAdapter
  captureBodies?: boolean
  maxCaptureBytes?: number // default 1MB
  normalizePaths?: boolean
}

export interface InventoryTree {
  domains: Record<string, DomainRecord>
}

export interface DomainRecord {
  domain: string
  subdomains: Record<string, SubdomainRecord>
}

export interface SubdomainRecord {
  subdomain: string
  endpoints: Record<string, EndpointRecord>
}

// Legacy interface for backward compatibility
export interface HostRecord {
  host: string
  endpoints: Record<string, EndpointRecord>
}

export interface EndpointRecord {
  method: string
  path: string
  hits: number
  firstSeen: string // ISO
  lastSeen: string // ISO
  queryKeys: string[]
  requestHeaderNames: string[]
  responseHeaderNames: string[]
  statusCodes: number[]
  requestContentTypes: string[]
  responseContentTypes: string[]
  // Optional, present only if bodies were captured
  sampleRequestBody?: string
  sampleResponseBody?: string
}

export interface StorageAdapter {
  recordRequest(ctx: RequestContext): void
  recordResponse(ctx: ResponseContext): void
  recordRequestBody?(ctx: RequestBodyContext, sample: string): void
  recordResponseBody?(ctx: ResponseBodyContext, sample: string): void
  snapshot(): InventoryTree
  reset?(): void
}

export type { ProxyPlugin, RequestContext, ResponseContext, RequestBodyContext, ResponseBodyContext }
