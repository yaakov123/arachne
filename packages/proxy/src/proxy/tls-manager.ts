import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import tls from 'node:tls'
import { CertificateAuthority } from '../certs/ca'
import type { ConnectContext } from '../plugins/types'
import { parseHostPort, isHostIgnored } from './utils'
import { createCorrelationId } from './correlation'
import { sendErrorResponse, sendConnectSuccessResponse } from './error-responses'
import { getRemote } from './proxy-utils'
import { PluginManager } from './plugin-manager'
import { HttpHandler } from './http-handler'
import { WebSocketHandler } from './websocket-handler'
import { TunnelHandler } from './tunnel-handler'
import { logger } from '../logger'

export class TlsManager {
    private webSocketHandler: WebSocketHandler
    private tunnelHandler: TunnelHandler
    
    constructor(
        private ca: CertificateAuthority,
        private pluginManager: PluginManager,
        private httpHandler: HttpHandler,
        private onError: (err: unknown, ctx: any) => void,
        private ignoredHosts?: string[]
    ) {
        this.webSocketHandler = new WebSocketHandler(onError)
        this.tunnelHandler = new TunnelHandler(onError)
    }

    async handleConnect(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer
    ): Promise<void> {
        const correlation = createCorrelationId('conn')
        const { hostname, port } = parseHostPort(String(req.url || ''))
        const connectPort = port || 443

        const ctx: ConnectContext = {
            id: correlation.full,
            hostname,
            port: connectPort,
            clientIp: getRemote(clientSocket),
        }

        logger.debug('CONNECT request received', {
            requestId: correlation.full,
            hostname,
            port: connectPort,
            clientIp: ctx.clientIp,
            component: 'tls-manager'
        })
        
        // Check if host should be ignored - if so, create direct tunnel
        if (isHostIgnored(hostname, this.ignoredHosts)) {
            logger.debug('Creating direct tunnel for ignored host', {
                requestId: correlation.full,
                hostname,
                component: 'tls-manager'
            })
            await this.tunnelHandler.createConnectTunnel(clientSocket, {
                hostname,
                port: connectPort,
                requestId: correlation.full
            }, head)
            return
        }
        
        await this.pluginManager.runHook('onConnect', ctx)

        // Inform client to start TLS handshake through us
        sendConnectSuccessResponse(clientSocket, logger, {
            requestId: correlation.full,
            component: 'tls-manager',
            hostname,
            port
        })

        if (head && head.length) {
            logger.debug('Unshifting HEAD data back to client socket', {
                requestId: correlation.full,
                hostname,
                component: 'tls-manager',
                headLength: head.length
            })
            clientSocket.unshift(head)
        }

        const httpOverTls = http.createServer((req2, res2) => {
            this.httpHandler.handleHttpRequest(req2, res2, true, correlation).catch((err) =>
                this.onError(err, {})
            )
        })
        
        // Handle WebSocket upgrades through HTTPS tunnel
        httpOverTls.on('upgrade', (req, socket, head) => {
            this.webSocketHandler.handleUpgrade(req, socket as net.Socket, head, {
                hostname,
                port: connectPort,
                isHttps: true,
                ignoredHosts: this.ignoredHosts,
                requestId: undefined, // Let WebSocket handler create its own correlation extending from parent
                connectId: correlation.full
            }).catch((err) => this.onError(err, { id: correlation.full, hostname }))
        })
        
        httpOverTls.on('clientError', (err, socket) => {
            const socketInfo = {
                remoteAddress: (socket as any).remoteAddress,
                remotePort: (socket as any).remotePort,
                localAddress: (socket as any).localAddress,
                localPort: (socket as any).localPort,
                destroyed: socket.destroyed,
                readable: socket.readable,
                writable: socket.writable
            }
            
            logger.error('Client error on HTTPS over TLS connection', err, {
                requestId: correlation.full,
                hostname,
                component: 'tls-manager',
                socketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            sendErrorResponse(socket as net.Socket, 400, 'Bad Request', undefined, logger, {
                requestId: correlation.full,
                component: 'tls-manager',
                hostname,
                originalError: err.message,
                socketInfo
            })
            
            this.onError(err, { id: correlation.full, hostname })
        })

        const issued = await this.ca.issueHostCert(hostname)
        logger.debug('Certificate issued for host', {
            requestId: correlation.full,
            hostname,
            component: 'tls-manager'
        })
        
        const tlsServer = tls.createServer({
            // Force http/1.1 to keep implementation simple and Chrome-compatible
            ALPNProtocols: ['http/1.1'],
            SNICallback: (servername, cb) => {
                const name = servername || hostname
                this.ca
                    .getSecureContextForHost(name)
                    .then((sc) => cb(null as any, sc))
                    .catch((e) => {
                        logger.error('SNI callback failed', e, {
                            requestId: correlation.full,
                            hostname: name,
                            component: 'tls-manager'
                        })
                        cb(e as any, undefined as any)
                    })
            },
            // Fallback context in case SNI is missing
            cert: issued.certPem,
            key: issued.keyPem,
        })

        tlsServer.on('secureConnection', (tlsSocket) => {
            logger.logConnect(correlation.full, hostname, connectPort)
            httpOverTls.emit('connection', tlsSocket)
        })

        tlsServer.on('error', (error) => {
            logger.error('TLS server error', error, {
                requestId: correlation.full,
                hostname,
                component: 'tls-manager'
            })
            this.onError(error, ctx)
        })

        // Hand off the existing TCP socket to the TLS server
        tlsServer.emit('connection', clientSocket)

        // Clean up when the client disconnects
        const cleanup = () => {
            try {
                tlsServer.close()
            } catch {}
            try {
                httpOverTls.close()
            } catch {}
        }
        clientSocket.on('close', cleanup)
        clientSocket.on('end', cleanup)
    }




}
