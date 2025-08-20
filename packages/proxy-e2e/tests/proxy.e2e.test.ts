import http from 'node:http'
import net from 'node:net'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MitmProxyServer, type ProxyPlugin } from '@arachne/proxy'



async function getFreePort(): Promise<number> {
  return await new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

type Upstream = { server: http.Server; host: string; port: number }

async function startUpstream(): Promise<Upstream> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname === '/get') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('X-Upstream', '1')
      res.end('ok')
      return
    }
    if (url.pathname === '/echo-headers') {
      const headers: Record<string, string | string[]> = {}
      for (const [k, v] of Object.entries(req.headers)) headers[k] = v as any
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ headers }))
      return
    }
    if (url.pathname === '/echo-body') {
      const body = await readBody(req)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Length', String(body.length))
      res.end(body)
      return
    }
    if (url.pathname === '/rewrite') {
      const text = 'original'
      const buf = Buffer.from(text)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Length', String(buf.length))
      res.end(buf)
      return
    }
    if (url.pathname === '/large') {
      const size = 2 * 1024 * 1024 + 100 // > 2MB
      const buf = Buffer.alloc(size, 0x61) // 'a'
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Length', String(buf.length))
      res.end(buf)
      return
    }
    res.statusCode = 404
    res.end('not found')
  })

  const port = await getFreePort()
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return { server, host: '127.0.0.1', port }
}

async function startProxy(plugins: ProxyPlugin[] = []) {
  const port = await getFreePort()
  const proxy = new MitmProxyServer({ host: '127.0.0.1', port, plugins })
  await proxy.start()
  // We explicitly choose the port, so we already know where it's listening
  return { proxy, host: '127.0.0.1', port }
}

type RequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
}

async function requestViaProxy(proxyHost: string, proxyPort: number, target: string, opts: RequestOptions = {}) {
  const url = new URL(target)
  const method = opts.method || 'GET'
  const headers: Record<string, string> = Object.assign({
    Host: url.host,
    Connection: 'close',
  }, opts.headers || {})
  const body = opts.body
  if (body && !('content-length' in Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])))) {
    headers['Content-Length'] = String(Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body))
  }
  return await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const req = http.request({
      hostname: proxyHost,
      port: proxyPort,
      method,
      path: url.toString(), // absolute-form; proxy will parse full URL
      headers,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    if (body) req.end(body)
    else req.end()
  })
}

describe('HTTP-only proxy e2e', () => {
  let upstream: Upstream

  beforeAll(async () => {
    upstream = await startUpstream()
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => upstream.server.close(() => resolve()))
  })


  it('passes through HTTP GET responses unchanged', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const target = `http://${upstream.host}:${upstream.port}/get`
      const res = await requestViaProxy(host, port, target)
      expect(res.status).toBe(200)
      expect(res.body.toString('utf8')).toBe('ok')
      expect(res.headers['x-upstream']).toBe('1')
    } finally {
      await proxy.stop()
    }
  })

  it('sanitizes headers (removes proxy-connection)', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const target = `http://${upstream.host}:${upstream.port}/echo-headers`
      const res = await requestViaProxy(host, port, target, { headers: { 'Proxy-Connection': 'keep-alive' } })
      expect(res.status).toBe(200)
      const payload = JSON.parse(res.body.toString('utf8')) as { headers: Record<string, any> }
      const hasProxyConnection = Object.keys(payload.headers).some((k) => k.toLowerCase() === 'proxy-connection')
      expect(hasProxyConnection).toBe(false)
    } finally {
      await proxy.stop()
    }
  })

  it('can rewrite request bodies via onRequestBody (HTTP)', async () => {
    const rewriteReq: ProxyPlugin = {
      name: 'rewrite-req',
      async onRequestBody(ctx) {
        // append a field to JSON payload
        const obj = JSON.parse(ctx.body.toString('utf8'))
        obj.added = true
        ctx.setBody(JSON.stringify(obj))
      },
    }
    const { proxy, host, port } = await startProxy([rewriteReq])
    try {
      const target = `http://${upstream.host}:${upstream.port}/echo-body`
      const original = JSON.stringify({ hello: 'world' })
      const res = await requestViaProxy(host, port, target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: original,
      })
      expect(res.status).toBe(200)
      const echoed = JSON.parse(res.body.toString('utf8'))
      expect(echoed.hello).toBe('world')
      expect(echoed.added).toBe(true)
    } finally {
      await proxy.stop()
    }
  })

  it('can rewrite response bodies via onResponseBody (HTTP)', async () => {
    const rewriteRes: ProxyPlugin = {
      name: 'rewrite-res',
      async onResponseBody(ctx) {
        if (ctx.url.pathname === '/rewrite') ctx.setBody('rewritten')
      },
    }
    const { proxy, host, port } = await startProxy([rewriteRes])
    try {
      const target = `http://${upstream.host}:${upstream.port}/rewrite`
      const res = await requestViaProxy(host, port, target)
      expect(res.status).toBe(200)
      expect(res.body.toString('utf8')).toBe('rewritten')
      // Proxy should have normalized headers to uncompressed length
      expect(res.headers['content-encoding']).toBeUndefined()
      expect(res.headers['content-length']).toBe(String('rewritten'.length))
    } finally {
      await proxy.stop()
    }
  })

  it('streams large HTTP responses without buffering', async () => {
    const { proxy, host, port } = await startProxy([]) // no body hooks => stream
    try {
      const target = `http://${upstream.host}:${upstream.port}/large`
      const res = await requestViaProxy(host, port, target)
      expect(res.status).toBe(200)
      expect(res.body.length).toBeGreaterThan(2 * 1024 * 1024)
    } finally {
      await proxy.stop()
    }
  })
})