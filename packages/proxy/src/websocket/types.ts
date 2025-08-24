import type { IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import type WebSocket from 'ws'

export interface WebSocketConnection {
    id: string
    clientSocket: Socket
    clientWs?: WebSocket
    upstreamWs?: WebSocket
    state: 'connecting' | 'open' | 'closing' | 'closed'
    lastActivity: number
    url: URL
    protocols: string[]
    extensions: string[]
    isHttps: boolean
    startTime: number
    endTime?: number
}

export interface WebSocketUpgradeRequest {
    request: IncomingMessage
    clientSocket: Socket
    head: Buffer
    url: URL
    isHttps: boolean
}

export interface WebSocketFrame {
    opcode: number
    fin: boolean
    masked: boolean
    payload: Buffer
    payloadLength: number
}

export interface WebSocketHandlerOptions {
    ignoredHosts?: string[]
    maxConnections?: number
    connectionTimeout?: number
    pingInterval?: number
}
