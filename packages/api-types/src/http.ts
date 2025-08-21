export const API_PREFIX = '/api'

// HTTP response shapes
export interface HealthResponse {
  ok: true
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

export interface HostRecord {
  host: string
  endpoints: Record<string, EndpointRecord>
}

export interface InventoryTree {
  hosts: Record<string, HostRecord>
}

export interface CertResponse {
  pem: string
}

export const HttpRoutes = {
  health: '/health',
  inventory: `${API_PREFIX}/inventory`,
  hosts: `${API_PREFIX}/hosts`,
  host: (host: string) => `${API_PREFIX}/hosts/${encodeURIComponent(host)}`,
  cert: `${API_PREFIX}/cert`,
} as const
