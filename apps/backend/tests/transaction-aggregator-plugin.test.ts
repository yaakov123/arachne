import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { createTransactionAggregatorPlugin } from '../src/plugins/transaction-aggregator-plugin'
import type {
    RequestBodyContext,
    RequestContext,
    RequestOptions,
    ResponseBodyContext,
    ResponseContext,
} from '@arachne/proxy'

describe('TransactionAggregatorPlugin', () => {
    let eventEmitter: EventEmitter
    let plugin: ReturnType<typeof createTransactionAggregatorPlugin>

    beforeEach(() => {
        eventEmitter = new EventEmitter()
        plugin = createTransactionAggregatorPlugin(eventEmitter)
    })

    describe('plugin metadata', () => {
        it('should have correct name', () => {
            expect(plugin.name).toBe('transaction-aggregator')
        })

        it('should have all required hooks', () => {
            expect(plugin.onRequest).toBeDefined()
            expect(plugin.onResponse).toBeDefined()
            expect(plugin.onRequestBody).toBeDefined()
            expect(plugin.onResponseBody).toBeDefined()
            expect(plugin.onResponseComplete).toBeDefined()
        })
    })

    describe('onRequest', () => {
        it('should emit request event with extracted data', async () => {
            const mockCtx: RequestContext = {
                id: 'req_123',
                isHttps: false,
                url: new URL('http://example.com/api/test'),
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: 'Bearer token123',
                },
                clientIp: '127.0.0.1',
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api/test',
                    headers: {},
                    method: 'POST',
                },
            }

            const eventSpy = vi.fn()
            eventEmitter.on('request', eventSpy)

            await plugin.onRequest!(mockCtx)

            expect(eventSpy).toHaveBeenCalledWith({
                id: 'req_123',
                method: 'POST',
                url: {
                    full: 'http://example.com/api/test',
                    protocol: 'http:',
                    host: 'example.com',
                    port: undefined,
                    path: '/api/test',
                    query: undefined,
                    fragment: undefined,
                },
                headers: [
                    {
                        name: 'content-type',
                        value: 'application/json',
                        sensitive: false,
                    },
                    {
                        name: 'authorization',
                        value: 'Bearer token123',
                        sensitive: true,
                    },
                ],
                clientIp: '127.0.0.1',
                timestamp: expect.any(Number),
                ts: expect.any(String),
                repeaterMeta: { source: 'proxy' },
            })
        })

        it('should handle repeater metadata', async () => {
            const mockCtx: RequestContext = {
                id: 'req_456',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'GET',
                headers: {
                    'x-arachne-repeater': JSON.stringify({
                        originalId: 'original_123',
                        timestamp: '2024-01-01T10:00:00Z',
                    }),
                },
                clientIp: '127.0.0.1',
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const eventSpy = vi.fn()
            eventEmitter.on('request', eventSpy)

            await plugin.onRequest!(mockCtx)

            const emittedEvent = eventSpy.mock.calls[0][0]
            expect(emittedEvent.repeaterMeta).toEqual({
                source: 'repeater',
                originalTransactionId: 'original_123',
                repeatedAt: '2024-01-01T10:00:00.000Z',
            })

            // Should filter out repeater header from broadcast
            expect(emittedEvent.headers).not.toContainEqual(
                expect.objectContaining({ name: 'x-arachne-repeater' })
            )
        })

        it('should handle invalid repeater header gracefully', async () => {
            const mockCtx: RequestContext = {
                id: 'req_789',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'GET',
                headers: {
                    'x-arachne-repeater': 'invalid-json',
                },
                clientIp: '127.0.0.1',
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const eventSpy = vi.fn()
            eventEmitter.on('request', eventSpy)

            await plugin.onRequest!(mockCtx)

            const emittedEvent = eventSpy.mock.calls[0][0]
            expect(emittedEvent.repeaterMeta).toEqual({
                source: 'proxy',
            })
        })
    })

    describe('onResponse', () => {
        it('should emit response event', async () => {
            const requestCtx: RequestContext = {
                id: 'req_123',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'GET',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const responseCtx: ResponseContext = {
                ...requestCtx,
                statusCode: 200,
                statusMessage: 'OK',
                responseHeaders: {
                    'content-type': 'application/json',
                    'cache-control': 'no-cache',
                },
            }

            const eventSpy = vi.fn()
            eventEmitter.on('response', eventSpy)

            // Initialize transaction first
            await plugin.onRequest!(requestCtx)
            await plugin.onResponse!(responseCtx)

            expect(eventSpy).toHaveBeenCalledWith({
                id: 'req_123',
                statusCode: 200,
                statusMessage: 'OK',
                headers: [
                    {
                        name: 'content-type',
                        value: 'application/json',
                        sensitive: false,
                    },
                    {
                        name: 'cache-control',
                        value: 'no-cache',
                        sensitive: false,
                    },
                ],
                timing: {
                    startTime: expect.any(Number),
                    responseTime: expect.any(Number),
                    duration: expect.any(Number),
                },
                ts: expect.any(String),
            })
        })
    })

    describe('onRequestBody', () => {
        it('should emit requestBody event', async () => {
            const requestCtx: RequestContext = {
                id: 'req_123',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'POST',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const requestBodyCtx: RequestBodyContext = {
                ...requestCtx,
                body: Buffer.from('{"name":"test"}'),
                contentType: 'application/json',
                contentEncoding: undefined,
                setBody: () => {},
            }

            const eventSpy = vi.fn()
            eventEmitter.on('requestBody', eventSpy)

            // Initialize transaction first
            await plugin.onRequest!(requestCtx)
            await plugin.onRequestBody!(requestBodyCtx)

            expect(eventSpy).toHaveBeenCalledWith({
                id: 'req_123',
                content: {
                    contentType: 'application/json',
                    contentEncoding: undefined,
                    size: 15,
                    sampleSize: 15,
                    truncated: false,
                    detectedFormat: 'json',
                    encoding: 'utf8',
                    isCompressed: false,
                },
                sample: '{"name":"test"}',
                ts: expect.any(String),
            })
        })
    })

    describe('onResponseBody', () => {
        it('should emit responseBody event', async () => {
            const requestCtx: RequestContext = {
                id: 'req_123',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'GET',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                } as RequestOptions,
            }

            const responseBodyCtx: ResponseBodyContext = {
                ...requestCtx,
                body: Buffer.from('<html><body>Hello</body></html>'),
                contentType: 'text/html',
                contentEncoding: undefined,
                setBody: () => {},
                statusCode: 200,
                responseHeaders: {},
            }

            const eventSpy = vi.fn()
            eventEmitter.on('responseBody', eventSpy)

            // Initialize transaction first
            await plugin.onRequest!(requestCtx)
            await plugin.onResponseBody!(responseBodyCtx)

            expect(eventSpy).toHaveBeenCalledWith({
                id: 'req_123',
                content: {
                    contentType: 'text/html',
                    contentEncoding: undefined,
                    size: 31,
                    sampleSize: 31,
                    truncated: false,
                    detectedFormat: 'html',
                    encoding: 'utf8',
                    isCompressed: false,
                },
                sample: '<html><body>Hello</body></html>',
                ts: expect.any(String),
            })
        })
    })

    describe('onResponseComplete', () => {
        it('should emit transactionComplete event when transaction is complete', async () => {
            const requestCtx: RequestContext = {
                id: 'req_123',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                clientIp: '127.0.0.1',
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const responseCtx: ResponseContext = {
                ...requestCtx,
                statusCode: 201,
                statusMessage: 'Created',
                responseHeaders: { 'content-type': 'application/json' },
            }

            const eventSpy = vi.fn()
            eventEmitter.on('transactionComplete', eventSpy)

            // Simulate full transaction flow
            await plugin.onRequest!(requestCtx)
            await plugin.onResponse!(responseCtx)
            await plugin.onResponseComplete!(responseCtx)

            expect(eventSpy).toHaveBeenCalledWith({
                type: 'transactionComplete',
                id: 'req_123',
                ts: expect.any(String),
                transaction: {
                    request: {
                        method: 'POST',
                        url: {
                            full: 'http://example.com/api',
                            protocol: 'http:',
                            host: 'example.com',
                            port: undefined,
                            path: '/api',
                            query: undefined,
                            fragment: undefined,
                        },
                        headers: [
                            {
                                name: 'content-type',
                                value: 'application/json',
                                sensitive: false,
                            },
                        ],
                        rawHeaders: { 'content-type': 'application/json' },
                        clientIp: '127.0.0.1',
                        body: undefined,
                    },
                    response: {
                        statusCode: 201,
                        statusMessage: 'Created',
                        headers: [
                            {
                                name: 'content-type',
                                value: 'application/json',
                                sensitive: false,
                            },
                        ],
                        rawHeaders: { 'content-type': 'application/json' },
                        body: undefined,
                    },
                    timing: {
                        startTime: expect.any(Number),
                        responseTime: expect.any(Number),
                        duration: expect.any(Number),
                    },
                    summary: {
                        requestSize: undefined,
                        responseSize: undefined,
                        hasRequestBody: false,
                        hasResponseBody: false,
                    },
                    repeater: { source: 'proxy' },
                },
            })
        })

        it('should not emit transactionComplete for OPTIONS requests', async () => {
            const requestCtx: RequestContext = {
                id: 'req_options',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'OPTIONS',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const responseCtx: ResponseContext = {
                ...requestCtx,
                statusCode: 204,
                statusMessage: 'No Content',
                responseHeaders: {},
            }

            const eventSpy = vi.fn()
            eventEmitter.on('transactionComplete', eventSpy)

            await plugin.onRequest!(requestCtx)
            await plugin.onResponse!(responseCtx)
            await plugin.onResponseComplete!(responseCtx)

            expect(eventSpy).not.toHaveBeenCalled()
        })

        it('should clean up transaction state after completion', async () => {
            const requestCtx: RequestContext = {
                id: 'req_cleanup',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'GET',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const responseCtx: ResponseContext = {
                ...requestCtx,
                statusCode: 200,
                statusMessage: 'OK',
                responseHeaders: {},
            }

            await plugin.onRequest!(requestCtx)
            await plugin.onResponse!(responseCtx)
            await plugin.onResponseComplete!(responseCtx)

            // Verify state is cleaned up by calling onResponseComplete again
            // Should not emit another event
            const eventSpy = vi.fn()
            eventEmitter.on('transactionComplete', eventSpy)

            await plugin.onResponseComplete!(responseCtx)
            expect(eventSpy).not.toHaveBeenCalled()
        })
    })

    describe('error handling', () => {
        it('should handle missing transaction gracefully', async () => {
            const responseCtx: ResponseContext = {
                id: 'nonexistent_req',
                isHttps: false,
                url: new URL('http://example.com/api'),
                method: 'GET',
                headers: {},
                statusCode: 200,
                statusMessage: 'OK',
                responseHeaders: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api',
                    headers: {},
                    method: 'POST',
                },
            }

            const eventSpy = vi.fn()
            eventEmitter.on('response', eventSpy)

            // Should not throw
            await expect(
                plugin.onResponse!(responseCtx)
            ).resolves.toBeUndefined()

            // Should not emit event for missing transaction
            expect(eventSpy).not.toHaveBeenCalled()
        })
    })
})
