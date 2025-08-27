import type { FastifyInstance } from 'fastify'
import * as http from 'http'
import type { RepeatRequestBody, RepeatResponse } from '@arachne/api-types'
import type { RouteOptions } from './types'

export function registerRepeaterRoutes(
    app: FastifyInstance,
    opts: Pick<RouteOptions, 'prefix' | 'proxy'>
) {
    const { prefix, proxy } = opts

    app.post(
        `${prefix}/repeater/send`,

        async (req, rep) => {
            try {
                const { originalTransactionId, transaction } =
                    req.body as RepeatRequestBody

                if (!proxy || !proxy.isRunning()) {
                    const response: RepeatResponse = {
                        ok: false,
                        message: 'Proxy is not running',
                        error: 'Cannot repeat request when proxy is not running',
                    }
                    rep.code(400).send(response)
                    return
                }

                // Create repeater metadata header
                const repeaterMeta = {
                    source: 'repeater',
                    originalId: originalTransactionId,
                    timestamp: Date.now(),
                }

                // Prepare headers - convert DisplayHeader[] to the format needed for HTTP request
                const headers: Record<string, string> = {}
                transaction.request.headers.forEach((h) => {
                    headers[h.name] = h.value
                })

                // Add special header to track this as a repeater request
                headers['X-Arachne-Repeater'] = JSON.stringify(repeaterMeta)

                // Get proxy server info
                const serverInfo = proxy.getServerInfo()
                if (!serverInfo) {
                    const response: RepeatResponse = {
                        ok: false,
                        message: 'Proxy server info not available',
                        error: 'Cannot get proxy server configuration',
                    }
                    rep.code(500).send(response)
                    return
                }

                // Prepare body for sending
                let body: string | Buffer | undefined = undefined
                if (transaction.request.body?.sample) {
                    const sample = transaction.request.body.sample
                    const encoding = transaction.request.body.content.encoding

                    if (encoding === 'base64') {
                        body = Buffer.from(sample, 'base64')
                    } else {
                        body = sample
                    }
                }

                // Send HTTP request through our own proxy using original request data
                await sendRepeaterRequest({
                    proxyHost: serverInfo.host,
                    proxyPort: serverInfo.port,
                    method: transaction.request.method,
                    url: transaction.request.url.full,
                    headers,
                    body,
                })

                const response: RepeatResponse = {
                    ok: true,
                    message: 'Request repeated successfully',
                }
                rep.send(response)
            } catch (error) {
                const response: RepeatResponse = {
                    ok: false,
                    message: 'Failed to repeat request',
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )
}

// Helper function to send requests through the proxy
async function sendRepeaterRequest(options: {
    proxyHost: string
    proxyPort: number
    method: string
    url: string
    headers: Record<string, string>
    body?: string | Buffer
}): Promise<void> {
    const { proxyHost, proxyPort, method, url, headers, body } = options

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: proxyHost,
                port: proxyPort,
                method,
                path: url,
                headers,
            },
            (res) => {
                // Consume the response to complete the request
                res.on('data', () => {})
                res.on('end', () => {
                    resolve()
                })
                res.on('error', (err) => {
                    reject(err)
                })
            }
        )

        req.on('error', (err) => {
            reject(err)
        })

        if (body) {
            req.write(body)
        }

        req.end()
    })
}
