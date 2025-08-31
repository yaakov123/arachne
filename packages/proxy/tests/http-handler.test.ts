import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, Writable } from 'node:stream'
import { HttpHandler } from '../src/core/http-handler'
import { PluginManager } from '../src/core/plugin-manager'
import type { ErrorContext } from '../src/plugins/types'
import { ProxyConfigStore } from '../src/core/config-store'

// Mock dependencies
vi.mock('../src/core/url-processor', () => ({
    UrlProcessor: {
        buildFullUrl: vi.fn(),
    },
}))

vi.mock('../src/core/context-accumulator', () => ({
    ContextAccumulator: vi.fn(),
}))

vi.mock('../src/core/body-handler', () => ({
    BodyHandler: vi.fn(),
}))

vi.mock('../src/core/upstream-handler', () => ({
    UpstreamHandler: vi.fn(),
}))

vi.mock('../src/core/tunnel-handler', () => ({
    TunnelHandler: vi.fn(),
}))

vi.mock('../src/logger', () => ({
    logger: {
        logRequest: vi.fn(),
        logResponse: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('../src/core/utils/headers', () => ({
    shouldIgnoreHost: vi.fn(),
}))

vi.mock('../src/core/utils/ids', () => ({
    createCorrelationId: vi.fn(),
    extendCorrelationId: vi.fn(),
}))

vi.mock('../src/core/error-responses', () => ({
    sendHttpErrorResponse: vi.fn(),
}))

import { UrlProcessor } from '../src/core/url-processor'
import { ContextAccumulator } from '../src/core/context-accumulator'
import { BodyHandler } from '../src/core/body-handler'
import { UpstreamHandler } from '../src/core/upstream-handler'
import { TunnelHandler } from '../src/core/tunnel-handler'
import { logger } from '../src/logger'
import { shouldIgnoreHost } from '../src/core/utils/headers'
import { createCorrelationId, extendCorrelationId } from '../src/core/utils/ids'
import { sendHttpErrorResponse } from '../src/core/error-responses'

// Mock constructors
const MockContextAccumulator = ContextAccumulator as any
const MockBodyHandler = BodyHandler as any
const MockUpstreamHandler = UpstreamHandler as any
const MockTunnelHandler = TunnelHandler as any

// Mock implementations
const createMockIncomingMessage = (
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
        },
        ...overrides,
    }) as IncomingMessage
}

const createMockServerResponse = (): ServerResponse => {
    const stream = new Writable({
        write(chunk, encoding, callback) {
            if (callback) callback()
        },
    })

    return Object.assign(stream, {
        writeHead: vi.fn(),
        end: vi.fn(),
        headersSent: false,
        finished: false,
    }) as any
}

describe('HttpHandler', () => {
    let handler: HttpHandler
    let mockPluginManager: PluginManager
    let mockOnError: (err: unknown, ctx: ErrorContext) => void
    let mockConfigStore: ProxyConfigStore

    // Mock instances
    let mockContextAccumulator: any
    let mockBodyHandler: any
    let mockUpstreamHandler: any
    let mockTunnelHandler: any

    beforeEach(() => {
        vi.clearAllMocks()

        // Create mock instances
        mockContextAccumulator = {
            buildBeforeRequestContext: vi.fn(),
            buildAfterRequestContext: vi.fn(),
            buildBeforeResponseContext: vi.fn(),
            buildAfterResponseContext: vi.fn(),
            getFinalRequestState: vi.fn(),
            getFinalResponseState: vi.fn(),
            getAfterRequestContext: vi.fn(),
        }

        mockBodyHandler = {
            bufferRequestBody: vi.fn(),
            bufferResponseBody: vi.fn(),
            prepareHeadersForBufferedContent: vi.fn(),
            prepareHeadersForStreaming: vi.fn(),
        }

        mockUpstreamHandler = {
            sendRequest: vi.fn(),
            sendBufferedResponse: vi.fn(),
            streamResponse: vi.fn(),
            handleUpstreamError: vi.fn(),
        }

        mockTunnelHandler = {
            createHttpTunnel: vi.fn(),
        }

        // Mock constructors to return our mock instances
        MockContextAccumulator.mockImplementation(() => mockContextAccumulator)
        MockBodyHandler.mockImplementation(() => mockBodyHandler)
        MockUpstreamHandler.mockImplementation(() => mockUpstreamHandler)
        MockTunnelHandler.mockImplementation(() => mockTunnelHandler)

        // Create mocks for dependencies
        mockPluginManager = {
            executeBeforeRequest: vi.fn(),
            executeAfterRequest: vi.fn(),
            executeBeforeResponse: vi.fn(),
            executeAfterResponse: vi.fn(),
            hasResponseHooks: vi.fn(),
        } as any

        mockOnError = vi.fn()

        mockConfigStore = {
            current: {
                hostFilter: [],
                hostFilterMode: 'whitelist' as const,
                maxBodySize: 1024 * 1024,
            },
        } as any

        handler = new HttpHandler(
            mockPluginManager,
            mockOnError,
            mockConfigStore
        )
    })

    describe('handleHttpRequest', () => {
        it('should handle basic HTTP request flow', async () => {
            // Setup mocks
            const testUrl = new URL('https://example.com/test')
            const mockReq = createMockIncomingMessage()
            const mockRes = createMockServerResponse()

            const mockCorrelation = { full: 'req_123456', parentId: undefined }
            const mockBeforeRequestContext = { id: 'req_123456', request: {} }
            const mockAfterRequestContext = { id: 'req_123456' }
            const mockFinalRequest = {
                url: testUrl,
                method: 'GET',
                headers: {},
                body: undefined,
            }
            const mockUpstreamResponse = createMockIncomingMessage({
                statusCode: 200,
            })

            // Configure mocks
            vi.mocked(UrlProcessor.buildFullUrl).mockReturnValue(testUrl)
            vi.mocked(shouldIgnoreHost).mockReturnValue(false)
            vi.mocked(createCorrelationId).mockReturnValue(mockCorrelation)

            mockBodyHandler.bufferRequestBody.mockResolvedValue(undefined)
            mockContextAccumulator.buildBeforeRequestContext.mockReturnValue(
                mockBeforeRequestContext
            )
            mockContextAccumulator.buildAfterRequestContext.mockReturnValue(
                mockAfterRequestContext
            )
            mockContextAccumulator.getFinalRequestState.mockReturnValue(
                mockFinalRequest
            )
            mockContextAccumulator.getAfterRequestContext.mockReturnValue(
                mockAfterRequestContext
            )

            vi.mocked(mockPluginManager.executeBeforeRequest).mockResolvedValue(
                {} as any
            )
            vi.mocked(mockPluginManager.executeAfterRequest).mockResolvedValue(
                undefined
            )
            vi.mocked(mockPluginManager.hasResponseHooks).mockReturnValue(false)

            mockUpstreamHandler.sendRequest.mockResolvedValue(
                mockUpstreamResponse
            )
            mockBodyHandler.bufferResponseBody.mockResolvedValue(undefined)
            mockBodyHandler.prepareHeadersForStreaming.mockReturnValue({})

            // Execute
            await handler.handleHttpRequest(mockReq, mockRes, true)

            // Verify
            expect(vi.mocked(UrlProcessor.buildFullUrl)).toHaveBeenCalledWith(
                mockReq,
                true
            )
            expect(mockPluginManager.executeBeforeRequest).toHaveBeenCalledWith(
                mockBeforeRequestContext
            )
            expect(mockPluginManager.executeAfterRequest).toHaveBeenCalledWith(
                mockAfterRequestContext
            )
            expect(mockUpstreamHandler.sendRequest).toHaveBeenCalled()
        })

        it('should create direct tunnel for ignored hosts', async () => {
            const testUrl = new URL('https://ignored.com/test')
            const mockReq = createMockIncomingMessage()
            const mockRes = createMockServerResponse()

            vi.mocked(UrlProcessor.buildFullUrl).mockReturnValue(testUrl)
            vi.mocked(shouldIgnoreHost).mockReturnValue(true)
            vi.mocked(createCorrelationId).mockReturnValue({
                full: 'req_123456',
            })

            await handler.handleHttpRequest(mockReq, mockRes, true)

            expect(mockTunnelHandler.createHttpTunnel).toHaveBeenCalledWith(
                mockReq,
                mockRes,
                expect.objectContaining({
                    hostname: 'ignored.com',
                    isHttps: true,
                })
            )
            expect(
                mockPluginManager.executeBeforeRequest
            ).not.toHaveBeenCalled()
        })

        it('should handle request body buffering', async () => {
            const testUrl = new URL('https://example.com/test')
            const mockReq = createMockIncomingMessage({ method: 'POST' })
            const mockRes = createMockServerResponse()
            const testBody = Buffer.from('request body')

            vi.mocked(UrlProcessor.buildFullUrl).mockReturnValue(testUrl)
            vi.mocked(shouldIgnoreHost).mockReturnValue(false)
            vi.mocked(createCorrelationId).mockReturnValue({
                full: 'req_123456',
            })

            mockBodyHandler.bufferRequestBody.mockResolvedValue(testBody)
            mockContextAccumulator.buildBeforeRequestContext.mockReturnValue({
                request: {},
            })
            mockContextAccumulator.buildAfterRequestContext.mockReturnValue({})
            mockContextAccumulator.getFinalRequestState.mockReturnValue({
                url: testUrl,
                method: 'POST',
                headers: {},
                body: testBody,
            })
            mockContextAccumulator.getAfterRequestContext.mockReturnValue({})

            vi.mocked(mockPluginManager.executeBeforeRequest).mockResolvedValue(
                {} as any
            )
            vi.mocked(mockPluginManager.hasResponseHooks).mockReturnValue(false)
            mockUpstreamHandler.sendRequest.mockResolvedValue(
                createMockIncomingMessage()
            )
            mockBodyHandler.bufferResponseBody.mockResolvedValue(undefined)

            await handler.handleHttpRequest(mockReq, mockRes, false)

            expect(mockBodyHandler.bufferRequestBody).toHaveBeenCalledWith(
                mockReq
            )
        })

        it('should set accept-encoding to identity when response hooks present', async () => {
            const testUrl = new URL('https://example.com/test')
            const mockReq = createMockIncomingMessage()
            const mockRes = createMockServerResponse()

            vi.mocked(UrlProcessor.buildFullUrl).mockReturnValue(testUrl)
            vi.mocked(shouldIgnoreHost).mockReturnValue(false)
            vi.mocked(createCorrelationId).mockReturnValue({
                full: 'req_123456',
            })

            const mockFinalRequest = {
                url: testUrl,
                method: 'GET',
                headers: { 'user-agent': 'test' },
                body: undefined,
            }

            mockBodyHandler.bufferRequestBody.mockResolvedValue(undefined)
            mockContextAccumulator.buildBeforeRequestContext.mockReturnValue({
                request: {},
            })
            mockContextAccumulator.buildAfterRequestContext.mockReturnValue({})
            mockContextAccumulator.getFinalRequestState.mockReturnValue(
                mockFinalRequest
            )
            mockContextAccumulator.getAfterRequestContext.mockReturnValue({})

            vi.mocked(mockPluginManager.executeBeforeRequest).mockResolvedValue(
                {} as any
            )
            vi.mocked(mockPluginManager.hasResponseHooks).mockReturnValue(true) // Response hooks present
            mockUpstreamHandler.sendRequest.mockResolvedValue(
                createMockIncomingMessage()
            )
            mockBodyHandler.bufferResponseBody.mockResolvedValue(
                Buffer.from('response')
            )

            await handler.handleHttpRequest(mockReq, mockRes, false)

            expect(mockFinalRequest.headers['accept-encoding']).toBe('identity')
        })

        it('should handle response buffering when response hooks present', async () => {
            const testUrl = new URL('https://example.com/test')
            const mockReq = createMockIncomingMessage()
            const mockRes = createMockServerResponse()
            const responseBody = Buffer.from('response body')

            vi.mocked(UrlProcessor.buildFullUrl).mockReturnValue(testUrl)
            vi.mocked(shouldIgnoreHost).mockReturnValue(false)
            vi.mocked(createCorrelationId).mockReturnValue({
                full: 'req_123456',
            })

            mockBodyHandler.bufferRequestBody.mockResolvedValue(undefined)
            mockContextAccumulator.buildBeforeRequestContext.mockReturnValue({
                request: {},
            })
            mockContextAccumulator.buildAfterRequestContext.mockReturnValue({})
            mockContextAccumulator.getFinalRequestState.mockReturnValue({
                url: testUrl,
                method: 'GET',
                headers: {},
            })
            mockContextAccumulator.getAfterRequestContext.mockReturnValue({})
            mockContextAccumulator.buildBeforeResponseContext.mockReturnValue({
                response: {},
            })
            mockContextAccumulator.buildAfterResponseContext.mockReturnValue({})
            mockContextAccumulator.getFinalResponseState.mockReturnValue({
                statusCode: 200,
                headers: {},
                body: responseBody,
            })

            vi.mocked(mockPluginManager.executeBeforeRequest).mockResolvedValue(
                {} as any
            )
            vi.mocked(mockPluginManager.hasResponseHooks).mockReturnValue(true)
            vi.mocked(
                mockPluginManager.executeBeforeResponse
            ).mockResolvedValue({
                getHeaders: () => ({}),
                getStatusCode: () => 200,
                getStatusMessage: () => undefined,
                getBody: () => responseBody,
            } as any)
            vi.mocked(
                mockPluginManager.executeAfterResponse
            ).mockResolvedValue()

            mockUpstreamHandler.sendRequest.mockResolvedValue(
                createMockIncomingMessage({ statusCode: 200 })
            )
            mockBodyHandler.bufferResponseBody.mockResolvedValue(responseBody)
            mockBodyHandler.prepareHeadersForBufferedContent.mockReturnValue({})

            await handler.handleHttpRequest(mockReq, mockRes, false)

            expect(mockPluginManager.executeBeforeResponse).toHaveBeenCalled()
            expect(mockPluginManager.executeAfterResponse).toHaveBeenCalled()
            expect(
                mockUpstreamHandler.sendBufferedResponse
            ).toHaveBeenCalledWith(mockRes, 200, undefined, {}, responseBody)
        })

        it('should handle errors gracefully', async () => {
            const mockReq = createMockIncomingMessage()
            const mockRes = createMockServerResponse()

            vi.mocked(UrlProcessor.buildFullUrl).mockImplementation(() => {
                throw new Error('URL parsing error')
            })
            vi.mocked(createCorrelationId).mockReturnValue({
                full: 'req_123456',
            })

            await handler.handleHttpRequest(mockReq, mockRes, false)

            expect(mockOnError).toHaveBeenCalledWith(expect.any(Error), {
                id: 'req_123456',
            })
            expect(vi.mocked(sendHttpErrorResponse)).toHaveBeenCalledWith(
                mockRes,
                500,
                'Internal Server Error',
                'Internal server error',
                logger,
                expect.any(Object)
            )
        })

        it('should handle missing host header error', async () => {
            const mockReq = createMockIncomingMessage()
            const mockRes = createMockServerResponse()

            vi.mocked(UrlProcessor.buildFullUrl).mockImplementation(() => {
                throw new Error('Host header missing')
            })
            vi.mocked(createCorrelationId).mockReturnValue({
                full: 'req_123456',
            })

            await handler.handleHttpRequest(mockReq, mockRes, false)

            expect(vi.mocked(sendHttpErrorResponse)).toHaveBeenCalledWith(
                mockRes,
                400,
                'Bad Request: Missing Host header',
                undefined,
                logger,
                expect.any(Object)
            )
        })

        it('should use extended correlation ID when parent provided', async () => {
            const testUrl = new URL('https://example.com/test')
            const mockReq = createMockIncomingMessage()
            const mockRes = createMockServerResponse()
            const parentCorrelation = {
                full: 'conn_parent',
                parentId: undefined,
            }
            const extendedCorrelation = {
                full: 'req_child',
                parentId: 'conn_parent',
            }

            vi.mocked(UrlProcessor.buildFullUrl).mockReturnValue(testUrl)
            vi.mocked(shouldIgnoreHost).mockReturnValue(false)
            vi.mocked(extendCorrelationId).mockReturnValue(extendedCorrelation)

            mockBodyHandler.bufferRequestBody.mockResolvedValue(undefined)
            mockContextAccumulator.buildBeforeRequestContext.mockReturnValue({
                request: {},
            })
            mockContextAccumulator.buildAfterRequestContext.mockReturnValue({})
            mockContextAccumulator.getFinalRequestState.mockReturnValue({
                url: testUrl,
                method: 'GET',
                headers: {},
            })
            mockContextAccumulator.getAfterRequestContext.mockReturnValue({})

            vi.mocked(mockPluginManager.executeBeforeRequest).mockResolvedValue(
                {} as any
            )
            vi.mocked(mockPluginManager.hasResponseHooks).mockReturnValue(false)
            mockUpstreamHandler.sendRequest.mockResolvedValue(
                createMockIncomingMessage()
            )
            mockBodyHandler.bufferResponseBody.mockResolvedValue(undefined)

            await handler.handleHttpRequest(
                mockReq,
                mockRes,
                false,
                parentCorrelation
            )

            expect(vi.mocked(extendCorrelationId)).toHaveBeenCalledWith(
                parentCorrelation,
                'req'
            )
        })
    })

    describe('normalizeHeaders', () => {
        it('should remove undefined header values', () => {
            const headers = {
                'content-type': 'application/json',
                'content-length': '100',
                'undefined-header': undefined,
            } as any

            // Access private method through any cast
            const result = (handler as any).normalizeHeaders(headers)

            expect(result).toEqual({
                'content-type': 'application/json',
                'content-length': '100',
            })
        })

        it('should preserve defined header values', () => {
            const headers = {
                host: 'example.com',
                'user-agent': 'test-agent',
                authorization: 'Bearer token',
            }

            const result = (handler as any).normalizeHeaders(headers)

            expect(result).toEqual(headers)
        })
    })
})
