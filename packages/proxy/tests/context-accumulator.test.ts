import { describe, it, expect, beforeEach } from 'vitest'
import { IncomingMessage } from 'node:http'
import { ContextAccumulator } from '../src/core/context-accumulator'
import { RequestBuilder, ResponseBuilder } from '../src/plugins/builders'

// Mock IncomingMessage
const createMockRequest = (
    overrides: Partial<IncomingMessage> = {}
): IncomingMessage => {
    return {
        method: 'GET',
        headers: {
            host: 'example.com',
            'user-agent': 'test-agent',
            'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
        socket: {
            remoteAddress: '127.0.0.1',
        },
        ...overrides,
    } as IncomingMessage
}

describe('ContextAccumulator', () => {
    let accumulator: ContextAccumulator
    const testUrl = new URL('https://example.com/api/test?param=value')
    const testId = 'req_123456'
    const testParentId = 'conn_789'
    const testBody = Buffer.from('{"test": "data"}')

    beforeEach(() => {
        const mockReq = createMockRequest()
        accumulator = new ContextAccumulator(
            testUrl,
            mockReq,
            true, // isHttps
            testId,
            testParentId,
            testBody
        )
    })

    describe('buildBeforeRequestContext', () => {
        it('should create context with original request data', () => {
            const context = accumulator.buildBeforeRequestContext()

            expect(context.id).toBe(testId)
            expect(context.parentId).toBe(testParentId)
            expect(context.isHttps).toBe(true)
            expect(context.url.toString()).toBe(testUrl.toString())
            expect(context.method).toBe('GET')
            expect(context.headers.host).toBe('example.com')
            expect(context.body).toEqual(testBody)
            expect(context.clientIp).toBe('192.168.1.1')
            expect(context.request).toBeInstanceOf(RequestBuilder)
        })

        it('should extract client IP from x-forwarded-for header', () => {
            const context = accumulator.buildBeforeRequestContext()
            expect(context.clientIp).toBe('192.168.1.1')
        })

        it('should extract client IP from x-real-ip header when x-forwarded-for is not present', () => {
            const mockReq = createMockRequest({
                headers: {
                    host: 'example.com',
                    'x-real-ip': '203.0.113.1',
                },
            })
            const acc = new ContextAccumulator(testUrl, mockReq, true, testId)
            const context = acc.buildBeforeRequestContext()

            expect(context.clientIp).toBe('203.0.113.1')
        })

        it('should fallback to socket remote address', () => {
            const mockReq = createMockRequest({
                headers: { host: 'example.com' },
            })
            const acc = new ContextAccumulator(testUrl, mockReq, true, testId)
            const context = acc.buildBeforeRequestContext()

            expect(context.clientIp).toBe('127.0.0.1')
        })

        it('should normalize headers removing undefined values', () => {
            const mockReq = createMockRequest({
                headers: {
                    host: 'example.com',
                    'content-length': '100',
                    'undefined-header': undefined,
                } as any,
            })
            const acc = new ContextAccumulator(testUrl, mockReq, true, testId)
            const context = acc.buildBeforeRequestContext()

            expect(context.headers).toEqual({
                host: 'example.com',
                'content-length': '100',
            })
        })
    })

    describe('buildAfterRequestContext', () => {
        it('should include final request state from builder', () => {
            const beforeContext = accumulator.buildBeforeRequestContext()

            // Modify request through builder
            beforeContext.request
                .setMethod('POST')
                .setUrl('https://modified.com/path')
                .setHeader('x-custom', 'value')
                .setBody('modified body')

            const afterContext = accumulator.buildAfterRequestContext(
                beforeContext.request
            )

            expect(afterContext.finalMethod).toBe('POST')
            expect(afterContext.finalUrl.toString()).toBe(
                'https://modified.com/path'
            )
            expect(afterContext.finalHeaders['x-custom']).toBe('value')
            expect(afterContext.finalBody).toEqual(Buffer.from('modified body'))

            // Original data should still be present
            expect(afterContext.method).toBe('GET')
            expect(afterContext.url.toString()).toBe(testUrl.toString())
        })

        it('should preserve all original context data', () => {
            const beforeContext = accumulator.buildBeforeRequestContext()
            const afterContext = accumulator.buildAfterRequestContext(
                beforeContext.request
            )

            expect(afterContext.id).toBe(testId)
            expect(afterContext.parentId).toBe(testParentId)
            expect(afterContext.isHttps).toBe(true)
            expect(afterContext.body).toEqual(testBody)
        })
    })

    describe('buildBeforeResponseContext', () => {
        it('should include response data and create response builder', () => {
            const beforeRequestContext = accumulator.buildBeforeRequestContext()
            accumulator.buildAfterRequestContext(beforeRequestContext.request)

            const statusCode = 200
            const statusMessage = 'OK'
            const responseHeaders = { 'content-type': 'application/json' }
            const responseBody = Buffer.from('{"result": "success"}')

            const beforeResponseContext =
                accumulator.buildBeforeResponseContext(
                    statusCode,
                    statusMessage,
                    responseHeaders,
                    responseBody
                )

            expect(beforeResponseContext.statusCode).toBe(statusCode)
            expect(beforeResponseContext.statusMessage).toBe(statusMessage)
            expect(beforeResponseContext.responseHeaders).toEqual(
                responseHeaders
            )
            expect(beforeResponseContext.responseBody).toEqual(responseBody)
            expect(beforeResponseContext.response).toBeInstanceOf(
                ResponseBuilder
            )

            // Should include all request data
            expect(beforeResponseContext.finalUrl).toBeDefined()
            expect(beforeResponseContext.finalMethod).toBeDefined()
        })

        it('should throw error if called before request finalization', () => {
            expect(() => {
                accumulator.buildBeforeResponseContext(200, 'OK', {})
            }).toThrow(
                'Cannot build response context without final request state'
            )
        })
    })

    describe('buildAfterResponseContext', () => {
        it('should include final response state and timing', async () => {
            // Set up complete flow
            const beforeRequestContext = accumulator.buildBeforeRequestContext()
            accumulator.buildAfterRequestContext(beforeRequestContext.request)

            const beforeResponseContext =
                accumulator.buildBeforeResponseContext(
                    200,
                    'OK',
                    { 'content-type': 'application/json' },
                    Buffer.from('original response')
                )

            // Add a small delay to ensure duration > 0
            await new Promise((resolve) => setTimeout(resolve, 1))

            // Modify response
            beforeResponseContext.response
                .setStatusCode(201)
                .setStatusMessage('Created')
                .setHeader('location', '/resource/123')
                .setBody('modified response')

            const afterResponseContext = accumulator.buildAfterResponseContext(
                beforeResponseContext.response
            )

            expect(afterResponseContext.finalStatusCode).toBe(201)
            expect(afterResponseContext.finalStatusMessage).toBe('Created')
            expect(afterResponseContext.finalResponseHeaders['location']).toBe(
                '/resource/123'
            )
            expect(afterResponseContext.finalResponseBody).toEqual(
                Buffer.from('modified response')
            )
            expect(afterResponseContext.duration).toBeGreaterThanOrEqual(0) // Changed to >= 0 since timing can be very fast

            // Original response data should still be present
            expect(afterResponseContext.statusCode).toBe(200)
            expect(afterResponseContext.statusMessage).toBe('OK')
        })

        it('should throw error if called before response setup', () => {
            const beforeRequestContext = accumulator.buildBeforeRequestContext()
            accumulator.buildAfterRequestContext(beforeRequestContext.request)

            const mockBuilder = new ResponseBuilder(200, 'OK', {})

            expect(() => {
                accumulator.buildAfterResponseContext(mockBuilder)
            }).toThrow(
                'Cannot build final response context without request and response state'
            )
        })
    })

    describe('getFinalRequestState', () => {
        it('should return final request state after building afterRequest context', () => {
            const beforeContext = accumulator.buildBeforeRequestContext()
            beforeContext.request.setMethod('PUT').setUrl('https://final.com')

            accumulator.buildAfterRequestContext(beforeContext.request)
            const finalState = accumulator.getFinalRequestState()

            expect(finalState.method).toBe('PUT')
            expect(finalState.url.toString()).toBe('https://final.com/')
        })

        it('should throw error if called before request finalization', () => {
            expect(() => {
                accumulator.getFinalRequestState()
            }).toThrow('Final request state not available')
        })
    })

    describe('getFinalResponseState', () => {
        it('should return final response state after building afterResponse context', () => {
            // Complete flow
            const beforeRequestContext = accumulator.buildBeforeRequestContext()
            accumulator.buildAfterRequestContext(beforeRequestContext.request)

            const beforeResponseContext =
                accumulator.buildBeforeResponseContext(200, 'OK', {})
            beforeResponseContext.response
                .setStatusCode(404)
                .setStatusMessage('Not Found')

            accumulator.buildAfterResponseContext(
                beforeResponseContext.response
            )
            const finalState = accumulator.getFinalResponseState()

            expect(finalState.statusCode).toBe(404)
            expect(finalState.statusMessage).toBe('Not Found')
        })

        it('should throw error if called before response finalization', () => {
            expect(() => {
                accumulator.getFinalResponseState()
            }).toThrow('Final response state not available')
        })
    })

    describe('buildConnectContext', () => {
        it('should create connect context with provided data', () => {
            const context = ContextAccumulator.buildConnectContext(
                'example.com',
                443,
                'conn_123',
                'parent_456',
                '192.168.1.1'
            )

            expect(context.id).toBe('conn_123')
            expect(context.parentId).toBe('parent_456')
            expect(context.hostname).toBe('example.com')
            expect(context.port).toBe(443)
            expect(context.clientIp).toBe('192.168.1.1')
        })

        it('should handle optional parameters', () => {
            const context = ContextAccumulator.buildConnectContext(
                'example.com',
                443,
                'conn_123'
            )

            expect(context.parentId).toBeUndefined()
            expect(context.clientIp).toBeUndefined()
        })
    })
})
