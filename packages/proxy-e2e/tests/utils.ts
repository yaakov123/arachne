import http from 'node:http'
import net from 'node:net'
import zlib from 'node:zlib'
import { MitmProxyServer, type ProxyPlugin } from '@arachne/proxy'

export type Upstream = { server: http.Server; host: string; port: number }

export async function getFreePort(): Promise<number> {
    return await new Promise((resolve) => {
        const srv = net.createServer()
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address()
            const port = typeof addr === 'object' && addr ? addr.port : 0
            srv.close(() => resolve(port))
        })
    })
}

export function readBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (c) =>
            chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
        )
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
    })
}

export async function startUpstream(): Promise<Upstream> {
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost')

        // Basic GET
        if (url.pathname === '/get') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/plain')
            res.setHeader('X-Upstream', '1')
            res.end('ok')
            return
        }

        // Echo request method
        if (url.pathname === '/echo-method') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ method: req.method }))
            return
        }

        // Echo headers
        if (url.pathname === '/echo-headers') {
            const headers: Record<string, string | string[]> = {}
            for (const [k, v] of Object.entries(req.headers))
                headers[k] = v as any
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ headers }))
            return
        }

        // Echo body (as text)
        if (url.pathname === '/echo-body') {
            const body = await readBody(req)
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/plain')
            res.setHeader('Content-Length', String(body.length))
            res.end(body)
            return
        }

        // Redirect (302)
        if (url.pathname === '/redirect') {
            const to = url.searchParams.get('to') || '/get'
            res.statusCode = 302
            res.setHeader('Location', to)
            res.end()
            return
        }

        // Head
        if (url.pathname === '/head' && req.method === 'HEAD') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/plain')
            res.end()
            return
        }

        // 204 No Content
        if (url.pathname === '/status-204') {
            res.statusCode = 204
            res.end()
            return
        }

        // 304 Not Modified
        if (url.pathname === '/status-304') {
            res.statusCode = 304
            res.setHeader('ETag', 'W/"xyz"')
            res.end()
            return
        }

        // Small body intended to be rewritten by proxy
        if (url.pathname === '/rewrite') {
            const text = 'original'
            const buf = Buffer.from(text)
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/plain')
            res.setHeader('Content-Length', String(buf.length))
            res.end(buf)
            return
        }

        // Large (>2MB) body for streaming tests
        if (url.pathname === '/large') {
            const size = 2 * 1024 * 1024 + 100 // > 2MB
            const buf = Buffer.alloc(size, 0x61) // 'a'
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Content-Length', String(buf.length))
            res.end(buf)
            return
        }

        // Compressed responses
        if (url.pathname === '/compressed/gzip') {
            const raw = Buffer.from('hello compressed')
            zlib.gzip(raw, (e, out) => {
                if (e) {
                    res.statusCode = 500
                    res.end('compress error')
                    return
                }
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/octet-stream')
                res.setHeader('Content-Encoding', 'gzip')
                res.end(out)
            })
            return
        }
        if (url.pathname === '/compressed/deflate') {
            const raw = Buffer.from('hello compressed')
            zlib.deflate(raw, (e, out) => {
                if (e) {
                    res.statusCode = 500
                    res.end('compress error')
                    return
                }
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/octet-stream')
                res.setHeader('Content-Encoding', 'deflate')
                res.end(out)
            })
            return
        }
        if (url.pathname === '/compressed/br') {
            const raw = Buffer.from('hello compressed')
            zlib.brotliCompress(raw, (e, out) => {
                if (e) {
                    res.statusCode = 500
                    res.end('compress error')
                    return
                }
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/octet-stream')
                res.setHeader('Content-Encoding', 'br')
                res.end(out)
            })
            return
        }

        // Chunked response (no content-length)
        if (url.pathname === '/chunked') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/plain')
            // Intentionally do not set Content-Length so Node sets Transfer-Encoding: chunked
            res.write('part1')
            setTimeout(() => {
                res.write('part2')
                res.end()
            }, 1)
            return
        }

        // Echo query string
        if (url.pathname === '/echo-query') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
                JSON.stringify({ pathname: url.pathname, search: url.search })
            )
            return
        }

        // 500 error
        if (url.pathname === '/error-500') {
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain')
            res.end('boom')
            return
        }

        res.statusCode = 404
        res.end('not found')
    })

    const port = await getFreePort()
    await new Promise<void>((resolve) =>
        server.listen(port, '127.0.0.1', resolve)
    )
    return { server, host: '127.0.0.1', port }
}

export async function stopUpstream(upstream: Upstream): Promise<void> {
    await new Promise<void>((resolve) => upstream.server.close(() => resolve()))
}

export async function startProxy(plugins: ProxyPlugin[] = []) {
    const port = await getFreePort()
    const proxy = new MitmProxyServer({
        host: '127.0.0.1',
        port,
        plugins,
        config: {
            hostFilter: ['httpbin.org'],
            hostFilterMode: 'whitelist',
            maxBodySize: 10 * 1024 * 1024, // 10MB
        },
    })
    await proxy.start()
    return { proxy, host: '127.0.0.1', port }
}

export type RequestOptions = {
    method?: string
    headers?: Record<string, string>
    body?: string | Buffer
    originForm?: boolean
    streamBody?: boolean
    agent?: http.Agent
    timeoutMs?: number
}

export async function requestViaProxy(
    proxyHost: string,
    proxyPort: number,
    target: string,
    opts: RequestOptions = {}
) {
    const url = new URL(target)
    const method = opts.method || 'GET'
    const originForm = !!opts.originForm
    const headersLower: Record<string, string> = {}
    const headers: Record<string, string> = {}
    const addHeader = (k: string, v: string) => {
        headers[k] = v
        headersLower[k.toLowerCase()] = v
    }

    // Default headers
    addHeader('Connection', opts.agent ? 'keep-alive' : 'close')
    // Always send Host header; some servers/parsers require it even for absolute-form
    addHeader('Host', url.host)

    // Apply user headers
    for (const [k, v] of Object.entries(opts.headers || {})) addHeader(k, v)

    const body = opts.body
    if (body && !opts.streamBody && !('content-length' in headersLower)) {
        addHeader(
            'Content-Length',
            String(
                Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body)
            )
        )
    }

    const path = originForm ? `${url.pathname}${url.search}` : url.toString()

    return await new Promise<{
        status: number
        headers: http.IncomingHttpHeaders
        body: Buffer
    }>((resolve, reject) => {
        const req = http.request(
            {
                hostname: proxyHost,
                port: proxyPort,
                method,
                path,
                headers,
                agent: opts.agent,
            },
            (res) => {
                const chunks: Buffer[] = []
                res.on('data', (c) =>
                    chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
                )
                res.on('end', () => {
                    let body = Buffer.concat(chunks) as any

                    // Handle gzip decompression if needed
                    const encoding = res.headers['content-encoding']
                    if (encoding === 'gzip') {
                        try {
                            body = zlib.gunzipSync(body)
                        } catch (err) {
                            // If decompression fails, return original body
                            console.warn(
                                'Failed to decompress gzip response:',
                                err
                            )
                        }
                    } else if (encoding === 'deflate') {
                        try {
                            body = zlib.inflateSync(body)
                        } catch (err) {
                            console.warn(
                                'Failed to decompress deflate response:',
                                err
                            )
                        }
                    } else if (encoding === 'br') {
                        try {
                            body = zlib.brotliDecompressSync(body)
                        } catch (err) {
                            console.warn(
                                'Failed to decompress brotli response:',
                                err
                            )
                        }
                    }

                    resolve({
                        status: res.statusCode || 0,
                        headers: res.headers,
                        body,
                    })
                })
            }
        )
        req.on('error', reject)

        if (opts.streamBody && body) {
            const buf = Buffer.isBuffer(body) ? body : Buffer.from(body)
            const mid = Math.max(1, Math.floor(buf.length / 2))
            req.write(buf.subarray(0, mid))
            setTimeout(() => {
                req.end(buf.subarray(mid))
            }, 1)
        } else if (body) {
            req.end(body)
        } else {
            req.end()
        }
    })
}
