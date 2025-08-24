import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import tls from 'node:tls'
import { CertificateAuthority } from '../certs/ca'
import type { ConnectContext } from '../plugins/types'
import { genId, parseHostPort, isHostIgnored } from './utils'
import { getRemote } from './proxy-utils'
import { PluginManager } from './plugin-manager'
import { HttpHandler } from './http-handler'
import { logger } from '../logger'

export class TlsManager {
    constructor(
        private ca: CertificateAuthority,
        private pluginManager: PluginManager,
        private httpHandler: HttpHandler,
        private onError: (err: unknown, ctx: any) => void,
        private ignoredHosts?: string[]
    ) {}

    async handleConnect(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer
    ): Promise<void> {
        const id = genId('conn')
        const { hostname, port } = parseHostPort(String(req.url || ''))
        const connectPort = port || 443

        const ctx: ConnectContext = {
            id,
            hostname,
            port: connectPort,
            clientIp: getRemote(clientSocket),
        }

        logger.debug('CONNECT request received', {
            requestId: id,
            hostname,
            port: connectPort,
            clientIp: ctx.clientIp,
            component: 'tls-manager'
        })
        
        // Check if host should be ignored - if so, create direct tunnel
        if (isHostIgnored(hostname, this.ignoredHosts)) {
            logger.debug('Creating direct tunnel for ignored host', {
                requestId: id,
                hostname,
                component: 'tls-manager'
            })
            await this.createDirectTunnel(clientSocket, hostname, connectPort, head)
            return
        }
        
        await this.pluginManager.runHook('onConnect', ctx)

        // Inform client to start TLS handshake through us
        logger.debug('Sending CONNECT response to client', {
            requestId: id,
            hostname,
            component: 'tls-manager',
                                        clientRemoteAddress: (clientSocket as any).remoteAddress
        })
        
        clientSocket.write(
            'HTTP/1.1 200 Connection Established\r\n' +
                'Proxy-Agent: Arachne-Proxy/0.1\r\n' +
                '\r\n'
        )

        if (head && head.length) {
            logger.debug('Unshifting HEAD data back to client socket', {
                requestId: id,
                hostname,
                component: 'tls-manager',
                headLength: head.length
            })
            clientSocket.unshift(head)
        }

        const httpOverTls = http.createServer((req2, res2) => {
            this.httpHandler.handleHttpRequest(req2, res2, true).catch((err) =>
                this.onError(err, {})
            )
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
                requestId: id,
                hostname,
                component: 'tls-manager',
                socketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            try {
                if (!socket.destroyed && socket.writable) {
                    logger.debug('Sending 400 Bad Request to TLS client socket', {
                        requestId: id,
                        hostname,
                        component: 'tls-manager',
                        remoteAddress: (socket as any).remoteAddress,
                        remotePort: (socket as any).remotePort
                    })
                    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
                } else {
                    logger.debug('Cannot write to TLS client socket - already destroyed or not writable', {
                        requestId: id,
                        hostname,
                        component: 'tls-manager',
                        socketInfo
                    })
                }
            } catch (writeError) {
                logger.error('Failed to write 400 response to TLS client socket', writeError, {
                    requestId: id,
                    hostname,
                    component: 'tls-manager',
                    originalError: err.message,
                    socketInfo
                })
            }
            
            this.onError(err, { id, hostname })
        })

        const issued = await this.ca.issueHostCert(hostname)
        logger.debug('Certificate issued for host', {
            requestId: id,
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
                            requestId: id,
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
            logger.logConnect(id, hostname, connectPort)
            httpOverTls.emit('connection', tlsSocket)
        })

        tlsServer.on('error', (error) => {
            logger.error('TLS server error', error, {
                requestId: id,
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

    private async createDirectTunnel(
        clientSocket: net.Socket,
        hostname: string,
        port: number,
        head: Buffer
    ): Promise<void> {
        try {
            const upstreamSocket = new net.Socket()
            
            upstreamSocket.connect(port, hostname, () => {
                logger.debug('Direct tunnel connection established', {
                    component: 'tls-manager',
                    hostname,
                    port,
                    clientRemoteAddress: (clientSocket as any).remoteAddress,
                    upstreamLocalAddress: (upstreamSocket as any).localAddress,
                    upstreamLocalPort: (upstreamSocket as any).localPort
                })
                
                // Send successful connection response
                clientSocket.write(
                    'HTTP/1.1 200 Connection Established\r\n' +
                        'Proxy-Agent: Arachne-Proxy/0.1\r\n' +
                        '\r\n'
                )
                
                // Forward any initial data
                if (head && head.length) {
                    logger.debug('Forwarding initial HEAD data in direct tunnel', {
                        component: 'tls-manager',
                        hostname,
                        port,
                        headLength: head.length
                    })
                    upstreamSocket.write(head)
                }
                
                logger.debug('Starting bidirectional data piping for direct tunnel', {
                    component: 'tls-manager',
                    hostname,
                    port,
                    clientRemoteAddress: (clientSocket as any).remoteAddress
                })
                
                // Pipe both directions
                clientSocket.pipe(upstreamSocket, { end: true })
                upstreamSocket.pipe(clientSocket, { end: true })
            })
            
            upstreamSocket.on('error', (err) => {
                const clientSocketInfo = {
                    remoteAddress: (clientSocket as any).remoteAddress,
                    remotePort: (clientSocket as any).remotePort,
                    destroyed: clientSocket.destroyed,
                    readable: clientSocket.readable,
                    writable: clientSocket.writable
                }
                
                const upstreamSocketInfo = {
                    remoteAddress: (upstreamSocket as any).remoteAddress,
                    remotePort: (upstreamSocket as any).remotePort,
                    destroyed: upstreamSocket.destroyed,
                    readable: upstreamSocket.readable,
                    writable: upstreamSocket.writable
                }
                
                logger.error('Upstream socket error in direct tunnel', err, {
                    component: 'tls-manager',
                    hostname,
                    port,
                    clientSocketInfo,
                    upstreamSocketInfo,
                    errorCode: (err as any)?.code,
                    errorErrno: (err as any)?.errno
                })
                
                try {
                    if (!clientSocket.destroyed && clientSocket.writable) {
                        logger.debug('Sending 502 Bad Gateway to client socket for upstream error', {
                            component: 'tls-manager',
                            hostname,
                            port,
                            clientRemoteAddress: (clientSocket as any).remoteAddress
                        })
                        clientSocket.write(
                            'HTTP/1.1 502 Bad Gateway\r\n' +
                                'Content-Type: text/plain\r\n' +
                                'Content-Length: 19\r\n' +
                                '\r\n' +
                                'Connection failed\r\n'
                        )
                        clientSocket.end()
                    } else {
                        logger.debug('Cannot write 502 response to client socket - already destroyed or not writable', {
                            component: 'tls-manager',
                            hostname,
                            port,
                            clientSocketInfo
                        })
                    }
                } catch (writeError) {
                    logger.error('Failed to write 502 response to client socket for upstream error', writeError, {
                        component: 'tls-manager',
                        hostname,
                        port,
                        originalError: err.message,
                        clientSocketInfo
                    })
                }
            })
            
            // Clean up when client disconnects
            const cleanup = (reason: string) => {
                logger.debug('Cleaning up direct tunnel connection', {
                    component: 'tls-manager',
                    hostname,
                    port,
                    reason,
                    clientRemoteAddress: (clientSocket as any).remoteAddress,
                    upstreamDestroyed: upstreamSocket.destroyed
                })
                try {
                    if (!upstreamSocket.destroyed) {
                        upstreamSocket.destroy()
                    }
                } catch (destroyError) {
                    logger.error('Error destroying upstream socket during cleanup', destroyError, {
                        component: 'tls-manager',
                        hostname,
                        port,
                        reason
                    })
                }
            }
            clientSocket.on('close', () => cleanup('client-close'))
            clientSocket.on('end', () => cleanup('client-end'))
            upstreamSocket.on('close', () => {
                logger.debug('Upstream socket closed in direct tunnel', {
                    component: 'tls-manager',
                    hostname,
                    port,
                    clientRemoteAddress: (clientSocket as any).remoteAddress
                })
            })
            
        } catch (err) {
            const clientSocketInfo = {
                remoteAddress: (clientSocket as any).remoteAddress,
                remotePort: (clientSocket as any).remotePort,
                destroyed: clientSocket.destroyed,
                readable: clientSocket.readable,
                writable: clientSocket.writable
            }
            
            logger.error('Direct tunnel setup failed', err, {
                component: 'tls-manager',
                hostname,
                port,
                clientSocketInfo,
                errorCode: (err as any)?.code,
                errorErrno: (err as any)?.errno
            })
            
            this.onError(err, { hostname, port })
            
            try {
                if (!clientSocket.destroyed && clientSocket.writable) {
                    logger.debug('Closing client socket after direct tunnel setup failure', {
                        component: 'tls-manager',
                        hostname,
                        port,
                        clientRemoteAddress: (clientSocket as any).remoteAddress
                    })
                    clientSocket.end()
                } else {
                    logger.debug('Client socket already destroyed or not writable after direct tunnel setup failure', {
                        component: 'tls-manager',
                        hostname,
                        port,
                        clientSocketInfo
                    })
                }
            } catch (closeError) {
                logger.error('Failed to close client socket after direct tunnel setup failure', closeError, {
                    component: 'tls-manager',
                    hostname,
                    port,
                    originalError: err instanceof Error ? err.message : String(err),
                    clientSocketInfo
                })
            }
        }
    }
}
