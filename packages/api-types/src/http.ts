import type { TransactionData, TransactionCompleteEvent } from './ws'

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
    message: string
    serverInfo?: {
        host: string
        port: number
    }
}

export interface ProxyStopResponse {
    message: string
}

export interface ProxyStatusResponse {
    isRunning: boolean
    serverInfo?: {
        host: string
        port: number
    }
}

export interface ProxyErrorResponse {
    error: string
    message: string
}

// Certificate Authority management responses
export interface CACreateResponse {
    message: string
    certPem?: string
}

export interface CATrustResponse {
    message: string
    code?: number | null
}

export interface CAErrorResponse {
    error: string
    message: string
}

export interface CATrustInstructionsResponse {
    trustCommand: string
    untrustCommands: string[]
    certPath: string
}

export interface CAStatusResponse {
    exists: boolean
    message: string
}

// Repeater functionality types
export interface RepeatRequestBody {
    originalTransactionId: string
    transaction: TransactionData
}

export interface RepeatResponse {
    message: string
    error?: string
}

// Project management types
export interface ProjectMetadata {
    id: string
    name: string
    description?: string
    createdAt: string // ISO timestamp
    updatedAt: string // ISO timestamp
    tags?: string[]
    settings?: {
        maxTransactions?: number
        retentionDays?: number
        hostFilter?: string[]
        hostFilterMode?: 'blacklist' | 'whitelist'
        maxBodySize?: number // in bytes
    }
}

export interface ProjectInfo {
    metadata: ProjectMetadata
    transactionCount: number
    sizeBytes: number
    lastActivity?: string // ISO timestamp
}

export interface CreateProjectRequest {
    name: string
    description?: string
    tags?: string[]
    settings?: ProjectMetadata['settings']
}

export interface UpdateProjectRequest {
    name?: string
    description?: string
    tags?: string[]
    settings?: ProjectMetadata['settings']
}

export interface ProjectListResponse {
    projects: []
}

export interface ProjectResponse {
    project: ProjectInfo
}

export interface ProjectCreateResponse {
    project: ProjectInfo
    message: string
}

export interface ProjectErrorResponse {
    error: string
    message: string
}

export interface ProjectCurrentResponse {
    currentProject: string | null
    project?: ProjectInfo
    message?: string
}

export interface ProjectActivateResponse {
    message: string
    currentProject: string | null
}

export interface ProjectTransactionsResponse {
    transactions: TransactionCompleteEvent[]
    total: number
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
    caStatus: `${API_PREFIX}/ca/status`,
    caCreate: `${API_PREFIX}/ca/create`,
    caTrust: `${API_PREFIX}/ca/trust`,
    caUntrust: `${API_PREFIX}/ca/untrust`,
    caTrustInstructions: `${API_PREFIX}/ca/trust-instructions`,
    // Repeater functionality
    repeaterSend: `${API_PREFIX}/repeater/send`,
    // Project management
    projects: `${API_PREFIX}/projects`,
    project: (id: string) => `${API_PREFIX}/projects/${encodeURIComponent(id)}`,
    projectTransactions: (id: string) =>
        `${API_PREFIX}/projects/${encodeURIComponent(id)}/transactions`,
    projectCurrent: `${API_PREFIX}/projects/current`,
    projectActivate: (id: string) =>
        `${API_PREFIX}/projects/${encodeURIComponent(id)}/activate`,
} as const
