import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import { CertificateAuthority } from '../certs/ca'
import type { CertStoreOptions } from '../certs/store'
import type { ProxyPlugin } from '../plugins/types'
import { PluginManager } from './plugin-manager'
import { TlsManager } from './tls-manager'
import { HttpHandler } from './http-handler'
import { ServerLifecycleManager, type ServerInfo } from './server-lifecycle'
import { parseHostPort, getSocketInfo } from './utils'
import { createCorrelationId } from './correlation'
import { sendErrorResponse, sendWebSocketErrorResponse } from './error-responses'
import { WebSocketHandler } from './websocket-handler'
import { safeSocketEnd } from './cleanup'
import { logger } from '../logger'

export interface ProxyOptions {
    host?: string
    port?: number
    ca?: CertificateAuthority
    certStore?: CertStoreOptions
    plugins?: ProxyPlugin[]
    ignoredHosts?: string[]
    maxBodySize?: number
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
            opts.ignoredHosts,
            opts.maxBodySize
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
            const socketInfo = getSocketInfo(socket as net.Socket)
            
            logger.error('Client socket error on HTTP server', err, {
                component: 'proxy-server',
                socketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            sendErrorResponse(socket as net.Socket, 400, 'Bad Request', undefined, logger, {
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
        const correlation = createCorrelationId('ws-http')
        const id = correlation.full
        let hostname = 'unknown'
        let targetPort = 80
        
        try {
            // Extract hostname from request
            const hostHeader = req.headers.host
            if (!hostHeader) {
                logger.warn('WebSocket upgrade request missing Host header', {
                    requestId: id,
                    component: 'proxy-server',
                    url: req.url
                })
                
                sendErrorResponse(clientSocket, 400, 'Bad Request', undefined, logger, {
                    requestId: id,
                    component: 'proxy-server',
                    originalError: 'Missing Host header'
                })
                safeSocketEnd(clientSocket, {
                    requestId: id,
                    component: 'proxy-server',
                    hostname,
                    port: targetPort
                })
                return
            }
            
            const parsed = parseHostPort(hostHeader)
            hostname = parsed.hostname
            targetPort = parsed.port || 80
            
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
            
            sendWebSocketErrorResponse(clientSocket, 500, 'Internal Server Error', undefined, logger, {
                requestId: id,
                component: 'proxy-server',
                hostname,
                port: targetPort,
                originalError: err instanceof Error ? err.message : String(err)
            })
            
            safeSocketEnd(clientSocket, {
                requestId: id,
                component: 'proxy-server',
                hostname,
                port: targetPort
            })
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
