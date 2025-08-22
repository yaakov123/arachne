import http, { IncomingMessage } from 'node:http'
import net from 'node:net'
import tls from 'node:tls'
import { CertificateAuthority } from '../certs/ca'
import type { ConnectContext } from '../plugins/types'
import { genId, parseHostPort } from './utils'
import { getRemote } from './proxy-utils'
import { PluginManager } from './plugin-manager'
import { HttpHandler } from './http-handler'

export class TlsManager {
    constructor(
        private ca: CertificateAuthority,
        private pluginManager: PluginManager,
        private httpHandler: HttpHandler,
        private onError: (err: unknown, ctx: any) => void,
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
        await this.pluginManager.runHook('onConnect', ctx)

        // Inform client to start TLS handshake through us
        clientSocket.write(
            'HTTP/1.1 200 Connection Established\r\n' +
                'Proxy-Agent: Arachne-Proxy/0.1\r\n' +
                '\r\n'
        )

        if (head && head.length) clientSocket.unshift(head)

        const httpOverTls = http.createServer((req2, res2) => {
            this.httpHandler.handleHttpRequest(req2, res2, true).catch((err) =>
                this.onError(err, {})
            )
        })
        httpOverTls.on('clientError', (err, socket) => {
            try {
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
            } catch {}
            this.onError(err, {})
        })

        const issued = await this.ca.issueHostCert(hostname)
        const tlsServer = tls.createServer({
            // Force http/1.1 to keep implementation simple and Chrome-compatible
            ALPNProtocols: ['http/1.1'],
            SNICallback: (servername, cb) => {
                const name = servername || hostname
                this.ca
                    .getSecureContextForHost(name)
                    .then((sc) => cb(null as any, sc))
                    .catch((e) => cb(e as any, undefined as any))
            },
            // Fallback context in case SNI is missing
            cert: issued.certPem,
            key: issued.keyPem,
        })

        tlsServer.on('secureConnection', (tlsSocket) => {
            httpOverTls.emit('connection', tlsSocket)
        })

        tlsServer.on('error', (e) => this.onError(e, ctx))

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
