import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { ProxyPlugin } from '@arachne/proxy'
import { startUpstream, stopUpstream, startProxy, requestViaProxy, type Upstream } from './utils'


describe('HTTP-only proxy e2e', () => {
  let upstream: Upstream

  beforeAll(async () => {
    upstream = await startUpstream()
  })

  afterAll(async () => {
    await stopUpstream(upstream)
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