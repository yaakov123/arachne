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
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.url).toBe(target)
        expect(data.headers).toBeDefined()
        expect(data.origin).toBeDefined() // httpbin returns client IP
    })

    it('proxies POST requests with JSON body', async () => {
        const target = `${HTTPBIN_BASE}/post`
        const payload = { message: 'Hello httpbin', timestamp: Date.now() }

        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Header': 'proxy-test',
                },
                body: JSON.stringify(payload),
                agent: httpAgent,
            }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.json).toEqual(payload)
        expect(data.headers['X-Test-Header']).toBe('proxy-test')
        expect(data.headers['Content-Type']).toBe('application/json')
    })

    it('handles HTTP status codes correctly', async () => {
        // Test 404
        const res404 = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            `${HTTPBIN_BASE}/status/404`,
            { agent: createHttpAgent() }
        )
        expect(res404.status).toBe(404)

        // Test 500
        const res500 = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            `${HTTPBIN_BASE}/status/500`,
            { agent: createHttpAgent() }
        )
        expect(res500.status).toBe(500)

        // Test 201
        const res201 = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            `${HTTPBIN_BASE}/status/201`,
            { agent: createHttpAgent() }
        )
        expect(res201.status).toBe(201)
    })

    it('handles redirects properly', async () => {
        const { proxy, host, port } = await startProxy([])
        try {
            const target = `${HTTPBIN_BASE}/redirect/1`
            const res = await requestViaProxy(host, port, target, {
                agent: createHttpAgent(),
            })

            // Proxy should pass through redirect response (not follow it)
            expect(res.status).toBe(302)
            expect(res.headers.location).toBe('/get')

            // Verify redirect body contains expected HTML
            const body = res.body.toString('utf8')
            expect(body).toContain('Redirecting...')
            expect(body).toContain('href="/get"')

            // Client can manually follow the redirect if needed
            const redirectTarget = `${HTTPBIN_BASE}${res.headers.location}`
            const finalRes = await requestViaProxy(host, port, redirectTarget, {
                agent: createHttpAgent(),
            })
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
                special: ' !@#',
            })
        } finally {
            await proxy.stop()
        }
    })

    it('handles different HTTP methods', async () => {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

        for (const method of methods) {
            const target = `${HTTPBIN_BASE}/${method.toLowerCase()}`
            const res = await requestViaProxy(
                proxyInfo.host,
                proxyInfo.port,
                target,
                {
                    method,
                    headers:
                        method !== 'GET'
                            ? { 'Content-Type': 'application/json' }
                            : {},
                    body:
                        method !== 'GET'
                            ? JSON.stringify({ test: true })
                            : undefined,
                    agent: createHttpAgent(),
                }
            )

            expect(res.status).toBe(200)
            const data = JSON.parse(res.body.toString('utf8'))
            expect(data.url).toBe(target)
        }
    })

    it('handles form data submissions', async () => {
        const target = `${HTTPBIN_BASE}/post`
        const formData = 'name=John+Doe&email=john%40example.com&age=30'

        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.form).toEqual({
            name: 'John Doe',
            email: 'john@example.com',
            age: '30',
        })
    })

    it('handles gzip compressed responses', async () => {
        const target = `${HTTPBIN_BASE}/gzip`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.gzipped).toBe(true)
        expect(data.headers).toBeDefined()
    })

    it('handles cookies correctly', async () => {
        const target = `${HTTPBIN_BASE}/cookies/set/test-cookie/test-value`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(302)
        expect(res.headers['set-cookie']).toBeDefined()

        // Follow up with cookie verification
        const cookieTarget = `${HTTPBIN_BASE}/cookies`
        const cookieRes = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            cookieTarget,
            {
                headers: {
                    Cookie: 'test-cookie=test-value',
                },
                agent: createHttpAgent(),
            }
        )

        expect(cookieRes.status).toBe(200)
        const cookieData = JSON.parse(cookieRes.body.toString('utf8'))
        expect(cookieData.cookies['test-cookie']).toBe('test-value')
    })

    it('handles User-Agent and custom headers', async () => {
        const target = `${HTTPBIN_BASE}/headers`
        const customUserAgent = 'Arachne-Proxy-Test/1.0'

        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: {
                    'User-Agent': customUserAgent,
                    'X-Custom-Header': 'custom-value',
                    'X-Proxy-Test': 'true',
                },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.headers['User-Agent']).toBe(customUserAgent)
        expect(data.headers['X-Custom-Header']).toBe('custom-value')
        expect(data.headers['X-Proxy-Test']).toBe('true')
    })

    it('handles streaming responses', async () => {
        const target = `${HTTPBIN_BASE}/stream/5`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

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

        const credentials = Buffer.from(`${username}:${password}`).toString(
            'base64'
        )
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.authenticated).toBe(true)
        expect(data.user).toBe(username)
    })

    it('handles large response bodies', async () => {
        const target = `${HTTPBIN_BASE}/bytes/102400` // 100KB
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(200)
        expect(res.body.length).toBe(102400)
        expect(res.headers['content-length']).toBe('102400')
    })
})

describe('HTTP Proxy plugin integration with real traffic', () => {
    it('can modify request headers for external requests', async () => {
        const headerModifierPlugin: ProxyPlugin = {
            name: 'header-modifier',
            async beforeRequest(ctx) {
                ctx.request.setHeader('X-Proxy-Modified', 'true')
                ctx.request.setHeader('X-Original-Host', ctx.url.host)
            },
        }

        const { proxy, host, port } = await startProxy([headerModifierPlugin])
        try {
            const target = `${HTTPBIN_BASE}/headers`
            const res = await requestViaProxy(host, port, target, {
                agent: createHttpAgent(),
            })

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
            async beforeResponse(ctx) {
                if (ctx.url.pathname === '/json' && ctx.responseBody) {
                    const originalData = JSON.parse(
                        ctx.responseBody.toString('utf8')
                    )
                    const modifiedData = {
                        ...originalData,
                        modified: true,
                        proxyTimestamp: Date.now(),
                    }
                    ctx.response.setBody(JSON.stringify(modifiedData))
                }
            },
        }

        const { proxy, host, port } = await startProxy([responseModifierPlugin])
        try {
            const target = `${HTTPBIN_BASE}/json`
            const res = await requestViaProxy(host, port, target, {
                agent: createHttpAgent(),
            })

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
        const trafficLog: Array<{
            method: string
            url: string
            status: number
        }> = []

        const loggingPlugin: ProxyPlugin = {
            name: 'traffic-logger',
            async beforeRequest(ctx) {
                // Log on request
                trafficLog.push({
                    method: ctx.method,
                    url: ctx.url.toString(),
                    status: 0, // Will be updated in afterResponse
                })
            },
            async afterResponse(ctx) {
                // Update status in log
                const lastEntry = trafficLog[trafficLog.length - 1]
                if (lastEntry && lastEntry.url === ctx.url.toString()) {
                    lastEntry.status = ctx.finalStatusCode
                }
            },
        }

        const { proxy, host, port } = await startProxy([loggingPlugin])
        try {
            // Make multiple requests
            await requestViaProxy(host, port, `${HTTPBIN_BASE}/get`, {
                agent: createHttpAgent(),
            })
            await requestViaProxy(host, port, `${HTTPBIN_BASE}/status/404`, {
                agent: createHttpAgent(),
            })
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
            const res = await requestViaProxy(host, port, target, {
                agent: createHttpAgent(),
            })
            const duration = Date.now() - start

            expect(res.status).toBe(200)
            expect(duration).toBeGreaterThan(900) // Should take at least ~1 second
            expect(duration).toBeLessThan(10_000) // But not too long (allowing for network latency)
        } finally {
            await proxy.stop()
        }
    })
})

describe('HTTP Proxy extended functionality with real traffic', () => {
    let proxyInfo: { proxy: any; host: string; port: number }

    beforeAll(async () => {
        proxyInfo = await startProxy([])
    })

    afterAll(async () => {
        if (proxyInfo?.proxy) {
            await proxyInfo.proxy.stop()
        }
    })

    it('handles image responses (PNG)', async () => {
        const target = `${HTTPBIN_BASE}/image/png`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'image/png' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('image/png')
        expect(res.body.length).toBeGreaterThan(0)
        // Verify PNG signature (first 8 bytes)
        expect(res.body[0]).toBe(0x89)
        expect(res.body[1]).toBe(0x50) // 'P'
        expect(res.body[2]).toBe(0x4e) // 'N'
        expect(res.body[3]).toBe(0x47) // 'G'
    })

    it('handles image responses (JPEG)', async () => {
        const target = `${HTTPBIN_BASE}/image/jpeg`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'image/jpeg' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('image/jpeg')
        expect(res.body.length).toBeGreaterThan(0)
        // Verify JPEG signature (starts with 0xFF 0xD8)
        expect(res.body[0]).toBe(0xff)
        expect(res.body[1]).toBe(0xd8)
    })

    it('handles image responses (WebP)', async () => {
        const target = `${HTTPBIN_BASE}/image/webp`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'image/webp' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('image/webp')
        expect(res.body.length).toBeGreaterThan(0)
        // Verify WebP signature (RIFF...WEBP)
        expect(res.body.toString('ascii', 0, 4)).toBe('RIFF')
        expect(res.body.toString('ascii', 8, 12)).toBe('WEBP')
    })

    it('handles SVG image responses', async () => {
        const target = `${HTTPBIN_BASE}/image/svg`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'image/svg+xml' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('image/svg+xml')
        const svgContent = res.body.toString('utf8')
        expect(svgContent).toContain('<svg')
        expect(svgContent).toContain('</svg>')
    })

    it('handles multiple cookies in single request', async () => {
        const target = `${HTTPBIN_BASE}/cookies/set?cookie1=value1&cookie2=value2&cookie3=value3`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(302)
        const setCookieHeaders = res.headers['set-cookie']
        expect(Array.isArray(setCookieHeaders)).toBe(true)
        expect(setCookieHeaders).toHaveLength(3)

        // Verify each cookie is set correctly
        expect(
            setCookieHeaders!.some((cookie) =>
                cookie.includes('cookie1=value1')
            )
        ).toBe(true)
        expect(
            setCookieHeaders!.some((cookie) =>
                cookie.includes('cookie2=value2')
            )
        ).toBe(true)
        expect(
            setCookieHeaders!.some((cookie) =>
                cookie.includes('cookie3=value3')
            )
        ).toBe(true)
    })

    it('handles cookies with special characters', async () => {
        const specialValue = encodeURIComponent('value with spaces & symbols!')
        const target = `${HTTPBIN_BASE}/cookies/set/special-cookie/${specialValue}`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(302)
        expect(res.headers['set-cookie']).toBeDefined()

        // Verify the cookie with special characters
        const cookieTarget = `${HTTPBIN_BASE}/cookies`
        const cookieRes = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            cookieTarget,
            {
                headers: {
                    Cookie: `special-cookie=${specialValue}`,
                },
                agent: createHttpAgent(),
            }
        )

        expect(cookieRes.status).toBe(200)
        const cookieData = JSON.parse(cookieRes.body.toString('utf8'))
        expect(cookieData.cookies['special-cookie']).toBe(
            'value%20with%20spaces%20%26%20symbols!'
        )
    })

    it('handles XML responses', async () => {
        const target = `${HTTPBIN_BASE}/xml`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'application/xml' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('application/xml')
        const xmlContent = res.body.toString('utf8')
        expect(xmlContent).toContain('<?xml')
        expect(xmlContent).toContain('<slideshow')
    })

    it('handles HTML responses', async () => {
        const target = `${HTTPBIN_BASE}/html`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'text/html' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('text/html; charset=utf-8')
        const htmlContent = res.body.toString('utf8')
        expect(htmlContent).toContain('<!DOCTYPE html>')
        expect(htmlContent).toContain('<h1>Herman Melville - Moby-Dick</h1>')
    })

    it('handles robots.txt responses', async () => {
        const target = `${HTTPBIN_BASE}/robots.txt`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'text/plain' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('text/plain')
        const robotsContent = res.body.toString('utf8')
        expect(robotsContent).toContain('User-agent:')
        expect(robotsContent).toContain('Disallow:')
    })

    it('handles cache control headers', async () => {
        const target = `${HTTPBIN_BASE}/cache`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: {
                    'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT',
                },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(304)
    })

    it('handles ETag responses', async () => {
        const target = `${HTTPBIN_BASE}/etag/test-etag-123`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(200)
        expect(res.headers.etag).toBe('test-etag-123')

        // Test conditional request with matching ETag
        const conditionalRes = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { 'If-None-Match': '"test-etag-123"' },
                agent: createHttpAgent(),
            }
        )

        expect(conditionalRes.status).toBe(304) // Not Modified
    })

    it('handles deflate compressed responses', async () => {
        const target = `${HTTPBIN_BASE}/deflate`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.deflated).toBe(true)
        expect(data.headers).toBeDefined()
    })

    it('handles brotli compressed responses', async () => {
        const target = `${HTTPBIN_BASE}/brotli`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-encoding']).toBe('br')
        const brotliContent = res.body.toString('utf8')
        expect(brotliContent).toContain('brotli')
    })

    it('handles UTF-8 encoded responses', async () => {
        const target = `${HTTPBIN_BASE}/encoding/utf8`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Accept: 'text/html' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toContain('charset=utf-8')
        const htmlContent = res.body.toString('utf8')
        expect(htmlContent).toContain('UTF-8')
        expect(htmlContent).toContain('∮') // Unicode character
    })

    it('handles range requests for partial content', async () => {
        const target = `${HTTPBIN_BASE}/range/1024`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Range: 'bytes=0-99' },
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(206) // Partial Content
        expect(res.headers['content-range']).toBe('bytes 0-99/1024')
        expect(res.headers['content-length']).toBe('100')
        expect(res.body.length).toBe(100)
    })

    it('handles request with custom User-Agent variations', async () => {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'curl/7.68.0',
            'Python-urllib/3.8',
            'Arachne-Proxy-Test/2.0 (Custom Agent)',
        ]

        for (const userAgent of userAgents) {
            const target = `${HTTPBIN_BASE}/user-agent`
            const res = await requestViaProxy(
                proxyInfo.host,
                proxyInfo.port,
                target,
                {
                    headers: { 'User-Agent': userAgent },
                    agent: createHttpAgent(),
                }
            )

            expect(res.status).toBe(200)
            const data = JSON.parse(res.body.toString('utf8'))
            expect(data['user-agent']).toBe(userAgent)
        }
    })

    it('handles multiple redirect chains', async () => {
        const redirectCount = 5
        const target = `${HTTPBIN_BASE}/redirect/${redirectCount}`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(
            `/relative-redirect/${redirectCount - 1}`
        )
    })

    it('handles absolute redirect URLs', async () => {
        const target = `${HTTPBIN_BASE}/redirect-to?url=http://httpbin.org/get&status_code=301`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(301)
        expect(res.headers.location).toBe('http://httpbin.org/get')
    })

    it('handles digest authentication challenges', async () => {
        const target = `${HTTPBIN_BASE}/digest-auth/auth/testuser/testpass`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(401)
        expect(res.headers['www-authenticate']).toContain('Digest')
        expect(res.headers['www-authenticate']).toContain('realm=')
        expect(res.headers['www-authenticate']).toContain('nonce=')
    })

    it('handles bearer token authentication challenges', async () => {
        const target = `${HTTPBIN_BASE}/bearer`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )

        expect(res.status).toBe(401)
        expect(res.headers['www-authenticate']).toBe('Bearer')

        // Test with valid bearer token
        const tokenRes = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                headers: { Authorization: 'Bearer test-token-123' },
                agent: createHttpAgent(),
            }
        )

        expect(tokenRes.status).toBe(200)
        const data = JSON.parse(tokenRes.body.toString('utf8'))
        expect(data.authenticated).toBe(true)
        expect(data.token).toBe('test-token-123')
    })

    it('handles multipart form data with files', async () => {
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
        const formData = [
            `------WebKitFormBoundary7MA4YWxkTrZu0gW`,
            `Content-Disposition: form-data; name="field1"`,
            ``,
            `value1`,
            `------WebKitFormBoundary7MA4YWxkTrZu0gW`,
            `Content-Disposition: form-data; name="field2"`,
            ``,
            `value2`,
            `------WebKitFormBoundary7MA4YWxkTrZu0gW`,
            `Content-Disposition: form-data; name="file"; filename="test.txt"`,
            `Content-Type: text/plain`,
            ``,
            `This is a test file content`,
            `------WebKitFormBoundary7MA4YWxkTrZu0gW--`,
            ``,
        ].join('\r\n')

        const target = `${HTTPBIN_BASE}/post`
        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': Buffer.byteLength(formData).toString(),
                },
                body: formData,
                agent: createHttpAgent(),
            }
        )

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.form.field1).toBe('value1')
        expect(data.form.field2).toBe('value2')
        expect(data.files.file).toBe('This is a test file content')
    })

    it('handles request timeout scenarios', async () => {
        const target = `${HTTPBIN_BASE}/delay/2` // 2 second delay
        const start = Date.now()

        const res = await requestViaProxy(
            proxyInfo.host,
            proxyInfo.port,
            target,
            { agent: createHttpAgent() }
        )
        const duration = Date.now() - start

        expect(res.status).toBe(200)
        expect(duration).toBeGreaterThan(1800) // Should take at least ~2 seconds
        const data = JSON.parse(res.body.toString('utf8'))
        expect(data.args).toBeDefined()
    })

    it('handles HTTP/1.1 connection keep-alive', async () => {
        const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })

        try {
            // Make multiple requests with the same agent
            const requests = []
            for (let i = 0; i < 3; i++) {
                const target = `${HTTPBIN_BASE}/get?request=${i}`
                requests.push(
                    requestViaProxy(proxyInfo.host, proxyInfo.port, target, {
                        agent,
                    })
                )
            }

            const responses = await Promise.all(requests)

            responses.forEach((res, index) => {
                expect(res.status).toBe(200)
                const data = JSON.parse(res.body.toString('utf8'))
                expect(data.args.request).toBe(index.toString())
            })
        } finally {
            agent.destroy()
        }
    })
})
