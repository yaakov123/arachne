import type { IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import WebSocket, { WebSocketServer } from 'ws'
import type { PluginManager } from '../proxy/plugin-manager.js'
import type { 
    WebSocketUpgradeContext, 
    WebSocketMessageContext, 
    WebSocketCloseContext 
} from '../plugins/types.js'
import type { 
    WebSocketConnection, 
    WebSocketUpgradeRequest, 
    WebSocketHandlerOptions 
} from './types.js'
import {
    isWebSocketUpgrade,
    extractWebSocketProtocols,
    extractWebSocketExtensions,
    generateConnectionId,
    buildUpstreamWebSocketUrl,
    shouldIgnoreHost,
    bufferToText
} from './utils.js'
import { logger } from '../logger.js'

export class WebSocketHandler {
    private connections = new Map<string, WebSocketConnection>()
    private wss: WebSocketServer
    private cleanupInterval?: NodeJS.Timeout

    constructor(
        private pluginManager: PluginManager,
        private handleError: (err: unknown, ctx: any) => void,
        private options: WebSocketHandlerOptions = {}
    ) {
        this.wss = new WebSocketServer({ noServer: true })
        this.startCleanupInterval()
    }

    /**
     * Handles WebSocket upgrade requests
     */
    async handleWebSocketUpgrade(
        req: IncomingMessage,
        clientSocket: Socket,
        head: Buffer
    ): Promise<void> {
        try {
            const upgradeRequest = this.parseUpgradeRequest(req, clientSocket, head)
            
            // Check if host should be ignored
            if (shouldIgnoreHost(upgradeRequest.url.hostname, this.options.ignoredHosts)) {
                logger.debug('Ignoring WebSocket upgrade for host', {
                    component: 'websocket-handler',
                    hostname: upgradeRequest.url.hostname
                })
                this.forwardDirectly(upgradeRequest)
                return
            }

            const connection = await this.createConnection(upgradeRequest)
            
            // Create plugin context
            const upgradeContext = this.createUpgradeContext(connection, req)
            
            // Run plugin hooks
            await this.runPluginHook('onWebSocketUpgrade', upgradeContext)
            
            // Establish upstream connection
            await this.establishUpstreamConnection(connection)
            
            // Handle client upgrade
            await this.handleClientUpgrade(connection, upgradeRequest)
            
            logger.info('WebSocket connection established', {
                component: 'websocket-handler',
                connectionId: connection.id,
                url: connection.url.toString(),
                protocols: connection.protocols
            })

        } catch (error) {
            logger.error('Failed to handle WebSocket upgrade', error, {
                component: 'websocket-handler',
                url: req.url,
                host: req.headers.host
            })
            this.handleError(error, { url: req.url, host: req.headers.host })
            this.sendUpgradeError(clientSocket)
        }
    }

    /**
     * Parses the WebSocket upgrade request
     */
    private parseUpgradeRequest(
        req: IncomingMessage, 
        clientSocket: Socket, 
        head: Buffer
    ): WebSocketUpgradeRequest {
        if (!isWebSocketUpgrade(req)) {
            throw new Error('Not a valid WebSocket upgrade request')
        }

        const isHttps = (clientSocket as any).encrypted === true
        const url = buildUpstreamWebSocketUrl(req, isHttps)

        return {
            request: req,
            clientSocket,
            head,
            url,
            isHttps
        }
    }

    /**
     * Creates a new WebSocket connection object
     */
    private async createConnection(upgradeRequest: WebSocketUpgradeRequest): Promise<WebSocketConnection> {
        const id = generateConnectionId()
        const protocols = extractWebSocketProtocols(upgradeRequest.request)
        const extensions = extractWebSocketExtensions(upgradeRequest.request)

        const connection: WebSocketConnection = {
            id,
            clientSocket: upgradeRequest.clientSocket,
            state: 'connecting',
            lastActivity: Date.now(),
            url: upgradeRequest.url,
            protocols,
            extensions,
            isHttps: upgradeRequest.isHttps,
            startTime: Date.now()
        }

        this.connections.set(id, connection)
        return connection
    }

    /**
     * Establishes connection to upstream WebSocket server
     */
    private async establishUpstreamConnection(connection: WebSocketConnection): Promise<void> {
        return new Promise((resolve, _reject) => {
            const upstreamWs = new WebSocket(connection.url.toString(), connection.protocols)
            
            const timeout = setTimeout(() => {
                _reject(new Error('Upstream WebSocket connection timeout'))
            }, this.options.connectionTimeout || 10000)

            upstreamWs.on('open', () => {
                clearTimeout(timeout)
                connection.upstreamWs = upstreamWs
                this.setupUpstreamListeners(connection)
                resolve()
            })

            upstreamWs.on('error', (error) => {
                clearTimeout(timeout)
                _reject(error)
            })
        })
    }

    /**
     * Handles the client-side WebSocket upgrade
     */
    private async handleClientUpgrade(
        connection: WebSocketConnection, 
        upgradeRequest: WebSocketUpgradeRequest
    ): Promise<void> {
        return new Promise((resolve, _reject) => {
            this.wss.handleUpgrade(
                upgradeRequest.request,
                upgradeRequest.clientSocket,
                upgradeRequest.head,
                (clientWs) => {
                    connection.clientWs = clientWs
                    connection.state = 'open'
                    this.setupClientListeners(connection)
                    resolve()
                }
            )
        })
    }

    /**
     * Sets up event listeners for the client WebSocket
     */
    private setupClientListeners(connection: WebSocketConnection): void {
        if (!connection.clientWs) return

        connection.clientWs.on('message', async (data, isBinary) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
            await this.handleMessage(connection, buffer, isBinary, 'client-to-server')
        })

        connection.clientWs.on('ping', async (data) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
            await this.handleMessage(connection, buffer, false, 'client-to-server', 'ping')
        })

        connection.clientWs.on('pong', async (data) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
            await this.handleMessage(connection, buffer, false, 'client-to-server', 'pong')
        })

        connection.clientWs.on('close', async (code, reason) => {
            const reasonString = Buffer.isBuffer(reason) ? reason.toString() : reason
            await this.handleClose(connection, code, reasonString)
        })

        connection.clientWs.on('error', (error) => {
            this.handleError(error, { connectionId: connection.id, side: 'client' })
        })
    }

    /**
     * Sets up event listeners for the upstream WebSocket
     */
    private setupUpstreamListeners(connection: WebSocketConnection): void {
        if (!connection.upstreamWs) return

        connection.upstreamWs.on('message', async (data, isBinary) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
            await this.handleMessage(connection, buffer, isBinary, 'server-to-client')
        })

        connection.upstreamWs.on('ping', async (data) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
            await this.handleMessage(connection, buffer, false, 'server-to-client', 'ping')
        })

        connection.upstreamWs.on('pong', async (data) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
            await this.handleMessage(connection, buffer, false, 'server-to-client', 'pong')
        })

        connection.upstreamWs.on('close', async (code, reason) => {
            const reasonString = Buffer.isBuffer(reason) ? reason.toString() : reason
            await this.handleClose(connection, code, reasonString)
        })

        connection.upstreamWs.on('error', (error) => {
            this.handleError(error, { connectionId: connection.id, side: 'upstream' })
        })
    }

    /**
     * Handles WebSocket messages and forwards them
     */
    private async handleMessage(
        connection: WebSocketConnection,
        data: Buffer,
        isBinary: boolean,
        direction: 'client-to-server' | 'server-to-client',
        messageType?: 'ping' | 'pong'
    ): Promise<void> {
        try {
            connection.lastActivity = Date.now()
            
            const type = messageType || (isBinary ? 'binary' : 'text')
            const textContent = type === 'text' ? bufferToText(data) : undefined

            // Create message context for plugins
            const messageContext = this.createMessageContext(
                connection,
                data,
                direction,
                type,
                textContent
            )

            // Run plugin hooks
            await this.runPluginHook('onWebSocketMessage', messageContext)

            // Forward message to the other side
            const targetWs = direction === 'client-to-server' 
                ? connection.upstreamWs 
                : connection.clientWs

            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                if (messageType === 'ping') {
                    targetWs.ping(data)
                } else if (messageType === 'pong') {
                    targetWs.pong(data)
                } else {
                    targetWs.send(data, { binary: isBinary })
                }
            }

        } catch (error) {
            this.handleError(error, { 
                connectionId: connection.id, 
                direction, 
                messageType: messageType || (isBinary ? 'binary' : 'text')
            })
        }
    }

    /**
     * Handles WebSocket connection close
     */
    private async handleClose(
        connection: WebSocketConnection,
        code?: number,
        reason?: string
    ): Promise<void> {
        try {
            connection.state = 'closed'
            connection.endTime = Date.now()

            // Create close context for plugins
            const closeContext = this.createCloseContext(connection, code, reason)
            
            // Run plugin hooks
            await this.runPluginHook('onWebSocketClose', closeContext)

            // Close both sides
            if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
                connection.clientWs.close(code, reason)
            }
            if (connection.upstreamWs && connection.upstreamWs.readyState === WebSocket.OPEN) {
                connection.upstreamWs.close(code, reason)
            }

            // Clean up connection
            this.connections.delete(connection.id)

            logger.info('WebSocket connection closed', {
                component: 'websocket-handler',
                connectionId: connection.id,
                code,
                reason,
                duration: connection.endTime - connection.startTime
            })

        } catch (error) {
            this.handleError(error, { connectionId: connection.id, code, reason })
        }
    }

    /**
     * Creates upgrade context for plugins
     */
    private createUpgradeContext(
        connection: WebSocketConnection,
        req: IncomingMessage
    ): WebSocketUpgradeContext {
        return {
            id: connection.id,
            isHttps: connection.isHttps,
            url: connection.url,
            method: req.method || 'GET',
            headers: req.headers as Record<string, string | string[]>,
            clientIp: req.socket.remoteAddress,
            protocols: connection.protocols,
            extensions: connection.extensions
        }
    }

    /**
     * Creates message context for plugins
     */
    private createMessageContext(
        connection: WebSocketConnection,
        payload: Buffer,
        direction: 'client-to-server' | 'server-to-client',
        messageType: 'text' | 'binary' | 'ping' | 'pong' | 'close',
        textContent?: string
    ): WebSocketMessageContext {
        return {
            id: connection.id,
            connectionId: connection.id,
            isHttps: connection.isHttps,
            url: connection.url,
            method: 'GET',
            headers: {},
            protocols: connection.protocols,
            extensions: connection.extensions,
            direction,
            messageType,
            payload,
            textContent,
            timestamp: Date.now()
        }
    }

    /**
     * Creates close context for plugins
     */
    private createCloseContext(
        connection: WebSocketConnection,
        code?: number,
        reason?: string
    ): WebSocketCloseContext {
        return {
            id: connection.id,
            connectionId: connection.id,
            isHttps: connection.isHttps,
            url: connection.url,
            method: 'GET',
            headers: {},
            protocols: connection.protocols,
            extensions: connection.extensions,
            code,
            reason,
            timestamp: Date.now()
        }
    }

    /**
     * Runs a plugin hook safely
     */
    private async runPluginHook<K extends keyof Pick<import('../plugins/types.js').ProxyPlugin, 'onWebSocketUpgrade' | 'onWebSocketMessage' | 'onWebSocketClose'>>(
        hook: K,
        context: any
    ): Promise<void> {
        try {
            if (this.pluginManager.hasHook(hook)) {
                await this.pluginManager.runHook(hook, context)
            }
        } catch (error) {
            this.handleError(error, context)
        }
    }

    /**
     * Forwards the connection directly without MITM (for ignored hosts)
     */
    private forwardDirectly(upgradeRequest: WebSocketUpgradeRequest): void {
        // TODO: Implement direct forwarding for ignored hosts
        // For now, just close the connection
        upgradeRequest.clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    }

    /**
     * Sends an error response for failed upgrades
     */
    private sendUpgradeError(clientSocket: Socket): void {
        try {
            if (!clientSocket.destroyed && clientSocket.writable) {
                clientSocket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n')
            }
        } catch (error) {
            logger.error('Failed to send upgrade error response', error, {
                component: 'websocket-handler'
            })
        }
    }

    /**
     * Starts the cleanup interval for stale connections
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleConnections()
        }, 30000) // Clean up every 30 seconds
    }

    /**
     * Cleans up stale connections
     */
    private cleanupStaleConnections(): void {
        const now = Date.now()
        const timeout = 300000 // 5 minutes

        for (const [id, connection] of this.connections) {
            if (now - connection.lastActivity > timeout) {
                logger.warn('Cleaning up stale WebSocket connection', {
                    component: 'websocket-handler',
                    connectionId: id,
                    lastActivity: connection.lastActivity
                })
                
                this.handleClose(connection, 1001, 'Connection timeout')
            }
        }
    }

    /**
     * Gets the current number of active connections
     */
    getActiveConnectionCount(): number {
        return this.connections.size
    }

    /**
     * Gets connection details by ID
     */
    getConnection(id: string): WebSocketConnection | undefined {
        return this.connections.get(id)
    }

    /**
     * Stops the WebSocket handler and cleans up resources
     */
    async stop(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
        }

        // Close all active connections
        const closePromises = Array.from(this.connections.values()).map(connection =>
            this.handleClose(connection, 1001, 'Server shutdown')
        )

        await Promise.all(closePromises)
        this.connections.clear()

        logger.info('WebSocket handler stopped', {
            component: 'websocket-handler'
        })
    }
}
