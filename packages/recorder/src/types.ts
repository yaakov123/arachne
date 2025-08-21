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
  hosts: Record<string, HostRecord>
}

export interface HostRecord {
  host: string
  endpoints: Record<string, EndpointRecord>
}

export interface KeyValue {
  key: string
  value: string
}

export interface InteractionRecord {
  id: string
  timestamp: string // ISO
  request: {
    query: KeyValue[]
    headers: KeyValue[]
    body?: string
  }
  response?: {
    statusCode?: number
    headers: KeyValue[]
    body?: string
  }
}

export interface EndpointRecord {
  method: string
  path: string
  hits: number
  firstSeen: string // ISO
  lastSeen: string // ISO
  interactions: InteractionRecord[]
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
