import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { BodyHandler } from '../src/core/body-handler'

// Mock the body utilities
vi.mock('../src/core/utils/body', () => ({
    readStreamToBuffer: vi.fn(),
    decodeBody: vi.fn(),
}))

import { readStreamToBuffer, decodeBody } from '../src/core/utils/body'

const mockReadStreamToBuffer = readStreamToBuffer as any
const mockDecodeBody = decodeBody as any

// Mock IncomingMessage
const createMockIncomingMessage = (
    overrides: Partial<IncomingMessage> = {}
): IncomingMessage => {
    const stream = new Readable({
        read() {
            this.push(null) // End stream immediately
        },
    })

    return Object.assign(stream, {
        headers: {},
        method: 'GET',
        statusCode: 200,
        ...overrides,
    }) as IncomingMessage
}

describe('BodyHandler', () => {
    let handler: BodyHandler
    const maxBodySize = 1024 * 1024 // 1MB

    beforeEach(() => {
        handler = new BodyHandler(maxBodySize)
        vi.clearAllMocks()
    })

    describe('shouldBufferRequest', () => {
        it('should buffer POST requests with valid content-length', () => {
            expect(handler.shouldBufferRequest('POST', 1000)).toBe(true)
        })

        it('should buffer PUT requests with valid content-length', () => {
            expect(handler.shouldBufferRequest('PUT', 500)).toBe(true)
        })

        it('should buffer PATCH requests with valid content-length', () => {
            expect(handler.shouldBufferRequest('PATCH', 200)).toBe(true)
        })

        it('should buffer DELETE requests with valid content-length', () => {
            expect(handler.shouldBufferRequest('DELETE', 100)).toBe(true)
        })

        it('should not buffer GET requests', () => {
            expect(handler.shouldBufferRequest('GET', 1000)).toBe(false)
        })

        it('should not buffer HEAD requests', () => {
            expect(handler.shouldBufferRequest('HEAD', 1000)).toBe(false)
        })

        it('should not buffer OPTIONS requests', () => {
            expect(handler.shouldBufferRequest('OPTIONS', 1000)).toBe(false)
        })

        it('should not buffer requests without content-length', () => {
            expect(handler.shouldBufferRequest('POST')).toBe(false)
            expect(handler.shouldBufferRequest('POST', undefined)).toBe(false)
        })

        it('should not buffer requests exceeding max size', () => {
            expect(handler.shouldBufferRequest('POST', maxBodySize + 1)).toBe(
                false
            )
        })

        it('should handle case-insensitive methods', () => {
            expect(handler.shouldBufferRequest('post', 1000)).toBe(true)
            expect(handler.shouldBufferRequest('get', 1000)).toBe(false)
        })
    })

    describe('shouldBufferResponse', () => {
        it('should buffer responses when response hooks are present', () => {
            expect(handler.shouldBufferResponse('GET', 200, 1000, true)).toBe(
                true
            )
        })

        it('should not buffer responses when no response hooks', () => {
            expect(handler.shouldBufferResponse('GET', 200, 1000, false)).toBe(
                false
            )
        })

        it('should not buffer HEAD responses even with hooks', () => {
            expect(handler.shouldBufferResponse('HEAD', 200, 1000, true)).toBe(
                false
            )
        })

        it('should not buffer 204 No Content responses', () => {
            expect(handler.shouldBufferResponse('GET', 204, 1000, true)).toBe(
                false
            )
        })

        it('should not buffer 304 Not Modified responses', () => {
            expect(handler.shouldBufferResponse('GET', 304, 1000, true)).toBe(
                false
            )
        })

        it('should not buffer responses exceeding max size', () => {
            expect(
                handler.shouldBufferResponse('GET', 200, maxBodySize + 1, true)
            ).toBe(false)
        })

        it('should buffer responses without content-length when hooks present', () => {
            expect(
                handler.shouldBufferResponse('GET', 200, undefined, true)
            ).toBe(true)
        })

        it('should handle case-insensitive methods', () => {
            expect(handler.shouldBufferResponse('head', 200, 1000, true)).toBe(
                false
            )
            expect(handler.shouldBufferResponse('get', 200, 1000, true)).toBe(
                true
            )
        })
    })

    describe('bufferRequestBody', () => {
        it('should buffer request body for valid requests', async () => {
            const mockReq = createMockIncomingMessage({
                method: 'POST',
                headers: { 'content-length': '100' },
            })

            const testBuffer = Buffer.from('request body')
            const decodedBuffer = Buffer.from('decoded body')

            mockReadStreamToBuffer.mockResolvedValue(testBuffer)
            mockDecodeBody.mockResolvedValue(decodedBuffer)

            const result = await handler.bufferRequestBody(mockReq)

            expect(result).toBe(decodedBuffer)
            expect(mockReadStreamToBuffer).toHaveBeenCalledWith(
                mockReq,
                100,
                maxBodySize
            )
            expect(mockDecodeBody).toHaveBeenCalledWith(testBuffer, undefined)
        })

        it('should handle content-encoding', async () => {
            const mockReq = createMockIncomingMessage({
                method: 'POST',
                headers: {
                    'content-length': '100',
                    'content-encoding': 'gzip',
                },
            })

            const testBuffer = Buffer.from('compressed body')
            const decodedBuffer = Buffer.from('decompressed body')

            mockReadStreamToBuffer.mockResolvedValue(testBuffer)
            mockDecodeBody.mockResolvedValue(decodedBuffer)

            const result = await handler.bufferRequestBody(mockReq)

            expect(result).toBe(decodedBuffer)
            expect(mockDecodeBody).toHaveBeenCalledWith(testBuffer, 'gzip')
        })

        it('should return undefined for non-bufferable requests', async () => {
            const mockReq = createMockIncomingMessage({
                method: 'GET',
            })

            const result = await handler.bufferRequestBody(mockReq)

            expect(result).toBeUndefined()
            expect(mockReadStreamToBuffer).not.toHaveBeenCalled()
        })

        it('should handle buffering errors gracefully', async () => {
            const consoleWarnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})
            const mockReq = createMockIncomingMessage({
                method: 'POST',
                headers: { 'content-length': '100' },
            })

            mockReadStreamToBuffer.mockRejectedValue(new Error('Stream error'))

            const result = await handler.bufferRequestBody(mockReq)

            expect(result).toBeUndefined()
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Failed to buffer request body:',
                expect.any(Error)
            )

            consoleWarnSpy.mockRestore()
        })

        it('should handle array headers', async () => {
            const mockReq = createMockIncomingMessage({
                method: 'POST',
                headers: {
                    'content-length': '100',
                    'content-encoding': ['gzip', 'deflate'] as any, // Array header
                },
            })

            const testBuffer = Buffer.from('body')
            mockReadStreamToBuffer.mockResolvedValue(testBuffer)
            mockDecodeBody.mockResolvedValue(testBuffer)

            await handler.bufferRequestBody(mockReq)

            expect(mockDecodeBody).toHaveBeenCalledWith(testBuffer, 'gzip')
        })
    })

    describe('bufferResponseBody', () => {
        it('should buffer response body when conditions are met', async () => {
            const mockRes = createMockIncomingMessage({
                headers: { 'content-length': '200' },
            })

            const testBuffer = Buffer.from('response body')
            const decodedBuffer = Buffer.from('decoded response')

            mockReadStreamToBuffer.mockResolvedValue(testBuffer)
            mockDecodeBody.mockResolvedValue(decodedBuffer)

            const result = await handler.bufferResponseBody(
                mockRes,
                'GET',
                200,
                true
            )

            expect(result).toBe(decodedBuffer)
            expect(mockReadStreamToBuffer).toHaveBeenCalledWith(
                mockRes,
                200,
                maxBodySize
            )
        })

        it('should return undefined when response hooks not present', async () => {
            const mockRes = createMockIncomingMessage({
                headers: { 'content-length': '200' },
            })

            const result = await handler.bufferResponseBody(
                mockRes,
                'GET',
                200,
                false
            )

            expect(result).toBeUndefined()
            expect(mockReadStreamToBuffer).not.toHaveBeenCalled()
        })

        it('should handle missing content-length', async () => {
            const mockRes = createMockIncomingMessage({
                headers: {},
            })

            const testBuffer = Buffer.from('response body')
            mockReadStreamToBuffer.mockResolvedValue(testBuffer)
            mockDecodeBody.mockResolvedValue(testBuffer)

            const result = await handler.bufferResponseBody(
                mockRes,
                'GET',
                200,
                true
            )

            expect(result).toBe(testBuffer)
            expect(mockReadStreamToBuffer).toHaveBeenCalledWith(
                mockRes,
                0,
                maxBodySize
            )
        })

        it('should handle buffering errors gracefully', async () => {
            const consoleWarnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})
            const mockRes = createMockIncomingMessage({
                headers: { 'content-length': '200' },
            })

            mockReadStreamToBuffer.mockRejectedValue(new Error('Stream error'))

            const result = await handler.bufferResponseBody(
                mockRes,
                'GET',
                200,
                true
            )

            expect(result).toBeUndefined()
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Failed to buffer response body:',
                expect.any(Error)
            )

            consoleWarnSpy.mockRestore()
        })
    })

    describe('prepareHeadersForBufferedContent', () => {
        it('should update headers for buffered content', () => {
            const headers = {
                'content-type': 'application/json',
                'content-encoding': 'gzip',
                'transfer-encoding': 'chunked',
                'content-length': '100',
            }

            const result = handler.prepareHeadersForBufferedContent(
                headers,
                250
            )

            expect(result).toEqual({
                'content-type': 'application/json',
                'content-length': '250',
                // content-encoding and transfer-encoding should be removed
            })
        })

        it('should preserve other headers', () => {
            const headers = {
                'content-type': 'text/html',
                'cache-control': 'no-cache',
                etag: '"abc123"',
            }

            const result = handler.prepareHeadersForBufferedContent(
                headers,
                150
            )

            expect(result).toEqual({
                'content-type': 'text/html',
                'cache-control': 'no-cache',
                etag: '"abc123"',
                'content-length': '150',
            })
        })

        it('should handle empty headers', () => {
            const result = handler.prepareHeadersForBufferedContent({}, 100)

            expect(result).toEqual({
                'content-length': '100',
            })
        })
    })

    describe('prepareHeadersForStreaming', () => {
        it('should preserve content-length when no transfer-encoding chunked', () => {
            const headers = {
                'content-type': 'application/json',
                'content-length': '100',
                'cache-control': 'no-cache',
            }

            const result = handler.prepareHeadersForStreaming(headers)

            expect(result).toEqual({
                'content-type': 'application/json',
                'content-length': '100',
                'cache-control': 'no-cache',
            })
        })

        it('should remove content-length when transfer-encoding is chunked', () => {
            const headers = {
                'content-type': 'application/json',
                'content-length': '100',
                'transfer-encoding': 'chunked',
                'cache-control': 'no-cache',
            }

            const result = handler.prepareHeadersForStreaming(headers)

            expect(result).toEqual({
                'content-type': 'application/json',
                'transfer-encoding': 'chunked',
                'cache-control': 'no-cache',
                // content-length should be removed due to chunked encoding
            })
        })

        it('should remove content-length when transfer-encoding contains chunked', () => {
            const headers = {
                'content-type': 'application/json',
                'content-length': '100',
                'transfer-encoding': 'gzip, chunked',
                'cache-control': 'no-cache',
            }

            const result = handler.prepareHeadersForStreaming(headers)

            expect(result).toEqual({
                'content-type': 'application/json',
                'transfer-encoding': 'gzip, chunked',
                'cache-control': 'no-cache',
                // content-length should be removed due to chunked encoding
            })
        })

        it('should handle array headers for transfer-encoding', () => {
            const headers = {
                'content-type': 'application/json',
                'content-length': '100',
                'transfer-encoding': ['gzip', 'chunked'],
                'cache-control': 'no-cache',
            }

            const result = handler.prepareHeadersForStreaming(headers)

            expect(result).toEqual({
                'content-type': 'application/json',
                'transfer-encoding': ['gzip', 'chunked'],
                'cache-control': 'no-cache',
                // content-length should be removed due to chunked encoding in array
            })
        })

        it('should preserve other headers', () => {
            const headers = {
                'content-type': 'text/plain',
                'transfer-encoding': 'chunked',
                connection: 'keep-alive',
            }

            const result = handler.prepareHeadersForStreaming(headers)

            expect(result).toEqual({
                'content-type': 'text/plain',
                'transfer-encoding': 'chunked',
                connection: 'keep-alive',
            })
        })

        it('should handle empty headers', () => {
            const result = handler.prepareHeadersForStreaming({})

            expect(result).toEqual({})
        })
    })
})
