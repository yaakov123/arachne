import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import { CertificateAuthority } from '../certs/ca'
import type { CertStoreOptions } from '../certs/store'
import type { ProxyPlugin } from '../plugins/types'
import { PluginManager } from './plugin-manager'
import { TlsManager } from './tls-manager'
import { HttpHandler } from './http-handler'
import { ServerLifecycleManager, type ServerInfo } from './server-lifecycle'
import { genId, parseHostPort, sendErrorResponse, getSocketInfo } from './utils'
import { WebSocketHandler } from './websocket-handler'
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
    private lifecycleManager: ServerLifecycleManager
    private webSocketHandler: WebSocketHandler

    constructor(private opts: ProxyOptions = {}) {
        this.ca = opts.ca ?? new CertificateAuthority({ store: opts.certStore })
        this.pluginManager = new PluginManager(opts.plugins)
        
        this.httpHandler = new HttpHandler(
            this.pluginManager,
            this.handleError.bind(this),
            opts.ignoredHosts
        )
        
        this.webSocketHandler = new WebSocketHandler(
            this.handleError.bind(this)
        )
        
        this.tlsManager = new TlsManager(
            this.ca,
            this.pluginManager,
            this.httpHandler,
            this.handleError.bind(this),
            opts.ignoredHosts
        )

        this.httpServer = http.createServer((req, res) => {
            this.httpHandler.handleHttpRequest(req, res, false).catch((err) =>
                this.handleError(err, {})
            )
        })

        this.lifecycleManager = new ServerLifecycleManager(this.httpServer)

        // HTTPS tunneling via CONNECT
        this.httpServer.on(
            'connect',
            (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
                this.tlsManager.handleConnect(req, clientSocket, head).catch((err) =>
                    this.handleError(err, {})
                )
            }
        )

        // WebSocket upgrades for HTTP connections
        this.httpServer.on(
            'upgrade',
            (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
                this.handleHttpWebSocketUpgrade(req, clientSocket, head).catch((err) =>
                    this.handleError(err, {})
                )
            }
        )

        this.httpServer.on('clientError', (err, socket) => {
            const socketInfo = getSocketInfo(socket)
            
            logger.error('Client socket error on HTTP server', err, {
                component: 'proxy-server',
                socketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            sendErrorResponse(socket, 400, 'Bad Request', undefined, logger, {
                component: 'proxy-server',
                originalError: err.message,
                socketInfo
            })
            
            this.handleError(err, { socketInfo })
        })
    }

    async start(): Promise<ServerInfo> {
        const host = this.opts.host ?? '127.0.0.1'
        const port = this.opts.port ?? 8899
        return await this.lifecycleManager.start(host, port)
    }

    async stop(): Promise<void> {
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

    private async handleHttpWebSocketUpgrade(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer
    ): Promise<void> {
        const id = genId('ws-http')
        
        try {
            // Extract hostname from request
            const hostHeader = req.headers.host
            if (!hostHeader) {
                logger.warn('WebSocket upgrade request missing Host header', {
                    requestId: id,
                    component: 'proxy-server',
                    url: req.url
                })
                clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
                clientSocket.end()
                return
            }
            
            const { hostname, port } = parseHostPort(hostHeader)
            const targetPort = port || 80
            
            logger.debug('HTTP WebSocket upgrade request received', {
                requestId: id,
                hostname,
                port: targetPort,
                component: 'proxy-server',
                url: req.url,
                headers: req.headers
            })
            
            // Use shared WebSocket handler
            await this.webSocketHandler.handleUpgrade(req, clientSocket, head, {
                hostname,
                port: targetPort,
                isHttps: false,
                ignoredHosts: this.opts.ignoredHosts,
                requestId: id
            })
            
        } catch (err) {
            logger.error('HTTP WebSocket upgrade handling failed', err, {
                requestId: id,
                component: 'proxy-server'
            })
            
            this.handleError(err, { id })
            
            try {
                if (!clientSocket.destroyed && clientSocket.writable) {
                    clientSocket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
                    clientSocket.end()
                }
            } catch (writeError) {
                logger.error('Failed to send 500 response for HTTP WebSocket upgrade error', writeError, {
                    requestId: id,
                    component: 'proxy-server'
                })
            }
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
