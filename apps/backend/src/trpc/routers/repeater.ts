import { TRPCError } from '@trpc/server'
import * as http from 'http'
import { router, publicProcedure, z } from '../init'

// Define the transaction structure for repeater
const displayHeaderSchema = z.object({
    name: z.string(),
    value: z.string(),
})

const bodyContentSchema = z.object({
    encoding: z.string(),
})

const requestBodySchema = z.object({
    sample: z.string(),
    content: bodyContentSchema,
})

const transactionRequestSchema = z.object({
    method: z.string(),
    url: z.object({
        full: z.string(),
    }),
    headers: z.array(displayHeaderSchema),
    body: requestBodySchema.optional(),
})

const repeatRequestSchema = z.object({
    originalTransactionId: z.string().min(1),
    transaction: z.object({
        request: transactionRequestSchema,
    }),
})

export const repeaterRouter = router({
    // Send repeated request
    send: publicProcedure
        .input(repeatRequestSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                const { originalTransactionId, transaction } = input

                if (!ctx.proxy || !ctx.proxy.isRunning()) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message:
                            'Cannot repeat request when proxy is not running',
                    })
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
                const serverInfo = ctx.proxy.getServerInfo()
                if (!serverInfo) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Cannot get proxy server configuration',
                    })
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

                return {
                    message: 'Request repeated successfully',
                }
            } catch (error) {
                if (error instanceof TRPCError) throw error
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to repeat request',
                    cause: error,
                })
            }
        }),
})

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
