import http from 'node:http'
import zlib from 'node:zlib'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startUpstream, stopUpstream, startProxy, requestViaProxy, getFreePort, type Upstream } from './utils'
import type { ProxyPlugin } from '@arachne/proxy'

function gunzip(buf: Buffer): Promise<Buffer> {
  return new Promise((res, rej) => zlib.gunzip(buf, (e, out) => e ? rej(e) : res(out)))
}
function inflate(buf: Buffer): Promise<Buffer> {
  return new Promise((res, rej) => zlib.inflate(buf, (e, out) => e ? rej(e) : res(out)))
}
function brotli(buf: Buffer): Promise<Buffer> {
  return new Promise((res, rej) => zlib.brotliDecompress(buf, (e, out) => e ? rej(e) : res(out)))
}

describe('HTTP-only proxy e2e - extended', () => {
  let upstream: Upstream

  beforeAll(async () => {
    upstream = await startUpstream()
  })

  afterAll(async () => {
    await stopUpstream(upstream)
  })

  it('handles origin-form requests (Host header path)', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const target = `http://${upstream.host}:${upstream.port}/get`
      const res = await requestViaProxy(host, port, target, { originForm: true })
      expect(res.status).toBe(200)
      expect(res.body.toString('utf8')).toBe('ok')
    } finally {
      await proxy.stop()
    }
  })

  it('passes through redirects (302 Location)', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const target = `http://${upstream.host}:${upstream.port}/redirect?to=/get`
      const res = await requestViaProxy(host, port, target)
      expect(res.status).toBe(302)
      expect(res.headers['location']).toBe('/get')
    } finally {
      await proxy.stop()
    }
  })

  it('HEAD/204/304 have no bodies', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      // HEAD
      const headRes = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/head`, { method: 'HEAD' })
      expect(headRes.status).toBe(200)
      expect(headRes.body.length).toBe(0)

      // 204
      const res204 = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/status-204`)
      expect(res204.status).toBe(204)
      expect(res204.body.length).toBe(0)

      // 304
      const res304 = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/status-304`)
      expect(res304.status).toBe(304)
      expect(res304.body.length).toBe(0)
    } finally {
      await proxy.stop()
    }
  })

  it('passes through non-GET verbs', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const base = `http://${upstream.host}:${upstream.port}`
      const put = await requestViaProxy(host, port, `${base}/echo-body`, { method: 'PUT', body: 'abc' })
      expect(put.status).toBe(200)
      expect(put.body.toString('utf8')).toBe('abc')

      const del = await requestViaProxy(host, port, `${base}/echo-method`, { method: 'DELETE' })
      expect(del.status).toBe(200)
      expect(JSON.parse(del.body.toString('utf8')).method).toBe('DELETE')

      const patch = await requestViaProxy(host, port, `${base}/echo-method`, { method: 'PATCH' })
      expect(patch.status).toBe(200)
      expect(JSON.parse(patch.body.toString('utf8')).method).toBe('PATCH')
    } finally {
      await proxy.stop()
    }
  })

  it('absolute-form vs origin-form parity', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const target = `http://${upstream.host}:${upstream.port}/echo-query?a=1&b=2`
      const abs = await requestViaProxy(host, port, target)
      const ori = await requestViaProxy(host, port, target, { originForm: true })
      expect(abs.status).toBe(200)
      expect(ori.status).toBe(200)
      expect(abs.body.toString('utf8')).toBe(ori.body.toString('utf8'))
    } finally {
      await proxy.stop()
    }
  })

  it('injects Accept-Encoding: identity when rewriting responses', async () => {
    const plugin: ProxyPlugin = { name: 'res-noop', async onResponseBody() { /* noop */ } }
    const { proxy, host, port } = await startProxy([plugin])
    try {
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/echo-headers`)
      const payload = JSON.parse(res.body.toString('utf8')) as { headers: Record<string, any> }
      const ae = Object.entries(payload.headers).find(([k]) => k.toLowerCase() === 'accept-encoding')?.[1]
      const aeStr = Array.isArray(ae) ? ae[0] : ae
      expect(String(aeStr)).toBe('identity')
    } finally {
      await proxy.stop()
    }
  })

  it('passes through compressed responses unchanged when no body hook', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const base = `http://${upstream.host}:${upstream.port}`
      const gz = await requestViaProxy(host, port, `${base}/compressed/gzip`)
      expect(gz.headers['content-encoding']).toBe('gzip')
      expect((await gunzip(gz.body)).toString('utf8')).toBe('hello compressed')
      const df = await requestViaProxy(host, port, `${base}/compressed/deflate`)
      expect(df.headers['content-encoding']).toBe('deflate')
      expect((await inflate(df.body)).toString('utf8')).toBe('hello compressed')
      const br = await requestViaProxy(host, port, `${base}/compressed/br`)
      expect(br.headers['content-encoding']).toBe('br')
      expect((await brotli(br.body)).toString('utf8')).toBe('hello compressed')
    } finally {
      await proxy.stop()
    }
  })

  it('rewrites compressed responses and removes content-encoding', async () => {
    const plugin: ProxyPlugin = { name: 'res-rewrite', async onResponseBody(ctx) { ctx.setBody('rewritten') } }
    const { proxy, host, port } = await startProxy([plugin])
    try {
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/compressed/gzip`)
      expect(res.status).toBe(200)
      expect(res.headers['content-encoding']).toBeUndefined()
      expect(res.headers['content-length']).toBe(String('rewritten'.length))
      expect(res.body.toString('utf8')).toBe('rewritten')
    } finally {
      await proxy.stop()
    }
  })

  it('removes transfer-encoding when rewriting a chunked response', async () => {
    const plugin: ProxyPlugin = { name: 'res-rewrite-chunked', async onResponseBody(ctx) { ctx.setBody('rewritten-chunked') } }
    const { proxy, host, port } = await startProxy([plugin])
    try {
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/chunked`)
      expect(res.status).toBe(200)
      expect(res.headers['transfer-encoding']).toBeUndefined()
      expect(res.headers['content-length']).toBe(String('rewritten-chunked'.length))
      expect(res.body.toString('utf8')).toBe('rewritten-chunked')
    } finally {
      await proxy.stop()
    }
  })

  it('streams chunked request bodies unchanged', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const body = 'stream-chunk-body'
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/echo-body`, { method: 'POST', body, streamBody: true })
      expect(res.status).toBe(200)
      expect(res.body.toString('utf8')).toBe(body)
    } finally {
      await proxy.stop()
    }
  })

  it('decodes gzipped request bodies when rewriting and updates headers', async () => {
    const plugin: ProxyPlugin = {
      name: 'req-rewrite-decode',
      async onRequestBody(ctx) {
        const obj = JSON.parse(ctx.body.toString('utf8'))
        obj.added = true
        ctx.setBody(JSON.stringify(obj))
      },
    }
    const { proxy, host, port } = await startProxy([plugin])
    try {
      const original = JSON.stringify({ hello: 'world' })
      const gz: Buffer = await new Promise((res, rej) => zlib.gzip(Buffer.from(original), (e, o) => e ? rej(e) : res(o)))
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/echo-body`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
        body: gz,
      })
      expect(res.status).toBe(200)
      const echoed = JSON.parse(res.body.toString('utf8'))
      expect(echoed.hello).toBe('world')
      expect(echoed.added).toBe(true)
    } finally {
      await proxy.stop()
    }
  })

  it('does not buffer request bodies larger than MAX_BODY_SIZE when rewriting', async () => {
    const plugin: ProxyPlugin = { name: 'req-rewrite-large', async onRequestBody(ctx) { ctx.setBody('MUTATED') } }
    const { proxy, host, port } = await startProxy([plugin])
    try {
      const big = Buffer.alloc(2 * 1024 * 1024 + 10, 0x62) // >2MB of 'b'
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/echo-body`, { method: 'POST', body: big })
      expect(res.status).toBe(200)
      // If it had buffered and mutated, body would be 'MUTATED'
      expect(res.body.equals(big)).toBe(true)
    } finally {
      await proxy.stop()
    }
  })

  it('does not buffer response bodies larger than MAX_BODY_SIZE when rewriting', async () => {
    const plugin: ProxyPlugin = { name: 'res-rewrite-large', async onResponseBody(ctx) { ctx.setBody('MUTATED') } }
    const { proxy, host, port } = await startProxy([plugin])
    try {
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/large`)
      expect(res.status).toBe(200)
      expect(res.body.length).toBeGreaterThan(2 * 1024 * 1024)
      // Not rewritten
      expect(res.body.toString('utf8').startsWith('a')).toBe(true)
    } finally {
      await proxy.stop()
    }
  })

  it('passes through upstream 500 errors', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/error-500`)
      expect(res.status).toBe(500)
      expect(res.body.toString('utf8')).toBe('boom')
    } finally {
      await proxy.stop()
    }
  })

  it('returns 502 on connection refused', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const free = await getFreePort() // no server listening here
      const res = await requestViaProxy(host, port, `http://127.0.0.1:${free}/nope`)
      expect(res.status).toBe(502)
      expect(res.body.toString('utf8')).toContain('Upstream error')
    } finally {
      await proxy.stop()
    }
  })

  it('sanitizes Connection header variants correctly', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const base = `http://${upstream.host}:${upstream.port}`
      const upg = await requestViaProxy(host, port, `${base}/echo-headers`, { headers: { Connection: 'upgrade' } })
      let payload = JSON.parse(upg.body.toString('utf8')) as { headers: Record<string, any> }
      const connUpg = Object.entries(payload.headers).find(([k]) => k.toLowerCase() === 'connection')?.[1]
      const connUpgVal = connUpg ? String(Array.isArray(connUpg) ? connUpg[0] : connUpg).toLowerCase() : ''
      expect(connUpgVal).not.toBe('upgrade')

      const rnd = await requestViaProxy(host, port, `${base}/echo-headers`, { headers: { Connection: 'random' } })
      payload = JSON.parse(rnd.body.toString('utf8'))
      const connRnd = Object.entries(payload.headers).find(([k]) => k.toLowerCase() === 'connection')?.[1]
      const connRndVal = connRnd ? String(Array.isArray(connRnd) ? connRnd[0] : connRnd).toLowerCase() : ''
      expect(connRndVal).not.toBe('random')

      const ka = await requestViaProxy(host, port, `${base}/echo-headers`, { headers: { Connection: 'keep-alive' } })
      payload = JSON.parse(ka.body.toString('utf8'))
      const connHeader = Object.entries(payload.headers).find(([k]) => k.toLowerCase() === 'connection')?.[1]
      const connVal = Array.isArray(connHeader) ? connHeader[0] : connHeader
      expect(String(connVal).toLowerCase()).toBe('keep-alive')
    } finally {
      await proxy.stop()
    }
  })

  it('allows request/response header mutation via hooks (streaming and rewrite)', async () => {
    const requestHeaderPlugin: ProxyPlugin = {
      name: 'set-req-header',
      async onRequest(ctx) {
        (ctx.requestOptions.headers as any)['x-from-plugin'] = '1'
      },
    }
    const responseHeaderPlugin: ProxyPlugin = {
      name: 'set-res-header',
      async onResponse(ctx) {
        ctx.responseHeaders['x-added'] = '1'
      },
    }

    // Streaming path
    {
      const { proxy, host, port } = await startProxy([requestHeaderPlugin, responseHeaderPlugin])
      try {
        const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/echo-headers`)
        const payload = JSON.parse(res.body.toString('utf8')) as { headers: Record<string, any> }
        const xf = Object.entries(payload.headers).find(([k]) => k.toLowerCase() === 'x-from-plugin')?.[1]
        expect(String(Array.isArray(xf) ? xf[0] : xf)).toBe('1')
        expect(res.headers['x-added']).toBe('1')
      } finally {
        await proxy.stop()
      }
    }

    // Rewrite path
    {
      const { proxy, host, port } = await startProxy([requestHeaderPlugin, responseHeaderPlugin, { name: 'rewrite', async onResponseBody(ctx) { ctx.setBody('rw') } }])
      try {
        const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/rewrite`)
        expect(res.body.toString('utf8')).toBe('rw')
        expect(res.headers['x-added']).toBe('1')
      } finally {
        await proxy.stop()
      }
    }
  })

  it('applies plugins in insertion order', async () => {
    const a: ProxyPlugin = { name: 'A', async onRequestBody(ctx) { ctx.setBody('A') } }
    const b: ProxyPlugin = { name: 'B', async onRequestBody(ctx) { ctx.setBody(ctx.body.toString('utf8') + 'B') } }
    const { proxy, host, port } = await startProxy([a, b])
    try {
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/echo-body`, { method: 'POST', body: 'start' })
      expect(res.status).toBe(200)
      expect(res.body.toString('utf8')).toBe('AB')
    } finally {
      await proxy.stop()
    }
  })

  it('invokes onError hook when a plugin throws', async () => {
    const throwing: ProxyPlugin = { name: 'thrower', async onRequest() { throw new Error('fail') } }
    const catcher: ProxyPlugin = { name: 'catcher', async onError(_err, ctx) { (ctx.requestOptions.headers as any)['x-error-handled'] = '1' } }
    const { proxy, host, port } = await startProxy([throwing, catcher])
    try {
      const res = await requestViaProxy(host, port, `http://${upstream.host}:${upstream.port}/echo-headers`)
      const payload = JSON.parse(res.body.toString('utf8')) as { headers: Record<string, any> }
      const xeh = Object.entries(payload.headers).find(([k]) => k.toLowerCase() === 'x-error-handled')?.[1]
      expect(String(Array.isArray(xeh) ? xeh[0] : xeh)).toBe('1')
    } finally {
      await proxy.stop()
    }
  })

  it('handles concurrency of multiple parallel requests', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const base = `http://${upstream.host}:${upstream.port}/get`
      const N = 20
      const results = await Promise.all(Array.from({ length: N }, () => requestViaProxy(host, port, base)))
      for (const r of results) expect(r.status).toBe(200)
    } finally {
      await proxy.stop()
    }
  })

  it('preserves query strings exactly for absolute and origin-form', async () => {
    const { proxy, host, port } = await startProxy([])
    try {
      const target = `http://${upstream.host}:${upstream.port}/echo-query?a=1&b=2`
      const abs = await requestViaProxy(host, port, target)
      const ori = await requestViaProxy(host, port, target, { originForm: true })
      expect(abs.body.toString('utf8')).toBe(ori.body.toString('utf8'))
    } finally {
      await proxy.stop()
    }
  })

  it('works with a keep-alive client agent and preserves Connection: keep-alive', async () => {
    const { proxy, host, port } = await startProxy([])
    const agent = new http.Agent({ keepAlive: true })
    try {
      const base = `http://${upstream.host}:${upstream.port}`
      const r1 = await requestViaProxy(host, port, `${base}/echo-headers`, { agent })
      const r2 = await requestViaProxy(host, port, `${base}/echo-headers`, { agent })
      const p1 = JSON.parse(r1.body.toString('utf8')) as { headers: Record<string, any> }
      const conn = Object.entries(p1.headers).find(([k]) => k.toLowerCase() === 'connection')?.[1]
      const connVal = Array.isArray(conn) ? conn[0] : conn
      expect(String(connVal).toLowerCase()).toBe('keep-alive')
      expect(r1.status).toBe(200)
      expect(r2.status).toBe(200)
    } finally {
      agent.destroy()
      await proxy.stop()
    }
  })
})
