import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import { CertificateAuthority } from '../certs/ca'
import type { CertStoreOptions } from '../certs/store'
import type { ProxyPlugin } from '../plugins/types'
import { PluginManager } from './plugin-manager'
import { TlsManager } from './tls-manager'
import { HttpHandler } from './http-handler'
import { ServerLifecycleManager, type ServerInfo } from './server-lifecycle'

export interface ProxyOptions {
    host?: string
    port?: number
    ca?: CertificateAuthority
    certStore?: CertStoreOptions
    plugins?: ProxyPlugin[]
}

export class MitmProxyServer {
    private httpServer: http.Server
    private ca: CertificateAuthority
    private pluginManager: PluginManager
    private tlsManager: TlsManager
    private httpHandler: HttpHandler
    private lifecycleManager: ServerLifecycleManager

    constructor(private opts: ProxyOptions = {}) {
        this.ca = opts.ca ?? new CertificateAuthority({ store: opts.certStore })
        this.pluginManager = new PluginManager(opts.plugins)
        
        this.httpHandler = new HttpHandler(
            this.pluginManager,
            this.handleError.bind(this)
        )
        
        this.tlsManager = new TlsManager(
            this.ca,
            this.pluginManager,
            this.httpHandler,
            this.handleError.bind(this),
        )

        this.httpServer = http.createServer((req, res) => {
            this.httpHandler.handleHttpRequest(req, res, false).catch((err) =>
                this.handleError(err, {})
            )
        })

        this.lifecycleManager = new ServerLifecycleManager(
            this.httpServer,
            this.handleError.bind(this)
        )

        // HTTPS tunneling via CONNECT
        this.httpServer.on(
            'connect',
            (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
                this.tlsManager.handleConnect(req, clientSocket, head).catch((err) =>
                    this.handleError(err, {})
                )
            }
        )

        this.httpServer.on('clientError', (err, socket) => {
            try {
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
            } catch {}
            this.handleError(err, {})
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

    addPlugin(p: ProxyPlugin): void {
        this.pluginManager.addPlugin(p)
    }

    private handleError(err: unknown, ctx: any): void {
        this.pluginManager.runHook('onError', { error: err, context: ctx } as any).catch(() => {
            // Silently handle errors in error handlers
        })
    }
}
