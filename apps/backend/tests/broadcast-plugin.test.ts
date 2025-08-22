import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { createBroadcastPlugin, type BroadcastPluginOptions } from '../src/broadcast-plugin'
import type { WsHub } from '../src/ws-hub'
import type {
    RequestContext,
    ResponseContext,
    RequestBodyContext,
    ResponseBodyContext,
} from '@arachne/proxy'
import type {
    RequestEvent,
    ResponseHeadEvent,
    RequestBodyEvent,
    ResponseBodyEvent,
    TransactionCompleteEvent,
    ErrorEvent,
} from '@arachne/api-types'

// Mock WsHub
class MockWsHub implements Partial<WsHub> {
    broadcast: Mock = vi.fn()
}

describe('BroadcastPlugin', () => {
    let mockHub: MockWsHub
    let plugin: ReturnType<typeof createBroadcastPlugin>
    let options: BroadcastPluginOptions

    beforeEach(() => {
        mockHub = new MockWsHub()
        options = {
            hub: mockHub as unknown as WsHub,
            maxSampleBytes: 1024,
        }
        plugin = createBroadcastPlugin(options)
        vi.clearAllMocks()
    })

    describe('utility functions', () => {
        describe('detectContentFormat', () => {
            it('should detect JSON content type', () => {
                // Use internal function through plugin behavior
                const mockCtx: RequestBodyContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                    body: Buffer.from('{"test": true}'),
                    contentType: 'application/json',
                    setBody: vi.fn(),
                }

                plugin.onRequestBody?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.objectContaining({
                            detectedFormat: 'json',
                        }),
                    })
                )
            })

            it('should detect XML content type', () => {
                const mockCtx: RequestBodyContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                    body: Buffer.from('<xml>test</xml>'),
                    contentType: 'application/xml',
                    setBody: vi.fn(),
                }

                plugin.onRequestBody?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.objectContaining({
                            detectedFormat: 'xml',
                        }),
                    })
                )
            })

            it('should detect HTML content type', () => {
                const mockCtx: RequestBodyContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                    body: Buffer.from('<!DOCTYPE html><html></html>'),
                    contentType: 'text/html',
                    setBody: vi.fn(),
                }

                plugin.onRequestBody?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.objectContaining({
                            detectedFormat: 'html',
                        }),
                    })
                )
            })

            it('should detect binary content by default', () => {
                const mockCtx: RequestBodyContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                    body: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG header
                    contentType: 'application/octet-stream',
                    setBody: vi.fn(),
                }

                plugin.onRequestBody?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.objectContaining({
                            detectedFormat: 'binary',
                            encoding: 'base64',
                        }),
                    })
                )
            })

            it('should prioritize content-type over sample-based detection', () => {
                const mockCtx: RequestBodyContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                    body: Buffer.from('<root><item>test</item></root>'),
                    contentType: 'text/plain', // text/ pattern should return 'text' despite XML sample
                    setBody: vi.fn(),
                }

                plugin.onRequestBody?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.objectContaining({
                            detectedFormat: 'text', // Should return 'text' due to text/plain content type
                            encoding: 'utf8',
                        }),
                    })
                )
            })

            it('should use sample-based detection when no content type is provided and UTF8 pattern', () => {
                // Use a content type that triggers UTF8 but doesn't match specific patterns
                const mockCtx: RequestBodyContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                    body: Buffer.from('{"fallback": true}'),
                    contentType: 'application/vnd.custom+json', // This triggers UTF8 due to +json suffix
                    setBody: vi.fn(),
                }

                plugin.onRequestBody?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.objectContaining({
                            detectedFormat: 'json', // Should detect from +json in content type
                            encoding: 'utf8',
                        }),
                    })
                )
            })
        })

        describe('parseHeaders', () => {
            it('should parse single-value headers', async () => {
                const mockCtx: RequestContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'test-agent',
                    },
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        headers: expect.arrayContaining([
                            { name: 'content-type', value: 'application/json', sensitive: false },
                            { name: 'user-agent', value: 'test-agent', sensitive: false },
                        ]),
                    })
                )
            })

            it('should parse multi-value headers', async () => {
                const mockCtx: RequestContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {
                        'accept': ['application/json', 'text/html'],
                    },
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        headers: expect.arrayContaining([
                            { name: 'accept', value: 'application/json, text/html', sensitive: false },
                        ]),
                    })
                )
            })

            it('should mark sensitive headers', async () => {
                const mockCtx: RequestContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {
                        'authorization': 'Bearer token123',
                        'cookie': 'sessionid=abc123',
                        'x-api-key': 'secret',
                        'content-type': 'application/json',
                    },
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        headers: expect.arrayContaining([
                            { name: 'authorization', value: 'Bearer token123', sensitive: true },
                            { name: 'cookie', value: 'sessionid=abc123', sensitive: true },
                            { name: 'x-api-key', value: 'secret', sensitive: true },
                            { name: 'content-type', value: 'application/json', sensitive: false },
                        ]),
                    })
                )
            })
        })

        describe('parseURL', () => {
            it('should parse complete URL', async () => {
                const mockCtx: RequestContext = {
                    id: 'test-1',
                    isHttps: true,
                    url: new URL('https://example.com:8080/path?query=value#fragment'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'https:',
                        hostname: 'example.com',
                        port: 8080,
                        path: '/path?query=value',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        url: {
                            full: 'https://example.com:8080/path?query=value#fragment',
                            protocol: 'https:',
                            host: 'example.com',
                            port: 8080,
                            path: '/path',
                            query: 'query=value',
                            fragment: 'fragment',
                        },
                    })
                )
            })

            it('should handle URL without optional parts', async () => {
                const mockCtx: RequestContext = {
                    id: 'test-1',
                    isHttps: false,
                    url: new URL('http://example.com/'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        url: {
                            full: 'http://example.com/',
                            protocol: 'http:',
                            host: 'example.com',
                            port: undefined,
                            path: '/',
                            query: undefined,
                            fragment: undefined,
                        },
                    })
                )
            })
        })
    })

    describe('plugin lifecycle', () => {
        describe('onRequest', () => {
            it('should broadcast request event with correct data', async () => {
                const mockCtx: RequestContext = {
                    id: 'test-req-1',
                    isHttps: true,
                    url: new URL('https://api.example.com/users'),
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'authorization': 'Bearer token123',
                    },
                    clientIp: '192.168.1.1',
                    requestOptions: {
                        protocol: 'https:',
                        hostname: 'api.example.com',
                        port: 443,
                        path: '/users',
                        method: 'POST',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(mockCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<RequestEvent>>({
                        type: 'request',
                        id: 'test-req-1',
                        method: 'POST',
                        url: expect.objectContaining({
                            full: 'https://api.example.com/users',
                            protocol: 'https:',
                            host: 'api.example.com',
                            path: '/users',
                        }),
                        headers: expect.arrayContaining([
                            { name: 'content-type', value: 'application/json', sensitive: false },
                            { name: 'authorization', value: 'Bearer token123', sensitive: true },
                        ]),
                        clientIp: '192.168.1.1',
                        ts: expect.any(String),
                        timestamp: expect.any(Number),
                    })
                )
            })

            it('should initialize transaction state', async () => {
                const mockCtx: RequestContext = {
                    id: 'test-req-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(mockCtx)

                // Verify that transaction state is tracked by completing the response
                const responseCtx: ResponseContext = {
                    ...mockCtx,
                    statusCode: 200,
                    statusMessage: 'OK',
                    responseHeaders: {},
                }

                await plugin.onResponseComplete?.(responseCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<TransactionCompleteEvent>>({
                        type: 'transactionComplete',
                        id: 'test-req-1',
                    })
                )
            })
        })

        describe('onResponse', () => {
            it('should broadcast response head event', async () => {
                // First send request to initialize transaction
                const requestCtx: RequestContext = {
                    id: 'test-resp-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)
                vi.clearAllMocks()

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 201,
                    statusMessage: 'Created',
                    responseHeaders: {
                        'content-type': 'application/json',
                        'set-cookie': 'sessionid=abc123',
                    },
                }

                await plugin.onResponse?.(responseCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<ResponseHeadEvent>>({
                        type: 'responseHead',
                        id: 'test-resp-1',
                        statusCode: 201,
                        statusMessage: 'Created',
                        headers: expect.arrayContaining([
                            { name: 'content-type', value: 'application/json', sensitive: false },
                            { name: 'set-cookie', value: 'sessionid=abc123', sensitive: true },
                        ]),
                        timing: expect.objectContaining({
                            startTime: expect.any(Number),
                            responseTime: expect.any(Number),
                            duration: expect.any(Number),
                        }),
                    })
                )
            })

            it('should update transaction state', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-resp-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 404,
                    statusMessage: 'Not Found',
                    responseHeaders: {},
                }

                await plugin.onResponse?.(responseCtx)
                await plugin.onResponseComplete?.(responseCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<TransactionCompleteEvent>>({
                        type: 'transactionComplete',
                        transaction: expect.objectContaining({
                            response: expect.objectContaining({
                                statusCode: 404,
                                statusMessage: 'Not Found',
                            }),
                        }),
                    })
                )
            })
        })

        describe('onRequestBody', () => {
            it('should broadcast request body event with UTF-8 content', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-req-body-1',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const bodyCtx: RequestBodyContext = {
                    ...requestCtx,
                    body: Buffer.from('{"name": "test"}'),
                    contentType: 'application/json',
                    setBody: vi.fn(),
                }

                await plugin.onRequestBody?.(bodyCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<RequestBodyEvent>>({
                        type: 'requestBody',
                        id: 'test-req-body-1',
                        content: expect.objectContaining({
                            contentType: 'application/json',
                            size: 16,
                            sampleSize: 16,
                            truncated: false,
                            detectedFormat: 'json',
                            encoding: 'utf8',
                        }),
                        sample: '{"name": "test"}',
                    })
                )
            })

            it('should broadcast request body event with base64 content', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-req-body-2',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
                const bodyCtx: RequestBodyContext = {
                    ...requestCtx,
                    body: binaryData,
                    contentType: 'image/png',
                    setBody: vi.fn(),
                }

                await plugin.onRequestBody?.(bodyCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<RequestBodyEvent>>({
                        type: 'requestBody',
                        id: 'test-req-body-2',
                        content: expect.objectContaining({
                            contentType: 'image/png',
                            detectedFormat: 'image',
                            encoding: 'base64',
                        }),
                        sample: 'base64:' + binaryData.toString('base64'),
                    })
                )
            })

            it('should handle content truncation', async () => {
                const plugin = createBroadcastPlugin({
                    hub: mockHub as unknown as WsHub,
                    maxSampleBytes: 10, // Small limit to force truncation
                })

                const requestCtx: RequestContext = {
                    id: 'test-truncate',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const longContent = 'This is a very long content that should be truncated'
                const bodyCtx: RequestBodyContext = {
                    ...requestCtx,
                    body: Buffer.from(longContent),
                    contentType: 'text/plain',
                    setBody: vi.fn(),
                }

                await plugin.onRequestBody?.(bodyCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<RequestBodyEvent>>({
                        type: 'requestBody',
                        content: expect.objectContaining({
                            size: longContent.length,
                            sampleSize: 10,
                            truncated: true,
                        }),
                        sample: 'This is a ',
                    })
                )
            })

            it('should update transaction state with request body', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-transaction-req-body',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'POST',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'POST',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const bodyContent = '{"data": "test"}'
                const bodyCtx: RequestBodyContext = {
                    ...requestCtx,
                    body: Buffer.from(bodyContent),
                    contentType: 'application/json',
                    setBody: vi.fn(),
                }

                await plugin.onRequestBody?.(bodyCtx)

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 200,
                    statusMessage: 'OK',
                    responseHeaders: {},
                }

                await plugin.onResponseComplete?.(responseCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<TransactionCompleteEvent>>({
                        type: 'transactionComplete',
                        transaction: expect.objectContaining({
                            request: expect.objectContaining({
                                body: expect.objectContaining({
                                    content: expect.objectContaining({
                                        size: bodyContent.length,
                                    }),
                                    sample: bodyContent,
                                }),
                            }),
                            summary: expect.objectContaining({
                                requestSize: bodyContent.length,
                                hasRequestBody: true,
                            }),
                        }),
                    })
                )
            })
        })

        describe('onResponseBody', () => {
            it('should broadcast response body event', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-resp-body',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 200,
                    statusMessage: 'OK',
                    responseHeaders: {},
                }

                await plugin.onResponse?.(responseCtx)

                const responseBody = '{"result": "success"}'
                const bodyCtx: ResponseBodyContext = {
                    ...responseCtx,
                    body: Buffer.from(responseBody),
                    contentType: 'application/json',
                    setBody: vi.fn(),
                }

                await plugin.onResponseBody?.(bodyCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<ResponseBodyEvent>>({
                        type: 'responseBody',
                        id: 'test-resp-body',
                        content: expect.objectContaining({
                            contentType: 'application/json',
                            size: responseBody.length,
                            detectedFormat: 'json',
                            encoding: 'utf8',
                        }),
                        sample: responseBody,
                    })
                )
            })

            it('should update transaction state with response body', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-transaction-resp-body',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 200,
                    statusMessage: 'OK',
                    responseHeaders: {},
                }

                await plugin.onResponse?.(responseCtx)

                const responseBody = '{"message": "Hello World"}'
                const bodyCtx: ResponseBodyContext = {
                    ...responseCtx,
                    body: Buffer.from(responseBody),
                    contentType: 'application/json',
                    setBody: vi.fn(),
                }

                await plugin.onResponseBody?.(bodyCtx)
                await plugin.onResponseComplete?.(responseCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<TransactionCompleteEvent>>({
                        type: 'transactionComplete',
                        transaction: expect.objectContaining({
                            response: expect.objectContaining({
                                body: expect.objectContaining({
                                    content: expect.objectContaining({
                                        size: responseBody.length,
                                    }),
                                    sample: responseBody,
                                }),
                            }),
                            summary: expect.objectContaining({
                                responseSize: responseBody.length,
                                hasResponseBody: true,
                            }),
                        }),
                    })
                )
            })
        })

        describe('onResponseComplete', () => {
            it('should broadcast transaction complete event', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-complete',
                    isHttps: true,
                    url: new URL('https://api.example.com/test'),
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    clientIp: '10.0.0.1',
                    requestOptions: {
                        protocol: 'https:',
                        hostname: 'api.example.com',
                        port: 443,
                        path: '/test',
                        method: 'POST',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 201,
                    statusMessage: 'Created',
                    responseHeaders: { 'location': '/test/123' },
                }

                await plugin.onResponse?.(responseCtx)
                await plugin.onResponseComplete?.(responseCtx)

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<TransactionCompleteEvent>>({
                        type: 'transactionComplete',
                        id: 'test-complete',
                        transaction: expect.objectContaining({
                            request: expect.objectContaining({
                                method: 'POST',
                                url: expect.objectContaining({
                                    full: 'https://api.example.com/test',
                                }),
                                clientIp: '10.0.0.1',
                            }),
                            response: expect.objectContaining({
                                statusCode: 201,
                                statusMessage: 'Created',
                            }),
                            timing: expect.objectContaining({
                                startTime: expect.any(Number),
                                responseTime: expect.any(Number),
                                duration: expect.any(Number),
                            }),
                            summary: expect.objectContaining({
                                hasRequestBody: false,
                                hasResponseBody: false,
                            }),
                        }),
                    })
                )
            })

            it('should clean up transaction state after completion', async () => {
                const requestCtx: RequestContext = {
                    id: 'test-cleanup',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                await plugin.onRequest?.(requestCtx)

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 200,
                    responseHeaders: {},
                }

                await plugin.onResponseComplete?.(responseCtx)

                // Call onResponseComplete again - should not broadcast again
                vi.clearAllMocks()
                await plugin.onResponseComplete?.(responseCtx)

                expect(mockHub.broadcast).not.toHaveBeenCalled()
            })
        })
    })

    describe('error handling', () => {
        describe('onError', () => {
            it('should broadcast error event with Error object', () => {
                const error = new Error('Test error message')
                error.stack = 'Error: Test error message\n    at test.js:1:1'

                plugin.onError?.(error, { id: 'error-test-1' })

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<ErrorEvent>>({
                        type: 'error',
                        id: 'error-test-1',
                        message: 'Test error message',
                        stack: 'Error: Test error message\n    at test.js:1:1',
                        phase: 'connection',
                    })
                )
            })

            it('should broadcast error event with string error', () => {
                plugin.onError?.('String error message', { id: 'error-test-2' })

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<ErrorEvent>>({
                        type: 'error',
                        id: 'error-test-2',
                        message: 'String error message',
                        stack: undefined,
                        phase: 'connection',
                    })
                )
            })

            it('should handle error without context ID', () => {
                const error = new Error('No context error')

                plugin.onError?.(error, {})

                expect(mockHub.broadcast).toHaveBeenCalledWith(
                    expect.objectContaining<Partial<ErrorEvent>>({
                        type: 'error',
                        id: expect.stringMatching(/^err_[a-z0-9]+$/),
                        message: 'No context error',
                    })
                )
            })

            it('should complete transaction on error if ID exists', () => {
                const requestCtx: RequestContext = {
                    id: 'error-transaction-test',
                    isHttps: false,
                    url: new URL('http://example.com'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/',
                        method: 'GET',
                        headers: {},
                    },
                }

                // Initialize transaction
                plugin.onRequest?.(requestCtx)
                vi.clearAllMocks()

                // Trigger error
                plugin.onError?.(new Error('Request failed'), { id: 'error-transaction-test' })

                expect(mockHub.broadcast).toHaveBeenCalledTimes(2)
                expect(mockHub.broadcast).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'error' }))
                expect(mockHub.broadcast).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'transactionComplete' }))
            })

            it('should handle errors in error handler gracefully', () => {
                // Mock broadcast to throw an error
                mockHub.broadcast.mockImplementation(() => {
                    throw new Error('Broadcast failed')
                })

                // Should not throw
                expect(() => {
                    plugin.onError?.(new Error('Original error'), { id: 'test' })
                }).not.toThrow()
            })
        })
    })

    describe('content processing edge cases', () => {
        it('should handle empty body', async () => {
            const requestCtx: RequestContext = {
                id: 'empty-body-test',
                isHttps: false,
                url: new URL('http://example.com'),
                method: 'POST',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/',
                    method: 'POST',
                    headers: {},
                },
            }

            await plugin.onRequest?.(requestCtx)

            const bodyCtx: RequestBodyContext = {
                ...requestCtx,
                body: Buffer.alloc(0),
                contentType: 'application/json',
                setBody: vi.fn(),
            }

            await plugin.onRequestBody?.(bodyCtx)

            expect(mockHub.broadcast).toHaveBeenCalledWith(
                expect.objectContaining<Partial<RequestBodyEvent>>({
                    type: 'requestBody',
                    content: expect.objectContaining({
                        size: 0,
                        sampleSize: 0,
                        truncated: false,
                    }),
                    sample: '',
                })
            )
        })

        it('should handle compressed content', async () => {
            const requestCtx: RequestContext = {
                id: 'compressed-test',
                isHttps: false,
                url: new URL('http://example.com'),
                method: 'POST',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/',
                    method: 'POST',
                    headers: {},
                },
            }

            await plugin.onRequest?.(requestCtx)

            const bodyCtx: RequestBodyContext = {
                ...requestCtx,
                body: Buffer.from('compressed data'),
                contentType: 'application/json',
                contentEncoding: 'gzip',
                setBody: vi.fn(),
            }

            await plugin.onRequestBody?.(bodyCtx)

            expect(mockHub.broadcast).toHaveBeenCalledWith(
                expect.objectContaining<Partial<RequestBodyEvent>>({
                    type: 'requestBody',
                    content: expect.objectContaining({
                        contentEncoding: 'gzip',
                        isCompressed: true,
                    }),
                })
            )
        })

        it('should handle form data content type', async () => {
            const requestCtx: RequestContext = {
                id: 'form-test',
                isHttps: false,
                url: new URL('http://example.com'),
                method: 'POST',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/',
                    method: 'POST',
                    headers: {},
                },
            }

            await plugin.onRequest?.(requestCtx)

            const bodyCtx: RequestBodyContext = {
                ...requestCtx,
                body: Buffer.from('key1=value1&key2=value2'),
                contentType: 'application/x-www-form-urlencoded',
                setBody: vi.fn(),
            }

            await plugin.onRequestBody?.(bodyCtx)

            expect(mockHub.broadcast).toHaveBeenCalledWith(
                expect.objectContaining<Partial<RequestBodyEvent>>({
                    type: 'requestBody',
                    content: expect.objectContaining({
                        detectedFormat: 'form',
                        encoding: 'utf8',
                    }),
                })
            )
        })

        it('should handle JavaScript content type', async () => {
            const requestCtx: RequestContext = {
                id: 'js-test',
                isHttps: false,
                url: new URL('http://example.com'),
                method: 'POST',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/',
                    method: 'POST',
                    headers: {},
                },
            }

            await plugin.onRequest?.(requestCtx)

            const jsCode = 'function test() { return "hello"; }'
            const bodyCtx: RequestBodyContext = {
                ...requestCtx,
                body: Buffer.from(jsCode),
                contentType: 'application/javascript',
                setBody: vi.fn(),
            }

            await plugin.onRequestBody?.(bodyCtx)

            expect(mockHub.broadcast).toHaveBeenCalledWith(
                expect.objectContaining<Partial<RequestBodyEvent>>({
                    type: 'requestBody',
                    content: expect.objectContaining({
                        detectedFormat: 'javascript',
                        encoding: 'utf8',
                    }),
                    sample: jsCode,
                })
            )
        })

        it('should handle CSS content type', async () => {
            const requestCtx: RequestContext = {
                id: 'css-test',
                isHttps: false,
                url: new URL('http://example.com'),
                method: 'POST',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/',
                    method: 'POST',
                    headers: {},
                },
            }

            await plugin.onRequest?.(requestCtx)

            const cssCode = 'body { margin: 0; padding: 0; }'
            const bodyCtx: RequestBodyContext = {
                ...requestCtx,
                body: Buffer.from(cssCode),
                contentType: 'text/css',
                setBody: vi.fn(),
            }

            await plugin.onRequestBody?.(bodyCtx)

            expect(mockHub.broadcast).toHaveBeenCalledWith(
                expect.objectContaining<Partial<RequestBodyEvent>>({
                    type: 'requestBody',
                    content: expect.objectContaining({
                        detectedFormat: 'css',
                        encoding: 'utf8',
                    }),
                    sample: cssCode,
                })
            )
        })
    })

    describe('configuration options', () => {
        it('should use default max sample bytes when not specified', () => {
            const pluginWithDefaults = createBroadcastPlugin({
                hub: mockHub as unknown as WsHub,
            })

            expect(pluginWithDefaults.name).toBe('ws-broadcast')
        })

        it('should respect custom max sample bytes', async () => {
            const customPlugin = createBroadcastPlugin({
                hub: mockHub as unknown as WsHub,
                maxSampleBytes: 5,
            })

            const requestCtx: RequestContext = {
                id: 'custom-limit-test',
                isHttps: false,
                url: new URL('http://example.com'),
                method: 'POST',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/',
                    method: 'POST',
                    headers: {},
                },
            }

            await customPlugin.onRequest?.(requestCtx)

            const bodyCtx: RequestBodyContext = {
                ...requestCtx,
                body: Buffer.from('This is longer than 5 bytes'),
                contentType: 'text/plain',
                setBody: vi.fn(),
            }

            await customPlugin.onRequestBody?.(bodyCtx)

            // Should be called twice: once for request, once for request body
            expect(mockHub.broadcast).toHaveBeenCalledTimes(2)
            
            // Check the second call (request body event)
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(2,
                expect.objectContaining<Partial<RequestBodyEvent>>({
                    type: 'requestBody',
                    content: expect.objectContaining({
                        size: 27, // Full content size (corrected)
                        sampleSize: 5, // Limited by maxSampleBytes
                        truncated: true,
                    }),
                    sample: 'This ',
                })
            )
        })
    })

    describe('plugin metadata', () => {
        it('should have correct plugin name', () => {
            expect(plugin.name).toBe('ws-broadcast')
        })

        it('should expose all required plugin methods', () => {
            expect(plugin.onRequest).toBeDefined()
            expect(plugin.onResponse).toBeDefined()
            expect(plugin.onRequestBody).toBeDefined()
            expect(plugin.onResponseBody).toBeDefined()
            expect(plugin.onResponseComplete).toBeDefined()
            expect(plugin.onError).toBeDefined()
        })
    })
})
