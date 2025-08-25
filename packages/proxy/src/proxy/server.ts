import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import { CertificateAuthority } from '../certs/ca'
import type { CertStoreOptions } from '../certs/store'
import type { ProxyPlugin } from '../plugins/types'
import { PluginManager } from './plugin-manager'
import { TlsManager } from './tls-manager'
import { HttpHandler } from './http-handler'
import { ServerLifecycleManager, type ServerInfo } from './server-lifecycle'
import { genId, parseHostPort, isHostIgnored, sanitizeHeaders } from './utils'
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
                this.handleWebSocketUpgrade(req, clientSocket, head).catch((err) =>
                    this.handleError(err, {})
                )
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

    private async handleWebSocketUpgrade(
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
            
            // Check if host should be ignored - if so, create direct WebSocket tunnel
            if (isHostIgnored(hostname, this.opts.ignoredHosts)) {
                logger.debug('Creating direct HTTP WebSocket tunnel for ignored host', {
                    requestId: id,
                    hostname,
                    component: 'proxy-server'
                })
                await this.createDirectHttpWebSocketTunnel(req, clientSocket, head, hostname, targetPort)
                return
            }
            
            // Prepare headers for upstream request
            const upstreamHeaders = sanitizeHeaders(req.headers)
            
            // Create upstream WebSocket connection
            const upstreamReq = http.request({
                hostname,
                port: targetPort,
                method: req.method,
                path: req.url,
                headers: upstreamHeaders
            })
            
            upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                logger.debug('Upstream HTTP WebSocket upgrade successful', {
                    requestId: id,
                    hostname,
                    port: targetPort,
                    component: 'proxy-server',
                    statusCode: upstreamRes.statusCode
                })
                
                // Forward upgrade response to client
                const responseHeaders = Object.entries(upstreamRes.headers)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\r\n')
                
                const upgradeResponse = 
                    `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n` +
                    responseHeaders + '\r\n\r\n'
                
                clientSocket.write(upgradeResponse)
                
                // Forward any initial upstream data
                if (upstreamHead && upstreamHead.length > 0) {
                    logger.debug('Forwarding initial upstream HTTP WebSocket data', {
                        requestId: id,
                        hostname,
                        component: 'proxy-server',
                        dataLength: upstreamHead.length
                    })
                    clientSocket.write(upstreamHead)
                }
                
                logger.debug('Starting bidirectional HTTP WebSocket data piping', {
                    requestId: id,
                    hostname,
                    port: targetPort,
                    component: 'proxy-server'
                })
                
                // Pipe both directions for WebSocket data
                clientSocket.pipe(upstreamSocket, { end: true })
                upstreamSocket.pipe(clientSocket, { end: true })
                
                // Handle cleanup
                const cleanup = (reason: string) => {
                    logger.debug('Cleaning up HTTP WebSocket connection', {
                        requestId: id,
                        hostname,
                        component: 'proxy-server',
                        reason
                    })
                    try {
                        if (!upstreamSocket.destroyed) {
                            upstreamSocket.destroy()
                        }
                    } catch (err) {
                        logger.error('Error destroying upstream HTTP WebSocket socket', err, {
                            requestId: id,
                            hostname,
                            component: 'proxy-server'
                        })
                    }
                }
                
                clientSocket.on('close', () => cleanup('client-close'))
                clientSocket.on('end', () => cleanup('client-end'))
                upstreamSocket.on('close', () => cleanup('upstream-close'))
                upstreamSocket.on('end', () => cleanup('upstream-end'))
                
                upstreamSocket.on('error', (err) => {
                    logger.error('Upstream HTTP WebSocket socket error', err, {
                        requestId: id,
                        hostname,
                        component: 'proxy-server'
                    })
                    cleanup('upstream-error')
                })
            })
            
            upstreamReq.on('error', (err) => {
                logger.error('HTTP WebSocket upgrade request failed', err, {
                    requestId: id,
                    hostname,
                    port: targetPort,
                    component: 'proxy-server',
                    errorCode: (err as any)?.code,
                    errorErrno: (err as any)?.errno
                })
                
                try {
                    if (!clientSocket.destroyed && clientSocket.writable) {
                        logger.debug('Sending 502 Bad Gateway for HTTP WebSocket upgrade error', {
                            requestId: id,
                            hostname,
                            component: 'proxy-server'
                        })
                        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
                        clientSocket.end()
                    }
                } catch (writeError) {
                    logger.error('Failed to send 502 response for HTTP WebSocket upgrade error', writeError, {
                        requestId: id,
                        hostname,
                        component: 'proxy-server',
                        originalError: err.message
                    })
                }
            })
            
            // Send the upgrade request to upstream
            upstreamReq.end()
            
            // Forward any initial client data
            if (head && head.length > 0) {
                logger.debug('Forwarding initial client HTTP WebSocket data', {
                    requestId: id,
                    hostname,
                    component: 'proxy-server',
                    dataLength: head.length
                })
                upstreamReq.write(head)
            }
            
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
    
    private async createDirectHttpWebSocketTunnel(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer,
        hostname: string,
        port: number
    ): Promise<void> {
        const tunnelId = genId('ws-http-direct')
        
        logger.debug('Creating direct HTTP WebSocket tunnel for ignored host', {
            requestId: tunnelId,
            hostname,
            port,
            component: 'proxy-server'
        })
        
        try {
            // For ignored hosts, connect directly to the upstream server
            const upstreamReq = http.request({
                hostname,
                port,
                method: req.method,
                path: req.url,
                headers: req.headers
            })
            
            upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                logger.debug('Direct HTTP WebSocket tunnel upgrade successful', {
                    requestId: tunnelId,
                    hostname,
                    port,
                    component: 'proxy-server',
                    statusCode: upstreamRes.statusCode
                })
                
                // Forward upgrade response to client
                const responseHeaders = Object.entries(upstreamRes.headers)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\r\n')
                
                const upgradeResponse = 
                    `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n` +
                    responseHeaders + '\r\n\r\n'
                
                clientSocket.write(upgradeResponse)
                
                // Forward any initial data
                if (upstreamHead && upstreamHead.length > 0) {
                    clientSocket.write(upstreamHead)
                }
                
                // Pipe both directions
                clientSocket.pipe(upstreamSocket, { end: true })
                upstreamSocket.pipe(clientSocket, { end: true })
                
                // Cleanup handlers
                const cleanup = () => {
                    try {
                        if (!upstreamSocket.destroyed) {
                            upstreamSocket.destroy()
                        }
                    } catch {}
                }
                
                clientSocket.on('close', cleanup)
                clientSocket.on('end', cleanup)
                upstreamSocket.on('close', cleanup)
                upstreamSocket.on('end', cleanup)
            })
            
            upstreamReq.on('error', (err) => {
                logger.error('Direct HTTP WebSocket tunnel failed', err, {
                    requestId: tunnelId,
                    hostname,
                    port,
                    component: 'proxy-server'
                })
                
                try {
                    if (!clientSocket.destroyed && clientSocket.writable) {
                        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
                        clientSocket.end()
                    }
                } catch {}
            })
            
            upstreamReq.end()
            
            if (head && head.length > 0) {
                upstreamReq.write(head)
            }
            
        } catch (err) {
            logger.error('Direct HTTP WebSocket tunnel setup failed', err, {
                requestId: tunnelId,
                hostname,
                port,
                component: 'proxy-server'
            })
            
            try {
                if (!clientSocket.destroyed && clientSocket.writable) {
                    clientSocket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
                    clientSocket.end()
                }
            } catch {}
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
