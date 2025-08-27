import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import { CertificateAuthority } from '../certs/ca'
import type { CertStoreOptions } from '../certs/store'
import type { ProxyPlugin, ErrorContext } from '../plugins/types'
import { PluginManager } from './plugin-manager'
import { TlsManager } from './tls-manager'
import { HttpHandler } from './http-handler'
import { ServerLifecycleManager, type ServerInfo } from './server-lifecycle'
import { parseHostPort } from './utils/headers'
import { getSocketInfo } from './utils/sockets'
import { createCorrelationId } from './utils/ids'
import {
    sendErrorResponse,
    sendWebSocketErrorResponse,
} from './error-responses'
import { WebSocketHandler } from './websocket-handler'
import { safeSocketEnd } from './cleanup'
import { logger } from '../logger'
import {
    DEFAULT_PROXY_HOST,
    DEFAULT_PROXY_PORT,
    DEFAULT_HTTP_PORT,
    MAX_BODY_SIZE,
} from './constants'
import { ProxyConfigStore, type ProxyRuntimeConfig } from './config-store'

export interface ProxyOptions {
    host?: string
    port?: number
    ca?: CertificateAuthority
    certStore?: CertStoreOptions
    plugins?: ProxyPlugin[]
    config?: ProxyRuntimeConfig
}

export class MitmProxyServer {
    private httpServer: http.Server
    private ca: CertificateAuthority
    private configStore: ProxyConfigStore
    private pluginManager: PluginManager
    private tlsManager: TlsManager
    private httpHandler: HttpHandler
    private lifecycleManager: ServerLifecycleManager
    private webSocketHandler: WebSocketHandler

    constructor(private opts: ProxyOptions = {}) {
        this.ca = opts.ca ?? new CertificateAuthority({ store: opts.certStore })
        this.pluginManager = new PluginManager(opts.plugins)

        this.configStore = new ProxyConfigStore(
            opts.config ?? {
                hostFilter: [],
                hostFilterMode: 'whitelist',
                maxBodySize: MAX_BODY_SIZE,
            }
        )

        this.httpHandler = new HttpHandler(
            this.pluginManager,
            this.handleError.bind(this),
            this.configStore
        )

        this.webSocketHandler = new WebSocketHandler(
            this.handleError.bind(this),
            this.configStore
        )

        this.tlsManager = new TlsManager(
            this.ca,
            this.pluginManager,
            this.httpHandler,
            this.webSocketHandler,
            this.handleError.bind(this),
            this.configStore
        )

        this.httpServer = http.createServer((req, res) => {
            this.httpHandler
                .handleHttpRequest(req, res, false)
                .catch((err) => this.handleError(err, {}))
        })

        this.lifecycleManager = new ServerLifecycleManager(this.httpServer)

        // HTTPS tunneling via CONNECT
        this.httpServer.on(
            'connect',
            (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
                this.tlsManager
                    .handleConnect(req, clientSocket, head)
                    .catch((err) => this.handleError(err, {}))
            }
        )

        // WebSocket upgrades for HTTP connections
        this.httpServer.on(
            'upgrade',
            (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
                this.handleHttpWebSocketUpgrade(req, clientSocket, head).catch(
                    (err) => this.handleError(err, {})
                )
            }
        )

        this.httpServer.on('clientError', (err, socket) => {
            const socketInfo = getSocketInfo(socket as net.Socket)

            logger.error('Client socket error on HTTP server', err, {
                component: 'proxy-server',
                socketInfo,
                errorCode: (err as NodeJS.ErrnoException)?.code,
                errorErrno: (err as NodeJS.ErrnoException)?.errno,
            })

            sendErrorResponse(
                socket as net.Socket,
                400,
                'Bad Request',
                undefined,
                logger,
                {
                    component: 'proxy-server',
                    originalError: err.message,
                    socketInfo,
                }
            )

            this.handleError(err, { socketInfo })
        })
    }

    async start(): Promise<ServerInfo> {
        const host = this.opts.host ?? DEFAULT_PROXY_HOST
        const port = this.opts.port ?? DEFAULT_PROXY_PORT
        return this.lifecycleManager.start(host, port)
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
            port: address.port,
        }
    }

    addPlugin(p: ProxyPlugin): void {
        this.pluginManager.addPlugin(p)
    }

    updateConfiguration(newConfig: Partial<ProxyRuntimeConfig>): void {
        this.configStore.update(newConfig)
    }

    getCurrentConfiguration(): ProxyRuntimeConfig {
        return this.configStore.current
    }

    private async handleHttpWebSocketUpgrade(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer
    ): Promise<void> {
        const correlation = createCorrelationId('ws-http')
        const id = correlation.full
        let hostname = 'unknown'
        let targetPort = DEFAULT_HTTP_PORT

        try {
            // Extract hostname from request
            const hostHeader = req.headers.host
            if (!hostHeader) {
                logger.warn('WebSocket upgrade request missing Host header', {
                    requestId: id,
                    component: 'proxy-server',
                    url: req.url,
                })

                sendErrorResponse(
                    clientSocket,
                    400,
                    'Bad Request',
                    undefined,
                    logger,
                    {
                        requestId: id,
                        component: 'proxy-server',
                        originalError: 'Missing Host header',
                    }
                )
                safeSocketEnd(clientSocket, {
                    requestId: id,
                    component: 'proxy-server',
                    hostname,
                    port: targetPort,
                })
                return
            }

            const parsed = parseHostPort(hostHeader)
            hostname = parsed.hostname
            targetPort = parsed.port || DEFAULT_HTTP_PORT

            logger.debug('HTTP WebSocket upgrade request received', {
                requestId: id,
                hostname,
                port: targetPort,
                component: 'proxy-server',
                url: req.url,
                headers: req.headers,
            })

            // Use shared WebSocket handler
            await this.webSocketHandler.handleUpgrade(req, clientSocket, head, {
                hostname,
                port: targetPort,
                isHttps: false,
                requestId: id,
            })
        } catch (err) {
            logger.error('HTTP WebSocket upgrade handling failed', err, {
                requestId: id,
                component: 'proxy-server',
            })

            this.handleError(err, { id })

            sendWebSocketErrorResponse(
                clientSocket,
                500,
                'Internal Server Error',
                undefined,
                logger,
                {
                    requestId: id,
                    component: 'proxy-server',
                    hostname,
                    port: targetPort,
                    originalError:
                        err instanceof Error ? err.message : String(err),
                }
            )

            safeSocketEnd(clientSocket, {
                requestId: id,
                component: 'proxy-server',
                hostname,
                port: targetPort,
            })
        }
    }

    private handleError(err: unknown, ctx: ErrorContext): void {
        logger.error('Proxy error occurred', err, {
            component: 'proxy-server',
            requestId: ctx.id,
            context: ctx,
        })

        this.pluginManager.runErrorHooks(err, ctx)
    }
}
