import http, { IncomingMessage, RequestOptions } from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { URL } from 'node:url'
import zlib from 'node:zlib'
import { CertificateAuthority } from '../certs/ca.js'
import { ProxyPlugin, RequestContext, ResponseContext, ConnectContext, RequestBodyContext, ResponseBodyContext } from '../plugins/types.js'
import { genId, parseHostPort, sanitizeHeaders } from './utils.js'
import { enableSystemProxy, disableSystemProxy } from '../os/system-proxy.js'

const MAX_BODY_SIZE = 2 * 1024 * 1024 // 2MB safety limit

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
    try {
      console.log('[Arachne:Proxy] Enabling system proxy...')
      await enableSystemProxy(host, port)
      console.log('[Arachne:Proxy] Enabled system proxy')
    } catch {
      console.warn('Failed to enable system proxy')
    }
    return { host, port }
  }

  async stop(): Promise<void> {
    console.log('[Arachne:Proxy] Stopping proxy server...')
    await new Promise<void>((resolve, reject) => this.httpServer.close((err) => (err ? reject(err) : resolve())))
    console.log('[Arachne:Proxy] Stopped proxy server')
    try {
      console.log('[Arachne:Proxy] Disabling system proxy...')
      await disableSystemProxy()
      console.log('[Arachne:Proxy] Disabled system proxy')
    } catch {
      console.warn('Failed to disable system proxy')
    }
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

    const hasReqBodyHook = this.plugins.some(p => typeof p.onRequestBody === 'function')
    const hasResBodyHook = this.plugins.some(p => typeof p.onResponseBody === 'function')

    const method = (clientReq.method || 'GET').toUpperCase()
    const hasRequestBody = !['GET', 'HEAD'].includes(method)
    const reqContentLength = getNumericHeader(h['content-length'])
    const canBufferRequest = hasReqBodyHook && hasRequestBody && typeof reqContentLength === 'number' && reqContentLength > 0 && reqContentLength <= MAX_BODY_SIZE

    let requestBodyToSend: Buffer | undefined
    if (canBufferRequest) {
      try {
        const buffered = await readStreamToBuffer(clientReq, reqContentLength)
        const reqEnc = headerToString(h['content-encoding'])
        const decoded = await decodeBody(buffered, reqEnc)
        let bodyBuf = decoded
        const reqBodyCtx: RequestBodyContext = Object.assign({}, reqCtx, {
          body: bodyBuf,
          contentType: headerToString(h['content-type']),
          contentEncoding: reqEnc,
          setBody: (b: Buffer | string) => {
            bodyBuf = Buffer.isBuffer(b) ? b : Buffer.from(b)
          },
        })
        await this.runHook('onRequestBody', reqBodyCtx as any)
        requestBodyToSend = bodyBuf
        // Update headers for new body
        reqCtx.requestOptions.headers['content-length'] = String(requestBodyToSend.length)
        delete (reqCtx.requestOptions.headers as any)['transfer-encoding']
        if (reqEnc) delete (reqCtx.requestOptions.headers as any)['content-encoding']
      } catch (e) {
        // Fallback to streaming if anything goes wrong while buffering
        this.handleError(e, reqCtx)
      }
    }

    // Prefer uncompressed upstream responses if we plan to inspect/modify bodies
    if (hasResBodyHook) {
      reqCtx.requestOptions.headers['accept-encoding'] = 'identity'
    }

    const upstream = fullUrl.protocol === 'https:' ? https : http
    const upstreamReq = upstream.request(requestOptions, async (upRes) => {
      const resCtx: ResponseContext = {
        ...reqCtx,
        statusCode: upRes.statusCode || 0,
        statusMessage: upRes.statusMessage,
        responseHeaders: { ...(upRes.headers as any) },
      }

      await this.runHook('onResponse', resCtx)

      const statusCode = upRes.statusCode || 502
      const statusMessage = upRes.statusMessage

      const resContentLength = getNumericHeader(upRes.headers['content-length'])
      const resContentEncoding = headerToString(upRes.headers['content-encoding'])
      const isBodyless = method === 'HEAD' || [101, 204, 304].includes(statusCode) || (resContentLength === 0)

      const canBufferResponse = hasResBodyHook && !isBodyless && (
        (typeof resContentLength === 'number' && resContentLength >= 0 && resContentLength <= MAX_BODY_SIZE) ||
        (typeof resContentLength === 'undefined')
      )
      if (canBufferResponse) {
        try {
          const raw = await readStreamToBuffer(upRes, typeof resContentLength === 'number' ? resContentLength : (MAX_BODY_SIZE + 1))
          const decoded = await decodeBody(raw, resContentEncoding)
          let bodyBuf = decoded
          const resBodyCtx: ResponseBodyContext = Object.assign({}, resCtx, {
            body: bodyBuf,
            contentType: headerToString(upRes.headers['content-type']),
            contentEncoding: resContentEncoding,
            setBody: (b: Buffer | string) => {
              bodyBuf = Buffer.isBuffer(b) ? b : Buffer.from(b)
            },
          })
          await this.runHook('onResponseBody', resBodyCtx as any)

          // Prepare headers for uncompressed, rewritten body
          const headersOut = sanitizeHeaders(resCtx.responseHeaders as any)
          delete headersOut['content-encoding']
          headersOut['content-length'] = String(bodyBuf.length)

          clientRes.writeHead(statusCode, statusMessage, headersOut)
          clientRes.end(bodyBuf)
          return
        } catch (e) {
          this.handleError(e, resCtx)
          // Fallback to streaming original if rewrite fails
        }
      }

      // Default: stream original response through
      const responseHeaders = sanitizeHeaders(resCtx.responseHeaders as any)
      clientRes.writeHead(statusCode, statusMessage, responseHeaders)
      upRes.pipe(clientRes)
    })

    upstreamReq.on('error', (err) => {
      this.handleError(err, reqCtx)
      if (!clientRes.headersSent) clientRes.writeHead(502, 'Bad Gateway')
      clientRes.end('Upstream error')
    })

    if (requestBodyToSend) {
      upstreamReq.end(requestBodyToSend)
    } else {
      // Stream request body
      clientReq.pipe(upstreamReq)
    }
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

function getNumericHeader(h: string | string[] | number | undefined): number | undefined {
  if (typeof h === 'number') return h
  if (typeof h === 'string') {
    const n = parseInt(h, 10)
    return isNaN(n) ? undefined : n
  }
  if (Array.isArray(h)) {
    for (const v of h) {
      const n = parseInt(v, 10)
      if (!isNaN(n)) return n
    }
  }
  return undefined
}

function headerToString(h: string | string[] | undefined): string | undefined {
  if (typeof h === 'string') return h
  if (Array.isArray(h)) return h[0]
  return undefined
}

async function readStreamToBuffer(stream: NodeJS.ReadableStream, expectedLength: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream as any as AsyncIterable<Buffer>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > MAX_BODY_SIZE) throw new Error('Body too large')
    chunks.push(buf)
  }
  const out = Buffer.concat(chunks, total)
  if (typeof expectedLength === 'number' && expectedLength >= 0 && out.length !== expectedLength) {
    // Not a hard error; some servers may send without accurate length
  }
  return out
}

async function decodeBody(buf: Buffer, encoding?: string): Promise<Buffer> {
  const enc = (encoding || '').toLowerCase()
  if (!enc || enc === 'identity') return buf
  if (enc === 'gzip' || enc === 'x-gzip') {
    return await new Promise<Buffer>((res, rej) => zlib.gunzip(buf, (e, o) => e ? rej(e) : res(o)))
  }
  if (enc === 'deflate') {
    return await new Promise<Buffer>((res, rej) => zlib.inflate(buf, (e, o) => e ? rej(e) : res(o)))
  }
  if (enc === 'br') {
    return await new Promise<Buffer>((res, rej) => zlib.brotliDecompress(buf, (e, o) => e ? rej(e) : res(o)))
  }
  // Unknown encoding; return as-is
  return buf
}
