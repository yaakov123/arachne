import http, { IncomingMessage, RequestOptions } from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { URL } from 'node:url'
import { CertificateAuthority } from '../certs/ca.js'
import { ProxyPlugin, RequestContext, ResponseContext, ConnectContext } from '../plugins/types.js'
import { genId, parseHostPort, sanitizeHeaders } from './utils.js'

export interface ProxyOptions {
  host?: string
  port?: number
  ca?: CertificateAuthority
  plugins?: ProxyPlugin[]
}

export class MitmProxyServer {
  private httpServer: http.Server
  private ca: CertificateAuthority
  private plugins: ProxyPlugin[]

  constructor(private opts: ProxyOptions = {}) {
    this.ca = opts.ca ?? new CertificateAuthority()
    this.plugins = opts.plugins ?? []

    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res, false).catch((err) => this.handleError(err, {}))
    })

    // HTTPS tunneling via CONNECT
    this.httpServer.on('connect', (req: IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
      this.handleConnect(req, clientSocket, head).catch((err) => this.handleError(err, {}))
    })

    this.httpServer.on('clientError', (err, socket) => {
      try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n') } catch {}
      this.handleError(err, {})
    })
  }

  async start(): Promise<{ host: string; port: number }> {
    const host = this.opts.host ?? '127.0.0.1'
    const port = this.opts.port ?? 8899
    await new Promise<void>((resolve) => this.httpServer.listen(port, host, resolve))
    return { host, port }
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.httpServer.close((err) => (err ? reject(err) : resolve())))
  }

  addPlugin(p: ProxyPlugin) { this.plugins.push(p) }

  private async handleConnect(req: IncomingMessage, clientSocket: net.Socket, head: Buffer) {
    const id = genId('conn')
    const { hostname, port } = parseHostPort(String(req.url || ''))
    const connectPort = port || 443

    const ctx: ConnectContext = { id, hostname, port: connectPort, clientIp: getRemote(clientSocket) }
    await this.runHook('onConnect', ctx)

    // Inform client to start TLS handshake through us
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
      'Proxy-Agent: Arachne-Proxy/0.1\r\n' +
      '\r\n')

    if (head && head.length) clientSocket.unshift(head)

    const httpOverTls = http.createServer((req2, res2) => {
      this.handleHttpRequest(req2, res2, true).catch((err) => this.handleError(err, {}))
    })
    httpOverTls.on('clientError', (err, socket) => {
      try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n') } catch {}
      this.handleError(err, {})
    })

    const issued = await this.ca.issueHostCert(hostname)
    const tlsServer = tls.createServer({
      // Force http/1.1 to keep implementation simple and Chrome-compatible
      ALPNProtocols: ['http/1.1'],
      SNICallback: (servername, cb) => {
        const name = servername || hostname
        this.ca.getSecureContextForHost(name)
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

    tlsServer.on('error', (e) => this.handleError(e, ctx))

    // Hand off the existing TCP socket to the TLS server
    tlsServer.emit('connection', clientSocket)

    // Clean up when the client disconnects
    const cleanup = () => {
      try { tlsServer.close() } catch {}
      try { httpOverTls.close() } catch {}
    }
    clientSocket.on('close', cleanup)
    clientSocket.on('end', cleanup)
  }

  private async handleHttpRequest(clientReq: IncomingMessage, clientRes: http.ServerResponse, isHttps: boolean) {
    const id = genId('req')
    const h = clientReq.headers

    // Build full URL
    let fullUrl: URL
    if (clientReq.url && /^https?:\/\//i.test(clientReq.url)) {
      fullUrl = new URL(clientReq.url)
    } else {
      const hostHeader = h['host'] as string | undefined
      if (!hostHeader) {
        clientRes.writeHead(400, 'Bad Request: Missing Host header')
        clientRes.end()
        return
      }
      const { hostname, port } = parseHostPort(hostHeader)
      const protocol = isHttps ? 'https:' : 'http:'
      const portPart = port ? `:${port}` : ''
      fullUrl = new URL(`${protocol}//${hostname}${portPart}${clientReq.url || '/'}`)
    }

    const requestOptions: RequestOptions = {
      protocol: fullUrl.protocol,
      hostname: fullUrl.hostname,
      port: Number(fullUrl.port) || (fullUrl.protocol === 'https:' ? 443 : 80),
      method: clientReq.method,
      path: `${fullUrl.pathname}${fullUrl.search}`,
      headers: sanitizeHeaders(h as any),
    }

    const reqCtx: RequestContext = {
      id,
      isHttps,
      url: fullUrl,
      method: clientReq.method || 'GET',
      headers: h as any,
      clientIp: getRemote(clientReq.socket),
      requestOptions: requestOptions as any,
    }

    await this.runHook('onRequest', reqCtx)

    const upstream = fullUrl.protocol === 'https:' ? https : http
    const upstreamReq = upstream.request(requestOptions, async (upRes) => {
      const resCtx: ResponseContext = {
        ...reqCtx,
        statusCode: upRes.statusCode || 0,
        statusMessage: upRes.statusMessage,
        responseHeaders: upRes.headers as any,
      }

      await this.runHook('onResponse', resCtx)

      // Remove hop-by-hop headers
      const responseHeaders = sanitizeHeaders(upRes.headers as any)
      clientRes.writeHead(upRes.statusCode || 502, upRes.statusMessage, responseHeaders)
      upRes.pipe(clientRes)
    })

    upstreamReq.on('error', (err) => {
      this.handleError(err, reqCtx)
      if (!clientRes.headersSent) clientRes.writeHead(502, 'Bad Gateway')
      clientRes.end('Upstream error')
    })

    // Stream request body
    clientReq.pipe(upstreamReq)
  }

  private async runHook<K extends keyof ProxyPlugin>(hook: K, ctx: any) {
    for (const p of this.plugins) {
      try {
        const fn = p[hook]
        if (typeof fn === 'function') await (fn as any).call(p, ctx)
      } catch (e) {
        this.handleError(e, ctx)
      }
    }
  }

  private handleError(err: unknown, ctx: any) {
    for (const p of this.plugins) {
      try { p.onError?.(err, ctx) } catch {}
    }
  }
}

function getRemote(s: net.Socket): string | undefined {
  const a = s.remoteAddress
  const p = s.remotePort
  return a ? `${a}${p ? ':' + p : ''}` : undefined
}
