import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import { CertificateAuthority } from '../certs/ca'
import type { CertStoreOptions } from '../certs/store'
import type { ProxyPlugin } from '../plugins/types'
import { PluginManager } from './plugin-manager'
import { TlsManager } from './tls-manager'
import { HttpHandler } from './http-handler'
import { ServerLifecycleManager, type ServerInfo } from './server-lifecycle'
import { WebSocketHandler } from '../websocket/handler.js'
import { isWebSocketUpgrade } from '../websocket/utils.js'
import { logger } from '../logger'

export interface ProxyOptions {
    host?: string
    port?: number
    ca?: CertificateAuthority
    certStore?: CertStoreOptions
    plugins?: ProxyPlugin[]
    ignoredHosts?: string[]
}

export class MitmProxyServer {
    private httpServer: http.Server
    private ca: CertificateAuthority
    private pluginManager: PluginManager
    private tlsManager: TlsManager
    private httpHandler: HttpHandler
    private webSocketHandler: WebSocketHandler
    private lifecycleManager: ServerLifecycleManager

    constructor(private opts: ProxyOptions = {}) {
        this.ca = opts.ca ?? new CertificateAuthority({ store: opts.certStore })
        this.pluginManager = new PluginManager(opts.plugins)
        
        this.httpHandler = new HttpHandler(
            this.pluginManager,
            this.handleError.bind(this),
            opts.ignoredHosts
        )
        
        this.tlsManager = new TlsManager(
            this.ca,
            this.pluginManager,
            this.httpHandler,
            this.handleError.bind(this),
            opts.ignoredHosts
        )
        
        this.webSocketHandler = new WebSocketHandler(
            this.pluginManager,
            this.handleError.bind(this),
            { ignoredHosts: opts.ignoredHosts }
        )

        this.httpServer = http.createServer((req, res) => {
            this.httpHandler.handleHttpRequest(req, res, false).catch((err) =>
                this.handleError(err, {})
            )
        })

        this.lifecycleManager = new ServerLifecycleManager(this.httpServer)

        // HTTPS tunneling via CONNECT and WebSocket upgrades
        this.httpServer.on(
            'connect',
            (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
                this.tlsManager.handleConnect(req, clientSocket, head).catch((err) =>
                    this.handleError(err, {})
                )
            }
        )

        // WebSocket upgrade handling
        this.httpServer.on(
            'upgrade',
            (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
                if (isWebSocketUpgrade(req)) {
                    this.webSocketHandler.handleWebSocketUpgrade(req, clientSocket, head).catch((err) =>
                        this.handleError(err, { url: req.url, host: req.headers.host })
                    )
                } else {
                    // Handle other upgrade requests
                    clientSocket.end('HTTP/1.1 501 Not Implemented\r\n\r\n')
                }
            }
        )

        this.httpServer.on('clientError', (err, socket) => {
            const socketInfo = {
                remoteAddress: (socket as any).remoteAddress,
                remotePort: (socket as any).remotePort,
                localAddress: (socket as any).localAddress,
                localPort: (socket as any).localPort,
                destroyed: socket.destroyed,
                readable: socket.readable,
                writable: socket.writable
            }
            
            logger.error('Client socket error on HTTP server', err, {
                component: 'proxy-server',
                socketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            try {
                if (!socket.destroyed && socket.writable) {
                    logger.debug('Sending 400 Bad Request to client socket', {
                        component: 'proxy-server',
                        remoteAddress: (socket as any).remoteAddress,
                        remotePort: (socket as any).remotePort
                    })
                    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
                } else {
                    logger.debug('Cannot write to client socket - already destroyed or not writable', {
                        component: 'proxy-server',
                        socketInfo
                    })
                }
            } catch (writeError) {
                logger.error('Failed to write error response to client socket', writeError, {
                    component: 'proxy-server',
                    originalError: err.message,
                    socketInfo
                })
            }
            this.handleError(err, { socketInfo })
        })
    }

    async start(): Promise<ServerInfo> {
        const host = this.opts.host ?? '127.0.0.1'
        const port = this.opts.port ?? 8899
        return await this.lifecycleManager.start(host, port)
    }

    async stop(): Promise<void> {
        // Stop WebSocket handler first to close all WS connections
        await this.webSocketHandler.stop()
        return await this.lifecycleManager.stop()
    }

    isRunning(): boolean {
        return this.httpServer.listening
    }

    getServerInfo(): ServerInfo | null {
        if (!this.httpServer.listening) {
            return null
        }
        const address = this.httpServer.address()
        if (!address || typeof address === 'string') {
            return null
        }
        return {
            host: address.address,
            port: address.port
        }
    }

    addPlugin(p: ProxyPlugin): void {
        this.pluginManager.addPlugin(p)
    }

    getWebSocketStats(): { activeConnections: number } {
        return {
            activeConnections: this.webSocketHandler.getActiveConnectionCount()
        }
    }

    private handleError(err: unknown, ctx: any): void {
        logger.error('Proxy error occurred', err, { 
            component: 'proxy-server',
            requestId: ctx.id,
            context: ctx
        })
        
        this.pluginManager.runHook('onError', { error: err, context: ctx } as any).catch((hookErr) => {
            logger.error('Error in error hook', hookErr, { 
                component: 'proxy-server',
                requestId: ctx.id 
            })
        })
    }
}
