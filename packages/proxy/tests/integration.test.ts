import { describe, it, expect, beforeEach } from 'vitest'
import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import type { ProxyPlugin } from '../src/plugins/types'
import { PluginManager } from '../src/core/plugin-manager'
import { ContextAccumulator } from '../src/core/context-accumulator'

/**
 * Integration tests for the complete plugin flow
 * These tests verify that the entire plugin system works together correctly
 */

// Mock IncomingMessage and ServerResponse for testing
const createMockRequest = (
    overrides: Partial<IncomingMessage> = {}
): IncomingMessage => {
    const stream = new Readable({
        read() {
            this.push(null)
        },
    })

    return Object.assign(stream, {
        method: 'GET',
        url: '/test',
        headers: {
            host: 'example.com',
            'user-agent': 'test-agent',
        },
        socket: {
            remoteAddress: '127.0.0.1',
        },
        ...overrides,
    }) as IncomingMessage
}

// const createMockResponse = (): ServerResponse => {
//     const stream = new Writable({
//         write(chunk, encoding, callback) {
//             if (callback) callback()
//         },
//     })

//     return Object.assign(stream, {
//         writeHead: vi.fn(),
//         end: vi.fn(),
//         headersSent: false,
//         finished: false,
//     }) as any
// }

describe('Plugin Integration Tests', () => {
    let pluginManager: PluginManager
    let contextAccumulator: ContextAccumulator

    beforeEach(() => {
        pluginManager = new PluginManager()
        const mockReq = createMockRequest()
        const testUrl = new URL('https://example.com/api/test')
        contextAccumulator = new ContextAccumulator(
            testUrl,
            mockReq,
            true,
            'req_123456',
            'conn_parent'
        )
    })

    describe('Request Modification Flow', () => {
        it('should allow plugins to modify requests in sequence', async () => {
            // Create plugins that modify requests
            const authPlugin: ProxyPlugin = {
                name: 'auth-plugin',
                beforeRequest(ctx) {
                    ctx.request.setHeader('authorization', 'Bearer token123')
                },
            }

            const loggingPlugin: ProxyPlugin = {
                name: 'logging-plugin',
                beforeRequest(ctx) {
                    ctx.request.setHeader('x-request-id', ctx.id)
                },
            }

            const bodyModifierPlugin: ProxyPlugin = {
                name: 'body-modifier',
                beforeRequest(ctx) {
                    if (ctx.request.getMethod() === 'POST') {
                        const data = { timestamp: Date.now() }
                        ctx.request.setBody(JSON.stringify(data))
                    }
                },
            }

            // Add plugins to manager
            pluginManager.addPlugin(authPlugin)
            pluginManager.addPlugin(loggingPlugin)
            pluginManager.addPlugin(bodyModifierPlugin)

            // Execute request flow
            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            // Simulate POST request by modifying the request through the builder
            beforeRequestCtx.request.setMethod('POST')

            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )
            const afterRequestCtx =
                contextAccumulator.buildAfterRequestContext(requestBuilder)

            // Verify modifications
            expect(afterRequestCtx.finalHeaders['authorization']).toBe(
                'Bearer token123'
            )
            expect(afterRequestCtx.finalHeaders['x-request-id']).toBe(
                'req_123456'
            )
            expect(afterRequestCtx.finalMethod).toBe('POST')
            expect(afterRequestCtx.finalBody).toBeDefined()

            const bodyData = JSON.parse(afterRequestCtx.finalBody!.toString())
            expect(bodyData.timestamp).toBeTypeOf('number')
        })

        it('should preserve original request data while showing final modifications', async () => {
            const urlModifierPlugin: ProxyPlugin = {
                name: 'url-modifier',
                beforeRequest(ctx) {
                    ctx.request.setUrl('https://api.example.com/v2/test')
                    ctx.request.setMethod('PUT')
                },
            }

            pluginManager.addPlugin(urlModifierPlugin)

            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )
            const afterRequestCtx =
                contextAccumulator.buildAfterRequestContext(requestBuilder)

            // Original data should be preserved
            expect(afterRequestCtx.url.toString()).toBe(
                'https://example.com/api/test'
            )
            expect(afterRequestCtx.method).toBe('GET')

            // Final data should show modifications
            expect(afterRequestCtx.finalUrl.toString()).toBe(
                'https://api.example.com/v2/test'
            )
            expect(afterRequestCtx.finalMethod).toBe('PUT')
        })
    })

    describe('Response Modification Flow', () => {
        it('should allow plugins to modify responses in sequence', async () => {
            // Set up complete request flow first
            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )

            contextAccumulator.buildAfterRequestContext(requestBuilder)

            // Create response modification plugins
            const corsPlugin: ProxyPlugin = {
                name: 'cors-plugin',
                beforeResponse(ctx) {
                    ctx.response
                        .setHeader('access-control-allow-origin', '*')
                        .setHeader(
                            'access-control-allow-methods',
                            'GET, POST, PUT, DELETE'
                        )
                },
            }

            const cachePlugin: ProxyPlugin = {
                name: 'cache-plugin',
                beforeResponse(ctx) {
                    if (ctx.statusCode === 200) {
                        ctx.response.setHeader('cache-control', 'max-age=3600')
                    }
                },
            }

            const bodyTransformPlugin: ProxyPlugin = {
                name: 'body-transform',
                beforeResponse(ctx) {
                    if (
                        ctx.responseBody &&
                        ctx.responseHeaders['content-type']?.includes(
                            'application/json'
                        )
                    ) {
                        const data = JSON.parse(ctx.responseBody.toString())
                        data.transformed = true
                        data.transformedAt = new Date().toISOString()
                        ctx.response.setBody(JSON.stringify(data))
                    }
                },
            }

            pluginManager.addPlugin(corsPlugin)
            pluginManager.addPlugin(cachePlugin)
            pluginManager.addPlugin(bodyTransformPlugin)

            // Simulate response from upstream
            const originalResponseBody = Buffer.from(
                JSON.stringify({ id: 1, name: 'test' })
            )
            const beforeResponseCtx =
                contextAccumulator.buildBeforeResponseContext(
                    200,
                    'OK',
                    { 'content-type': 'application/json' },
                    originalResponseBody
                )

            const responseBuilder = await pluginManager.executeBeforeResponse(
                beforeResponseCtx
            )
            const afterResponseCtx =
                contextAccumulator.buildAfterResponseContext(responseBuilder)

            // Verify response modifications
            expect(
                afterResponseCtx.finalResponseHeaders[
                    'access-control-allow-origin'
                ]
            ).toBe('*')
            expect(afterResponseCtx.finalResponseHeaders['cache-control']).toBe(
                'max-age=3600'
            )

            const transformedBody = JSON.parse(
                afterResponseCtx.finalResponseBody!.toString()
            )
            expect(transformedBody.transformed).toBe(true)
            expect(transformedBody.transformedAt).toBeDefined()
            expect(transformedBody.id).toBe(1) // Original data preserved
        })

        it('should provide complete transaction context in afterResponse', async () => {
            const transactionLoggerPlugin: ProxyPlugin = {
                name: 'transaction-logger',
                afterResponse(ctx) {
                    // Should have access to complete transaction data
                    expect(ctx.id).toBe('req_123456')
                    expect(ctx.url.toString()).toBe(
                        'https://example.com/api/test'
                    )
                    expect(ctx.finalUrl).toBeDefined()
                    expect(ctx.statusCode).toBe(201)
                    expect(ctx.finalStatusCode).toBe(201)
                    expect(ctx.duration).toBeGreaterThan(0)

                    // Log transaction (in real scenario)
                    console.log(
                        `Transaction ${ctx.id}: ${ctx.finalMethod} ${ctx.finalUrl} -> ${ctx.finalStatusCode} (${ctx.duration}ms)`
                    )
                },
            }

            pluginManager.addPlugin(transactionLoggerPlugin)

            // Complete flow
            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )

            contextAccumulator.buildAfterRequestContext(requestBuilder)

            const beforeResponseCtx =
                contextAccumulator.buildBeforeResponseContext(
                    201,
                    'Created',
                    { location: '/resource/123' },
                    Buffer.from('{"id": 123}')
                )

            const responseBuilder = await pluginManager.executeBeforeResponse(
                beforeResponseCtx
            )
            const afterResponseCtx =
                contextAccumulator.buildAfterResponseContext(responseBuilder)

            await pluginManager.executeAfterResponse(afterResponseCtx)
        })
    })

    describe('Error Handling Flow', () => {
        it('should handle plugin errors and call error hooks on other plugins', async () => {
            const errorMessages: string[] = []

            const failingPlugin: ProxyPlugin = {
                name: 'failing-plugin',
                beforeRequest() {
                    throw new Error('Plugin intentionally failed')
                },
            }

            const errorHandlerPlugin: ProxyPlugin = {
                name: 'error-handler',
                onError(err, ctx) {
                    errorMessages.push(
                        `Error in ${
                            'pluginName' in ctx ? ctx.pluginName : 'unknown'
                        }: ${err instanceof Error ? err.message : String(err)}`
                    )
                },
            }

            const workingPlugin: ProxyPlugin = {
                name: 'working-plugin',
                beforeRequest(ctx) {
                    ctx.request.setHeader('x-working', 'true')
                },
            }

            pluginManager.addPlugin(failingPlugin)
            pluginManager.addPlugin(errorHandlerPlugin)
            pluginManager.addPlugin(workingPlugin)

            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()

            // Should not throw, but should handle error gracefully
            await pluginManager.executeBeforeRequest(beforeRequestCtx)

            expect(errorMessages).toHaveLength(1)
            expect(errorMessages[0]).toContain('failing-plugin')
            expect(errorMessages[0]).toContain('Plugin intentionally failed')
        })

        it('should continue processing other plugins after one fails', async () => {
            let workingPluginExecuted = false

            const failingPlugin: ProxyPlugin = {
                name: 'failing-plugin',
                beforeRequest() {
                    throw new Error('Plugin failed')
                },
            }

            const workingPlugin: ProxyPlugin = {
                name: 'working-plugin',
                beforeRequest(ctx) {
                    workingPluginExecuted = true
                    ctx.request.setHeader('x-executed', 'true')
                },
            }

            pluginManager.addPlugin(failingPlugin)
            pluginManager.addPlugin(workingPlugin)

            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )
            const afterRequestCtx =
                contextAccumulator.buildAfterRequestContext(requestBuilder)

            expect(workingPluginExecuted).toBe(true)
            expect(afterRequestCtx.finalHeaders['x-executed']).toBe('true')
        })
    })

    describe('Complex Plugin Interactions', () => {
        it("should handle plugins that depend on each other's modifications", async () => {
            const authPlugin: ProxyPlugin = {
                name: 'auth-plugin',
                beforeRequest(ctx) {
                    // Add auth header
                    ctx.request.setHeader('authorization', 'Bearer token123')
                },
            }

            const authValidatorPlugin: ProxyPlugin = {
                name: 'auth-validator',
                beforeRequest(ctx) {
                    // Check if auth header was added by previous plugin
                    const authHeader = ctx.request.getHeader('authorization')
                    if (authHeader) {
                        ctx.request.setHeader('x-auth-validated', 'true')
                    }
                },
            }

            const requestEnricherPlugin: ProxyPlugin = {
                name: 'request-enricher',
                beforeRequest(ctx) {
                    // Add metadata based on auth status
                    const isValidated =
                        ctx.request.getHeader('x-auth-validated')
                    if (isValidated) {
                        ctx.request.setHeader('x-user-context', 'authenticated')
                    }
                },
            }

            pluginManager.addPlugin(authPlugin)
            pluginManager.addPlugin(authValidatorPlugin)
            pluginManager.addPlugin(requestEnricherPlugin)

            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )
            const afterRequestCtx =
                contextAccumulator.buildAfterRequestContext(requestBuilder)

            expect(afterRequestCtx.finalHeaders['authorization']).toBe(
                'Bearer token123'
            )
            expect(afterRequestCtx.finalHeaders['x-auth-validated']).toBe(
                'true'
            )
            expect(afterRequestCtx.finalHeaders['x-user-context']).toBe(
                'authenticated'
            )
        })

        it('should handle response modifications based on request context', async () => {
            const requestTaggingPlugin: ProxyPlugin = {
                name: 'request-tagger',
                beforeRequest(ctx) {
                    if (ctx.url.pathname.includes('/api/')) {
                        ctx.request.setHeader('x-api-request', 'true')
                    }
                },
            }

            const responseEnhancerPlugin: ProxyPlugin = {
                name: 'response-enhancer',
                beforeResponse(ctx) {
                    // Check if this was an API request
                    const isApiRequest = ctx.finalHeaders['x-api-request']
                    if (isApiRequest && ctx.responseBody) {
                        const data = JSON.parse(ctx.responseBody.toString())
                        data.apiVersion = '1.0'
                        data.requestId = ctx.id
                        ctx.response.setBody(JSON.stringify(data))
                    }
                },
            }

            pluginManager.addPlugin(requestTaggingPlugin)
            pluginManager.addPlugin(responseEnhancerPlugin)

            // Complete flow
            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )
            contextAccumulator.buildAfterRequestContext(requestBuilder)

            const originalResponse = { message: 'success' }
            const beforeResponseCtx =
                contextAccumulator.buildBeforeResponseContext(
                    200,
                    'OK',
                    { 'content-type': 'application/json' },
                    Buffer.from(JSON.stringify(originalResponse))
                )

            const responseBuilder = await pluginManager.executeBeforeResponse(
                beforeResponseCtx
            )
            const afterResponseCtx =
                contextAccumulator.buildAfterResponseContext(responseBuilder)

            const enhancedResponse = JSON.parse(
                afterResponseCtx.finalResponseBody!.toString()
            )
            expect(enhancedResponse.message).toBe('success')
            expect(enhancedResponse.apiVersion).toBe('1.0')
            expect(enhancedResponse.requestId).toBe('req_123456')
        })
    })

    describe('Builder API Integration', () => {
        it('should support fluent API chaining in plugins', async () => {
            const fluentPlugin: ProxyPlugin = {
                name: 'fluent-plugin',
                beforeRequest(ctx) {
                    ctx.request
                        .setMethod('POST')
                        .setUrl('https://api.example.com/v1/data')
                        .setHeader('content-type', 'application/json')
                        .setHeader('x-client', 'proxy')
                        .removeHeader('user-agent')
                        .setBody(JSON.stringify({ action: 'create' }))
                },
                beforeResponse(ctx) {
                    ctx.response
                        .setStatusCode(201)
                        .setStatusMessage('Created')
                        .setHeader('location', '/resource/new')
                        .addHeader('x-custom', 'value1')
                        .addHeader('x-custom', 'value2')
                },
            }

            pluginManager.addPlugin(fluentPlugin)

            // Request flow
            const beforeRequestCtx =
                contextAccumulator.buildBeforeRequestContext()
            const requestBuilder = await pluginManager.executeBeforeRequest(
                beforeRequestCtx
            )
            const afterRequestCtx =
                contextAccumulator.buildAfterRequestContext(requestBuilder)

            expect(afterRequestCtx.finalMethod).toBe('POST')
            expect(afterRequestCtx.finalUrl.toString()).toBe(
                'https://api.example.com/v1/data'
            )
            expect(afterRequestCtx.finalHeaders['content-type']).toBe(
                'application/json'
            )
            expect(afterRequestCtx.finalHeaders['x-client']).toBe('proxy')
            expect(afterRequestCtx.finalHeaders['user-agent']).toBeUndefined()

            const requestBody = JSON.parse(
                afterRequestCtx.finalBody!.toString()
            )
            expect(requestBody.action).toBe('create')

            // Response flow
            const beforeResponseCtx =
                contextAccumulator.buildBeforeResponseContext(
                    200,
                    'OK',
                    {},
                    Buffer.from('{}')
                )
            const responseBuilder = await pluginManager.executeBeforeResponse(
                beforeResponseCtx
            )
            const afterResponseCtx =
                contextAccumulator.buildAfterResponseContext(responseBuilder)

            expect(afterResponseCtx.finalStatusCode).toBe(201)
            expect(afterResponseCtx.finalStatusMessage).toBe('Created')
            expect(afterResponseCtx.finalResponseHeaders['location']).toBe(
                '/resource/new'
            )
            expect(afterResponseCtx.finalResponseHeaders['x-custom']).toEqual([
                'value1',
                'value2',
            ])
        })
    })
})

describe('Real-world Plugin Scenarios', () => {
    it('should handle a complete authentication and logging scenario', async () => {
        const logs: string[] = []

        // Authentication plugin
        const authPlugin: ProxyPlugin = {
            name: 'auth',
            beforeRequest(ctx) {
                // Add API key
                ctx.request.setHeader('x-api-key', 'secret-key-123')

                // Add timestamp
                ctx.request.setHeader('x-timestamp', Date.now().toString())
            },
        }

        // Request logging plugin
        const requestLoggerPlugin: ProxyPlugin = {
            name: 'request-logger',
            afterRequest(ctx) {
                logs.push(`REQ ${ctx.id}: ${ctx.finalMethod} ${ctx.finalUrl}`)
            },
        }

        // Response transformation plugin
        const responseTransformPlugin: ProxyPlugin = {
            name: 'response-transform',
            beforeResponse(ctx) {
                if (ctx.responseBody && ctx.statusCode === 200) {
                    const data = JSON.parse(ctx.responseBody.toString())
                    // Wrap response in envelope
                    const envelope = {
                        success: true,
                        data: data,
                        timestamp: new Date().toISOString(),
                    }
                    ctx.response.setBody(JSON.stringify(envelope))
                }
            },
        }

        // Response logging plugin
        const responseLoggerPlugin: ProxyPlugin = {
            name: 'response-logger',
            afterResponse(ctx) {
                logs.push(
                    `RES ${ctx.id}: ${ctx.finalStatusCode} (${ctx.duration}ms)`
                )
            },
        }

        // Error handling plugin
        const errorHandlerPlugin: ProxyPlugin = {
            name: 'error-handler',
            onError(err, ctx) {
                logs.push(
                    `ERR ${ctx.id}: ${
                        err instanceof Error ? err.message : String(err)
                    }`
                )
            },
        }

        const pluginManager = new PluginManager([
            authPlugin,
            requestLoggerPlugin,
            responseTransformPlugin,
            responseLoggerPlugin,
            errorHandlerPlugin,
        ])

        // Simulate complete request/response cycle
        const mockReq = createMockRequest({ method: 'GET', url: '/api/users' })
        const testUrl = new URL('https://api.example.com/users')
        const contextAccumulator = new ContextAccumulator(
            testUrl,
            mockReq,
            true,
            'req_abc123'
        )

        // Request phase
        const beforeRequestCtx = contextAccumulator.buildBeforeRequestContext()
        const requestBuilder = await pluginManager.executeBeforeRequest(
            beforeRequestCtx
        )
        const afterRequestCtx =
            contextAccumulator.buildAfterRequestContext(requestBuilder)
        await pluginManager.executeAfterRequest(afterRequestCtx)

        // Response phase
        const originalResponse = { users: [{ id: 1, name: 'John' }] }
        const beforeResponseCtx = contextAccumulator.buildBeforeResponseContext(
            200,
            'OK',
            { 'content-type': 'application/json' },
            Buffer.from(JSON.stringify(originalResponse))
        )
        const responseBuilder = await pluginManager.executeBeforeResponse(
            beforeResponseCtx
        )
        const afterResponseCtx =
            contextAccumulator.buildAfterResponseContext(responseBuilder)
        await pluginManager.executeAfterResponse(afterResponseCtx)

        // Verify complete flow
        expect(afterRequestCtx.finalHeaders['x-api-key']).toBe('secret-key-123')
        expect(afterRequestCtx.finalHeaders['x-timestamp']).toBeDefined()

        const transformedResponse = JSON.parse(
            afterResponseCtx.finalResponseBody!.toString()
        )
        expect(transformedResponse.success).toBe(true)
        expect(transformedResponse.data.users).toEqual([
            { id: 1, name: 'John' },
        ])
        expect(transformedResponse.timestamp).toBeDefined()

        expect(logs).toHaveLength(2)
        expect(logs[0]).toContain(
            'REQ req_abc123: GET https://api.example.com/users'
        )
        expect(logs[1]).toContain('RES req_abc123: 200')
    })
})
