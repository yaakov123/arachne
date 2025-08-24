import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import type { ProxyPlugin } from '@arachne/proxy'
import { startProxy, requestViaProxy } from './utils'

/**
 * Real traffic E2E tests using httpbin.org
 * These tests validate proxy behavior with actual external HTTP traffic
 */
const HTTPBIN_BASE = 'http://httpbin.org'

function createHttpAgent() {
    return new http.Agent()
}

describe('HTTP Proxy E2E with real traffic (httpbin.org)', () => {
    let proxyInfo: { proxy: any; host: string; port: number }
    let httpAgent: http.Agent

    beforeAll(async () => {
        // Start proxy once for all tests - this is the real-world scenario
        proxyInfo = await startProxy([])
        // Use HTTP agent with connection pooling to properly manage client connections
        httpAgent = createHttpAgent()
    })

    afterAll(async () => {
        if (proxyInfo?.proxy) {
            await proxyInfo.proxy.stop()
        }
        if (httpAgent) {
            httpAgent.destroy()
        }
    })

    it('proxies basic GET requests to httpbin', async () => {
        const target = `${HTTPBIN_BASE}/get`
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, { agent: createHttpAgent() })
        
        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.url).toBe(target)
        expect(data.headers).toBeDefined()
        expect(data.origin).toBeDefined() // httpbin returns client IP
    })

    it('proxies POST requests with JSON body', async () => {
        const target = `${HTTPBIN_BASE}/post`
        const payload = { message: 'Hello httpbin', timestamp: Date.now() }
        
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Test-Header': 'proxy-test'
            },
            body: JSON.stringify(payload),
            agent: httpAgent,
        })
        
        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.json).toEqual(payload)
        expect(data.headers['X-Test-Header']).toBe('proxy-test')
        expect(data.headers['Content-Type']).toBe('application/json')
    })

    it('handles HTTP status codes correctly', async () => {
        // Test 404
        const res404 = await requestViaProxy(proxyInfo.host, proxyInfo.port, `${HTTPBIN_BASE}/status/404`, { agent: createHttpAgent() })
        expect(res404.status).toBe(404)

        // Test 500
        const res500 = await requestViaProxy(proxyInfo.host, proxyInfo.port, `${HTTPBIN_BASE}/status/500`, { agent: createHttpAgent() })
        expect(res500.status).toBe(500)

        // Test 201
        const res201 = await requestViaProxy(proxyInfo.host, proxyInfo.port, `${HTTPBIN_BASE}/status/201`, { agent: createHttpAgent() })
        expect(res201.status).toBe(201)
    })

    it('handles redirects properly', async () => {
        const { proxy, host, port } = await startProxy([])
        try {
            const target = `${HTTPBIN_BASE}/redirect/1`
            const res = await requestViaProxy(host, port, target, { agent: createHttpAgent() })
            
            // Proxy should pass through redirect response (not follow it)
            expect(res.status).toBe(302)
            expect(res.headers.location).toBe('/get')
            
            // Verify redirect body contains expected HTML
            const body = res.body.toString('utf8')
            expect(body).toContain('Redirecting...')
            expect(body).toContain('href="/get"')
            
            // Client can manually follow the redirect if needed
            const redirectTarget = `${HTTPBIN_BASE}${res.headers.location}`
            const finalRes = await requestViaProxy(host, port, redirectTarget, { agent: createHttpAgent() })
            expect(finalRes.status).toBe(200)
            const finalData = JSON.parse(finalRes.body.toString('utf8'))
            expect(finalData.url).toBe(`${HTTPBIN_BASE}/get`)
        } finally {
            await proxy.stop()
        }
    })

    it('preserves query parameters', async () => {
        const { proxy, host, port } = await startProxy([])
        try {
            const target = `${HTTPBIN_BASE}/get?param1=value1&param2=value2&special=%20%21%40%23`
            const res = await requestViaProxy(host, port, target)
            
            expect(res.status).toBe(200)
            const data = JSON.parse(res.body.toString('utf8'))
            expect(data.args).toEqual({
                param1: 'value1',
                param2: 'value2',
                special: ' !@#'
            })
        } finally {
            await proxy.stop()
        }
    })

    it('handles different HTTP methods', async () => {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        
        for (const method of methods) {
            const target = `${HTTPBIN_BASE}/${method.toLowerCase()}`
            const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, {
                method,
                headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
                body: method !== 'GET' ? JSON.stringify({ test: true }) : undefined,
                agent: createHttpAgent(),
            })
            
            expect(res.status).toBe(200)
            const data = JSON.parse(res.body.toString('utf8'))
            expect(data.url).toBe(target)
        }
    })

    it('handles form data submissions', async () => {
        const target = `${HTTPBIN_BASE}/post`
        const formData = 'name=John+Doe&email=john%40example.com&age=30'
        
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
            agent: createHttpAgent(),
        })
        
        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.form).toEqual({
            name: 'John Doe',
            email: 'john@example.com',
            age: '30'
        })
    })

    it('handles gzip compressed responses', async () => {
        const target = `${HTTPBIN_BASE}/gzip`
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, { agent: createHttpAgent() })
        
        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.gzipped).toBe(true)
        expect(data.headers).toBeDefined()
    })

    it('handles cookies correctly', async () => {
        const target = `${HTTPBIN_BASE}/cookies/set/test-cookie/test-value`
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, { agent: createHttpAgent() })
        
        expect(res.status).toBe(302)
        expect(res.headers['set-cookie']).toBeDefined()
        
        // Follow up with cookie verification
        const cookieTarget = `${HTTPBIN_BASE}/cookies`
        const cookieRes = await requestViaProxy(proxyInfo.host, proxyInfo.port, cookieTarget, {
            headers: {
                'Cookie': 'test-cookie=test-value'
            },
            agent: createHttpAgent(),
        })
        
        expect(cookieRes.status).toBe(200)
        const cookieData = JSON.parse(cookieRes.body.toString('utf8'))
        expect(cookieData.cookies['test-cookie']).toBe('test-value')
    })

    it('handles User-Agent and custom headers', async () => {
        const target = `${HTTPBIN_BASE}/headers`
        const customUserAgent = 'Arachne-Proxy-Test/1.0'
        
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, {
            headers: {
                'User-Agent': customUserAgent,
                'X-Custom-Header': 'custom-value',
                'X-Proxy-Test': 'true'
            },
            agent: createHttpAgent(),
        })
        
        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.headers['User-Agent']).toBe(customUserAgent)
        expect(data.headers['X-Custom-Header']).toBe('custom-value')
        expect(data.headers['X-Proxy-Test']).toBe('true')
    })

    it('handles streaming responses', async () => {
        const target = `${HTTPBIN_BASE}/stream/5`
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, { agent: createHttpAgent() })
        
        expect(res.status).toBe(200)
        const responseText = res.body.toString('utf8')
        const lines = responseText.trim().split('\n')
        expect(lines).toHaveLength(5)
        
        // Each line should be valid JSON
        lines.forEach((line, index) => {
            const data = JSON.parse(line)
            expect(data.id).toBe(index)
            expect(data.url).toBe(target)
        })
    })

    it('handles basic authentication', async () => {
        const username = 'testuser'
        const password = 'testpass'
        const target = `${HTTPBIN_BASE}/basic-auth/${username}/${password}`
        
        const credentials = Buffer.from(`${username}:${password}`).toString('base64')
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, {
            headers: {
                'Authorization': `Basic ${credentials}`
            },
            agent: createHttpAgent(),
        })
        
        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.authenticated).toBe(true)
        expect(data.user).toBe(username)
    })

    it('handles large response bodies', async () => {
        const target = `${HTTPBIN_BASE}/bytes/102400` // 100KB
        const res = await requestViaProxy(proxyInfo.host, proxyInfo.port, target, { agent: createHttpAgent() })
        
        expect(res.status).toBe(200)
        expect(res.body.length).toBe(102400)
        expect(res.headers['content-length']).toBe('102400')
    })
})

describe('HTTP Proxy plugin integration with real traffic', () => {
    it('can modify request headers for external requests', async () => {
        const headerModifierPlugin: ProxyPlugin = {
            name: 'header-modifier',
            async onRequest(ctx) {
                ctx.headers['X-Proxy-Modified'] = 'true'
                ctx.headers['X-Original-Host'] = ctx.url.host
            }
        }
        
        const { proxy, host, port } = await startProxy([headerModifierPlugin])
        try {
            const target = `${HTTPBIN_BASE}/headers`
            const res = await requestViaProxy(host, port, target, { agent: createHttpAgent() })
            
            expect(res.status).toBe(200)
            const data = JSON.parse(res.body.toString('utf8'))
            expect(data.headers['X-Proxy-Modified']).toBe('true')
            expect(data.headers['X-Original-Host']).toBe('httpbin.org')
        } finally {
            await proxy.stop()
        }
    })

    it('can modify response body from external requests', async () => {
        const responseModifierPlugin: ProxyPlugin = {
            name: 'response-modifier',
            async onResponseBody(ctx) {
                if (ctx.url.pathname === '/json') {
                    const originalData = JSON.parse(ctx.body.toString('utf8'))
                    const modifiedData = {
                        ...originalData,
                        modified: true,
                        proxyTimestamp: Date.now()
                    }
                    ctx.setBody(JSON.stringify(modifiedData))
                }
            }
        }
        
        const { proxy, host, port } = await startProxy([responseModifierPlugin])
        try {
            const target = `${HTTPBIN_BASE}/json`
            const res = await requestViaProxy(host, port, target, { agent: createHttpAgent() })
            
            expect(res.status).toBe(200)
            const data = JSON.parse(res.body.toString('utf8'))
            expect(data.modified).toBe(true)
            expect(data.proxyTimestamp).toBeDefined()
            expect(typeof data.proxyTimestamp).toBe('number')
        } finally {
            await proxy.stop()
        }
    })

    it('can log and analyze real traffic', async () => {
        const trafficLog: Array<{ method: string; url: string; status: number }> = []
        
        const loggingPlugin: ProxyPlugin = {
            name: 'traffic-logger',
            async onRequest(ctx) {
                // Log on request
                trafficLog.push({
                    method: ctx.method,
                    url: ctx.url.toString(),
                    status: 0 // Will be updated in onResponse
                })
            },
            async onResponse(ctx) {
                // Update status in log
                const lastEntry = trafficLog[trafficLog.length - 1]
                if (lastEntry && lastEntry.url === ctx.url.toString()) {
                    lastEntry.status = ctx.statusCode
                }
            }
        }
        
        const { proxy, host, port } = await startProxy([loggingPlugin])
        try {
            // Make multiple requests
            await requestViaProxy(host, port, `${HTTPBIN_BASE}/get`, { agent: createHttpAgent() })
            await requestViaProxy(host, port, `${HTTPBIN_BASE}/status/404`, { agent: createHttpAgent() })
            await requestViaProxy(host, port, `${HTTPBIN_BASE}/post`, {
                method: 'POST',
                body: JSON.stringify({ test: true }),
                agent: createHttpAgent(),
            })
            
            expect(trafficLog).toHaveLength(3)
            expect(trafficLog[0].method).toBe('GET')
            expect(trafficLog[0].status).toBe(200)
            expect(trafficLog[1].status).toBe(404)
            expect(trafficLog[2].method).toBe('POST')
            expect(trafficLog[2].status).toBe(200)
        } finally {
            await proxy.stop()
        }
    })

    it('preserves httpbin response timing information', async () => {
        const target = `${HTTPBIN_BASE}/delay/1` // 1 second delay
        const start = Date.now()
        
        const { proxy, host, port } = await startProxy([])
        try {
            const res = await requestViaProxy(host, port, target, { agent: createHttpAgent() })
            const duration = Date.now() - start
            
            expect(res.status).toBe(200)
            expect(duration).toBeGreaterThan(900) // Should take at least ~1 second
            expect(duration).toBeLessThan(3000) // But not too long (allowing for network latency)
        } finally {
            await proxy.stop()
        }
    })
})
