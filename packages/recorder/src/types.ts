import type {
    ProxyPlugin,
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
    WebSocketUpgradeContext,
    WebSocketMessageContext,
    WebSocketCloseContext,
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
    websockets: Record<string, WebSocketConnectionRecord>
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

export interface WebSocketConnectionRecord {
    id: string
    url: string
    protocols: string[]
    startTime: string // ISO
    endTime?: string // ISO
    state: 'open' | 'closed'
    messageCount: number
    messages: WebSocketMessageRecord[]
}

export interface WebSocketMessageRecord {
    id: string
    timestamp: string // ISO
    direction: 'client-to-server' | 'server-to-client'
    messageType: 'text' | 'binary' | 'ping' | 'pong' | 'close'
    size: number
    payload?: string // text content or base64 for binary
}

export interface StorageAdapter {
    recordRequest(ctx: RequestContext): void
    recordResponse(ctx: ResponseContext): void
    recordRequestBody?(ctx: RequestBodyContext, sample: string): void
    recordResponseBody?(ctx: ResponseBodyContext, sample: string): void
    
    // WebSocket recording methods
    recordWebSocketUpgrade?(ctx: WebSocketUpgradeContext): void
    recordWebSocketMessage?(ctx: WebSocketMessageContext, sample: string): void
    recordWebSocketClose?(ctx: WebSocketCloseContext): void
    
    snapshot(): InventoryTree
    reset?(): void
}

export type {
    ProxyPlugin,
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
    WebSocketUpgradeContext,
    WebSocketMessageContext,
    WebSocketCloseContext,
}
