import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { StorageService } from '../src/services/storage-service'
import type { TransactionCompleteEvent } from '@arachne/api-types'

// Mock ProjectService
const mockProjectService = {
    addTransactionToCurrentProject: vi.fn(),
}

describe('StorageService', () => {
    let eventEmitter: EventEmitter
    let storageService: StorageService

    beforeEach(() => {
        eventEmitter = new EventEmitter()
        mockProjectService.addTransactionToCurrentProject.mockReset()
        storageService = new StorageService(
            mockProjectService as any,
            eventEmitter
        )
    })

    describe('initialization', () => {
        it('should initialize without errors', () => {
            expect(storageService).toBeDefined()
        })

        it('should register transactionComplete event listener', () => {
            const listeners = eventEmitter.listenerCount('transactionComplete')
            expect(listeners).toBe(1)
        })

        it('should not register other event listeners', () => {
            const requestListeners = eventEmitter.listenerCount('request')
            const responseListeners = eventEmitter.listenerCount('response')
            const requestBodyListeners =
                eventEmitter.listenerCount('requestBody')
            const responseBodyListeners =
                eventEmitter.listenerCount('responseBody')

            expect(requestListeners).toBe(0)
            expect(responseListeners).toBe(0)
            expect(requestBodyListeners).toBe(0)
            expect(responseBodyListeners).toBe(0)
        })
    })

    describe('transactionComplete event handling', () => {
        it('should store transaction when transactionComplete event is emitted', async () => {
            const transactionEvent: TransactionCompleteEvent = {
                type: 'transactionComplete',
                id: 'req_123',
                ts: '2022-01-01T00:00:00.000Z',
                transaction: {
                    request: {
                        method: 'GET',
                        url: {
                            full: 'http://example.com/api',
                            protocol: 'http:',
                            host: 'example.com',
                            path: '/api',
                        },
                        headers: [
                            {
                                name: 'user-agent',
                                value: 'Mozilla/5.0',
                                sensitive: false,
                            },
                        ],
                        rawHeaders: { 'user-agent': 'Mozilla/5.0' },
                        clientIp: '127.0.0.1',
                    },
                    response: {
                        statusCode: 200,
                        statusMessage: 'OK',
                        headers: [
                            {
                                name: 'content-type',
                                value: 'application/json',
                                sensitive: false,
                            },
                        ],
                        rawHeaders: { 'content-type': 'application/json' },
                    },
                    timing: {
                        startTime: 1640995200000,
                        responseTime: 1640995200500,
                        duration: 500,
                    },
                    summary: {
                        requestSize: 0,
                        responseSize: 25,
                        hasRequestBody: false,
                        hasResponseBody: true,
                    },
                    repeater: { source: 'proxy' },
                },
            }

            mockProjectService.addTransactionToCurrentProject.mockResolvedValue(
                undefined
            )

            eventEmitter.emit('transactionComplete', transactionEvent)

            // Give async operation time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledWith(transactionEvent)
        })

        it('should handle storage errors gracefully', async () => {
            const transactionEvent: TransactionCompleteEvent = {
                type: 'transactionComplete',
                id: 'req_error',
                ts: '2022-01-01T00:00:00.000Z',
                transaction: {
                    request: {
                        method: 'GET',
                        url: {
                            full: 'http://example.com/api',
                            protocol: 'http:',
                            host: 'example.com',
                            path: '/api',
                        },
                        headers: [],
                        rawHeaders: {},
                        clientIp: '127.0.0.1',
                    },
                    response: {
                        statusCode: 500,
                        statusMessage: 'Internal Server Error',
                        headers: [],
                        rawHeaders: {},
                    },
                    timing: {
                        startTime: 1640995200000,
                        responseTime: 1640995200500,
                        duration: 500,
                    },
                    summary: {
                        requestSize: 0,
                        responseSize: 0,
                        hasRequestBody: false,
                        hasResponseBody: false,
                    },
                    repeater: { source: 'proxy' },
                },
            }

            const storageError = new Error('Database connection failed')
            mockProjectService.addTransactionToCurrentProject.mockRejectedValue(
                storageError
            )

            // Should not throw error
            expect(() => {
                eventEmitter.emit('transactionComplete', transactionEvent)
            }).not.toThrow()

            // Give async operation time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledWith(transactionEvent)
        })

        it('should continue working after storage errors', async () => {
            const transactionEvent1: TransactionCompleteEvent = {
                type: 'transactionComplete',
                id: 'req_1',
                ts: '2022-01-01T00:00:00.000Z',
                transaction: {
                    request: {
                        method: 'GET',
                        url: {
                            full: 'http://example.com/api',
                            protocol: 'http:',
                            host: 'example.com',
                            path: '/api',
                        },
                        headers: [],
                        rawHeaders: {},
                        clientIp: '127.0.0.1',
                    },
                    response: {
                        statusCode: 200,
                        statusMessage: 'OK',
                        headers: [],
                        rawHeaders: {},
                    },
                    timing: {
                        startTime: 1640995200000,
                        responseTime: 1640995200500,
                        duration: 500,
                    },
                    summary: {
                        requestSize: 0,
                        responseSize: 0,
                        hasRequestBody: false,
                        hasResponseBody: false,
                    },
                    repeater: { source: 'proxy' },
                },
            }

            const transactionEvent2: TransactionCompleteEvent = {
                ...transactionEvent1,
                id: 'req_2',
                ts: '2022-01-01T00:00:01.000Z',
            }

            // First call fails
            mockProjectService.addTransactionToCurrentProject.mockRejectedValueOnce(
                new Error('Temporary failure')
            )
            // Second call succeeds
            mockProjectService.addTransactionToCurrentProject.mockResolvedValueOnce(
                undefined
            )

            eventEmitter.emit('transactionComplete', transactionEvent1)
            eventEmitter.emit('transactionComplete', transactionEvent2)

            // Give async operations time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledTimes(2)
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenNthCalledWith(1, transactionEvent1)
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenNthCalledWith(2, transactionEvent2)
        })
    })

    describe('multiple transactions', () => {
        it('should handle multiple transaction events in sequence', async () => {
            const transactions: TransactionCompleteEvent[] = [
                {
                    type: 'transactionComplete',
                    id: 'req_1',
                    ts: '2022-01-01T00:00:00.000Z',
                    transaction: {
                        request: {
                            method: 'GET',
                            url: {
                                full: 'http://example.com/api/users',
                                protocol: 'http:',
                                host: 'example.com',
                                path: '/api/users',
                            },
                            headers: [],
                            rawHeaders: {},
                            clientIp: '127.0.0.1',
                        },
                        response: {
                            statusCode: 200,
                            statusMessage: 'OK',
                            headers: [],
                            rawHeaders: {},
                        },
                        timing: {
                            startTime: 1640995200000,
                            responseTime: 1640995200500,
                            duration: 500,
                        },
                        summary: {
                            requestSize: 0,
                            responseSize: 100,
                            hasRequestBody: false,
                            hasResponseBody: true,
                        },
                        repeater: { source: 'proxy' },
                    },
                },
                {
                    type: 'transactionComplete',
                    id: 'req_2',
                    ts: '2022-01-01T00:00:01.000Z',
                    transaction: {
                        request: {
                            method: 'POST',
                            url: {
                                full: 'http://example.com/api/users',
                                protocol: 'http:',
                                host: 'example.com',
                                path: '/api/users',
                            },
                            headers: [],
                            rawHeaders: {},
                            clientIp: '127.0.0.1',
                        },
                        response: {
                            statusCode: 201,
                            statusMessage: 'Created',
                            headers: [],
                            rawHeaders: {},
                        },
                        timing: {
                            startTime: 1640995201000,
                            responseTime: 1640995201200,
                            duration: 200,
                        },
                        summary: {
                            requestSize: 50,
                            responseSize: 30,
                            hasRequestBody: true,
                            hasResponseBody: true,
                        },
                        repeater: { source: 'proxy' },
                    },
                },
            ]

            mockProjectService.addTransactionToCurrentProject.mockResolvedValue(
                undefined
            )

            transactions.forEach((transaction) => {
                eventEmitter.emit('transactionComplete', transaction)
            })

            // Give async operations time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledTimes(2)
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenNthCalledWith(1, transactions[0])
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenNthCalledWith(2, transactions[1])
        })

        it('should handle rapid transaction events', async () => {
            const transactionCount = 10
            const transactions: TransactionCompleteEvent[] = Array.from(
                { length: transactionCount },
                (_, i) => ({
                    type: 'transactionComplete',
                    id: `req_${i}`,
                    ts: new Date(1640995200000 + i * 1000).toISOString(),
                    transaction: {
                        request: {
                            method: 'GET',
                            url: {
                                full: `http://example.com/api/item/${i}`,
                                protocol: 'http:',
                                host: 'example.com',
                                path: `/api/item/${i}`,
                            },
                            headers: [],
                            rawHeaders: {},
                            clientIp: '127.0.0.1',
                        },
                        response: {
                            statusCode: 200,
                            statusMessage: 'OK',
                            headers: [],
                            rawHeaders: {},
                        },
                        timing: {
                            startTime: 1640995200000 + i * 1000,
                            responseTime: 1640995200500 + i * 1000,
                            duration: 500,
                        },
                        summary: {
                            requestSize: 0,
                            responseSize: 20,
                            hasRequestBody: false,
                            hasResponseBody: true,
                        },
                        repeater: { source: 'proxy' },
                    },
                })
            )

            mockProjectService.addTransactionToCurrentProject.mockResolvedValue(
                undefined
            )

            // Emit all transactions rapidly
            transactions.forEach((transaction) => {
                eventEmitter.emit('transactionComplete', transaction)
            })

            // Give async operations time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledTimes(transactionCount)
            transactions.forEach((transaction, index) => {
                expect(
                    mockProjectService.addTransactionToCurrentProject
                ).toHaveBeenNthCalledWith(index + 1, transaction)
            })
        })
    })

    describe('cleanup', () => {
        it('should provide cleanup method', () => {
            expect(typeof storageService.cleanup).toBe('function')
        })

        it('should remove event listeners on cleanup', () => {
            storageService.cleanup()

            const listeners = eventEmitter.listenerCount('transactionComplete')
            expect(listeners).toBe(0)
        })

        it('should not store transactions after cleanup', async () => {
            storageService.cleanup()

            const transactionEvent: TransactionCompleteEvent = {
                type: 'transactionComplete',
                id: 'req_after_cleanup',
                ts: '2022-01-01T00:00:00.000Z',
                transaction: {
                    request: {
                        method: 'GET',
                        url: {
                            full: 'http://example.com/api',
                            protocol: 'http:',
                            host: 'example.com',
                            path: '/api',
                        },
                        headers: [],
                        rawHeaders: {},
                        clientIp: '127.0.0.1',
                    },
                    response: {
                        statusCode: 200,
                        statusMessage: 'OK',
                        headers: [],
                        rawHeaders: {},
                    },
                    timing: {
                        startTime: 1640995200000,
                        responseTime: 1640995200500,
                        duration: 500,
                    },
                    summary: {
                        requestSize: 0,
                        responseSize: 0,
                        hasRequestBody: false,
                        hasResponseBody: false,
                    },
                    repeater: { source: 'proxy' },
                },
            }

            eventEmitter.emit('transactionComplete', transactionEvent)

            // Give async operation time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).not.toHaveBeenCalled()
        })
    })

    describe('integration scenarios', () => {
        it('should handle transactions with large bodies', async () => {
            const transactionEvent: TransactionCompleteEvent = {
                type: 'transactionComplete',
                id: 'req_large',
                ts: '2022-01-01T00:00:00.000Z',
                transaction: {
                    request: {
                        method: 'POST',
                        url: {
                            full: 'http://example.com/api/upload',
                            protocol: 'http:',
                            host: 'example.com',
                            path: '/api/upload',
                        },
                        headers: [
                            {
                                name: 'content-type',
                                value: 'multipart/form-data',
                                sensitive: false,
                            },
                        ],
                        rawHeaders: { 'content-type': 'multipart/form-data' },
                        clientIp: '127.0.0.1',
                        body: {
                            content: {
                                contentType: 'multipart/form-data',
                                size: 10000000, // 10MB
                                sampleSize: 1000000, // 1MB sample
                                truncated: true,
                                detectedFormat: 'form',
                                encoding: 'base64',
                                isCompressed: false,
                            },
                            sample: 'base64:SGVsbG8gV29ybGQ=',
                        },
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
                        body: {
                            content: {
                                contentType: 'application/json',
                                size: 100,
                                sampleSize: 100,
                                truncated: false,
                                detectedFormat: 'json',
                                encoding: 'utf8',
                                isCompressed: false,
                            },
                            sample: '{"id": "uploaded_123", "status": "success"}',
                        },
                    },
                    timing: {
                        startTime: 1640995200000,
                        responseTime: 1640995205000,
                        duration: 5000,
                    },
                    summary: {
                        requestSize: 10000000,
                        responseSize: 100,
                        hasRequestBody: true,
                        hasResponseBody: true,
                    },
                    repeater: { source: 'proxy' },
                },
            }

            mockProjectService.addTransactionToCurrentProject.mockResolvedValue(
                undefined
            )

            eventEmitter.emit('transactionComplete', transactionEvent)

            // Give async operation time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledWith(transactionEvent)
        })

        it('should handle repeater transactions', async () => {
            const transactionEvent: TransactionCompleteEvent = {
                type: 'transactionComplete',
                id: 'req_repeat',
                ts: '2022-01-01T00:00:00.000Z',
                transaction: {
                    request: {
                        method: 'GET',
                        url: {
                            full: 'http://example.com/api/repeat',
                            protocol: 'http:',
                            host: 'example.com',
                            path: '/api/repeat',
                        },
                        headers: [],
                        rawHeaders: {},
                        clientIp: '127.0.0.1',
                    },
                    response: {
                        statusCode: 200,
                        statusMessage: 'OK',
                        headers: [],
                        rawHeaders: {},
                    },
                    timing: {
                        startTime: 1640995200000,
                        responseTime: 1640995200300,
                        duration: 300,
                    },
                    summary: {
                        requestSize: 0,
                        responseSize: 50,
                        hasRequestBody: false,
                        hasResponseBody: true,
                    },
                    repeater: {
                        source: 'repeater',
                        originalTransactionId: 'req_original_123',
                        repeatedAt: '2022-01-01T00:00:00.000Z',
                    },
                },
            }

            mockProjectService.addTransactionToCurrentProject.mockResolvedValue(
                undefined
            )

            eventEmitter.emit('transactionComplete', transactionEvent)

            // Give async operation time to complete
            await new Promise((resolve) => globalThis.setImmediate(resolve))

            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledWith(transactionEvent)
        })
    })
})
