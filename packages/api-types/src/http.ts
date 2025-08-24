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

// Proxy management responses
export interface ProxyStartResponse {
  ok: boolean
  message: string
  serverInfo?: {
    host: string
    port: number
  }
}

export interface ProxyStopResponse {
  ok: boolean
  message: string
}

export interface ProxyStatusResponse {
  ok: boolean
  isRunning: boolean
  serverInfo?: {
    host: string
    port: number
  }
}

export interface ProxyErrorResponse {
  ok: false
  error: string
  message: string
}

// Certificate Authority management responses
export interface CACreateResponse {
  ok: boolean
  message: string
  certPem?: string
}

export interface CATrustResponse {
  ok: boolean
  message: string
  code?: number | null
}

export interface CAErrorResponse {
  ok: false
  error: string
  message: string
}

export const HttpRoutes = {
  health: '/health',
  inventory: `${API_PREFIX}/inventory`,
  hosts: `${API_PREFIX}/hosts`,
  host: (host: string) => `${API_PREFIX}/hosts/${encodeURIComponent(host)}`,
  cert: `${API_PREFIX}/cert`,
  // Proxy management
  proxyStart: `${API_PREFIX}/proxy/start`,
  proxyStop: `${API_PREFIX}/proxy/stop`,
  proxyStatus: `${API_PREFIX}/proxy/status`,
  // Certificate Authority management
  caCreate: `${API_PREFIX}/ca/create`,
  caTrust: `${API_PREFIX}/ca/trust`,
  caUntrust: `${API_PREFIX}/ca/untrust`,
} as const
