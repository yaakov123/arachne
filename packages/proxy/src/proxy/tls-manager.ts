import http, { IncomingMessage } from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { CertificateAuthority } from '../certs/ca'
import type { ConnectContext } from '../plugins/types'
import { genId, parseHostPort, isHostIgnored, sanitizeHeaders } from './utils'
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
        
        // Handle WebSocket upgrades through HTTPS tunnel
        httpOverTls.on('upgrade', (req, socket, head) => {
            this.handleWebSocketUpgrade(req, socket as net.Socket, head, id, hostname).catch((err) =>
                this.onError(err, { id, hostname })
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

    private async handleWebSocketUpgrade(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer,
        connectId: string,
        hostname: string
    ): Promise<void> {
        const upgradeId = genId('ws')
        
        logger.debug('WebSocket upgrade request received through HTTPS tunnel', {
            requestId: upgradeId,
            connectId,
            hostname,
            component: 'tls-manager',
            url: req.url,
            headers: req.headers
        })
        
        try {
            // Check if host should be ignored - if so, create direct WebSocket tunnel
            if (isHostIgnored(hostname, this.ignoredHosts)) {
                logger.debug('Creating direct WebSocket tunnel for ignored host', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    component: 'tls-manager'
                })
                await this.createDirectWebSocketTunnel(req, clientSocket, head, hostname)
                return
            }
            
            // Prepare headers for upstream request
            const upstreamHeaders = sanitizeHeaders(req.headers)
            
            // Create upstream WebSocket connection
            const upstreamReq = https.request({
                hostname,
                port: 443,
                method: req.method,
                path: req.url,
                headers: upstreamHeaders
            })
            
            upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                logger.debug('Upstream WebSocket upgrade successful', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    component: 'tls-manager',
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
                    logger.debug('Forwarding initial upstream WebSocket data', {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        component: 'tls-manager',
                        dataLength: upstreamHead.length
                    })
                    clientSocket.write(upstreamHead)
                }
                
                logger.debug('Starting bidirectional WebSocket data piping', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    component: 'tls-manager'
                })
                
                // Pipe both directions for WebSocket data
                clientSocket.pipe(upstreamSocket, { end: true })
                upstreamSocket.pipe(clientSocket, { end: true })
                
                // Handle cleanup
                const cleanup = (reason: string) => {
                    logger.debug('Cleaning up WebSocket connection', {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        component: 'tls-manager',
                        reason
                    })
                    try {
                        if (!upstreamSocket.destroyed) {
                            upstreamSocket.destroy()
                        }
                    } catch (err) {
                        logger.error('Error destroying upstream WebSocket socket', err, {
                            requestId: upgradeId,
                            connectId,
                            hostname,
                            component: 'tls-manager'
                        })
                    }
                }
                
                clientSocket.on('close', () => cleanup('client-close'))
                clientSocket.on('end', () => cleanup('client-end'))
                upstreamSocket.on('close', () => cleanup('upstream-close'))
                upstreamSocket.on('end', () => cleanup('upstream-end'))
                
                upstreamSocket.on('error', (err) => {
                    logger.error('Upstream WebSocket socket error', err, {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        component: 'tls-manager'
                    })
                    cleanup('upstream-error')
                })
            })
            
            upstreamReq.on('error', (err) => {
                logger.error('WebSocket upgrade request failed', err, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    component: 'tls-manager',
                    errorCode: (err as any)?.code,
                    errorErrno: (err as any)?.errno
                })
                
                try {
                    if (!clientSocket.destroyed && clientSocket.writable) {
                        logger.debug('Sending 502 Bad Gateway for WebSocket upgrade error', {
                            requestId: upgradeId,
                            connectId,
                            hostname,
                            component: 'tls-manager'
                        })
                        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
                        clientSocket.end()
                    }
                } catch (writeError) {
                    logger.error('Failed to send 502 response for WebSocket upgrade error', writeError, {
                        requestId: upgradeId,
                        connectId,
                        hostname,
                        component: 'tls-manager',
                        originalError: err.message
                    })
                }
            })
            
            // Send the upgrade request to upstream
            upstreamReq.end()
            
            // Forward any initial client data
            if (head && head.length > 0) {
                logger.debug('Forwarding initial client WebSocket data', {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    component: 'tls-manager',
                    dataLength: head.length
                })
                upstreamReq.write(head)
            }
            
        } catch (err) {
            logger.error('WebSocket upgrade handling failed', err, {
                requestId: upgradeId,
                connectId,
                hostname,
                component: 'tls-manager'
            })
            
            this.onError(err, { id: upgradeId, hostname })
            
            try {
                if (!clientSocket.destroyed && clientSocket.writable) {
                    clientSocket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
                    clientSocket.end()
                }
            } catch (writeError) {
                logger.error('Failed to send 500 response for WebSocket upgrade error', writeError, {
                    requestId: upgradeId,
                    connectId,
                    hostname,
                    component: 'tls-manager'
                })
            }
        }
    }
    
    private async createDirectWebSocketTunnel(
        req: IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer,
        hostname: string
    ): Promise<void> {
        const tunnelId = genId('ws-direct')
        
        logger.debug('Creating direct WebSocket tunnel for ignored host', {
            requestId: tunnelId,
            hostname,
            component: 'tls-manager'
        })
        
        try {
            // For ignored hosts, connect directly to the upstream server
            const upstreamReq = https.request({
                hostname,
                port: 443,
                method: req.method,
                path: req.url,
                headers: req.headers
            })
            
            upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                logger.debug('Direct WebSocket tunnel upgrade successful', {
                    requestId: tunnelId,
                    hostname,
                    component: 'tls-manager',
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
                logger.error('Direct WebSocket tunnel failed', err, {
                    requestId: tunnelId,
                    hostname,
                    component: 'tls-manager'
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
            logger.error('Direct WebSocket tunnel setup failed', err, {
                requestId: tunnelId,
                hostname,
                component: 'tls-manager'
            })
            
            try {
                if (!clientSocket.destroyed && clientSocket.writable) {
                    clientSocket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
                    clientSocket.end()
                }
            } catch {}
        }
    }
}
