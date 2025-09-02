import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '../init'
import { sendHttpRequestSchema } from '../schemas'
import { request } from 'undici'

export const requestsRouter = router({
    // Send HTTP request
    send: publicProcedure
        .input(sendHttpRequestSchema)
        .mutation(async ({ input }) => {
            const startTime = Date.now()

            try {
                // Build URL with query parameters
                const url = new URL(input.url)
                if (input.queryParams && input.queryParams.length > 0) {
                    input.queryParams.forEach((param) => {
                        if (param.name.trim() && param.value.trim()) {
                            url.searchParams.set(param.name, param.value)
                        }
                    })
                }

                // Build headers object
                const headers: Record<string, string> = {}
                if (input.headers && input.headers.length > 0) {
                    input.headers.forEach((header) => {
                        if (header.name.trim() && header.value.trim()) {
                            headers[header.name] = header.value
                        }
                    })
                }

                // Configure request options
                const requestOptions = {
                    method: input.method,
                    headers,
                    body: input.body || undefined,
                }

                // Send the request using undici
                const {
                    statusCode,
                    headers: responseHeaders,
                    body,
                } = await request(url.toString(), requestOptions)

                // Read the response body
                const responseBody = await body.text()
                const endTime = Date.now()
                const responseTime = endTime - startTime

                // Get status text based on status code
                const getStatusText = (code: number): string => {
                    const statusTexts: Record<number, string> = {
                        200: 'OK',
                        201: 'Created',
                        204: 'No Content',
                        400: 'Bad Request',
                        401: 'Unauthorized',
                        403: 'Forbidden',
                        404: 'Not Found',
                        500: 'Internal Server Error',
                        502: 'Bad Gateway',
                        503: 'Service Unavailable',
                    }
                    return statusTexts[code] || 'Unknown'
                }

                // Convert response headers to a more usable format
                const responseHeadersArray: Array<{
                    name: string
                    value: string
                }> = []
                if (responseHeaders) {
                    Object.entries(responseHeaders).forEach(([name, value]) => {
                        if (Array.isArray(value)) {
                            value.forEach((v) => {
                                responseHeadersArray.push({ name, value: v })
                            })
                        } else if (value) {
                            responseHeadersArray.push({ name, value })
                        }
                    })
                }

                return {
                    status: statusCode,
                    statusText: getStatusText(statusCode),
                    time: responseTime,
                    body: responseBody,
                    headers: responseHeadersArray,
                }
            } catch (error) {
                const endTime = Date.now()
                const responseTime = endTime - startTime

                console.error('HTTP request failed:', error)

                // Handle different types of errors
                if (error instanceof Error) {
                    // Network or URL errors
                    if (
                        error.message.includes('fetch failed') ||
                        error.message.includes('ENOTFOUND') ||
                        error.message.includes('ECONNREFUSED')
                    ) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: `Network error: ${error.message}`,
                        })
                    }

                    // URL parsing errors
                    if (error.message.includes('Invalid URL')) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: `Invalid URL: ${error.message}`,
                        })
                    }
                }

                // Return error response for display in the UI
                return {
                    status: 0,
                    statusText: 'Request Failed',
                    time: responseTime,
                    body:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error occurred',
                    headers: [],
                }
            }
        }),
})
