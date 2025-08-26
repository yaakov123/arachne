import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { createTransactionAggregatorPlugin } from '../src/plugins/transaction-aggregator-plugin'
import { BroadcastService } from '../src/services/broadcast-service'
import { StorageService } from '../src/services/storage-service'
import type { RequestContext, ResponseContext } from '@arachne/proxy'

// Mock dependencies
const mockHub = {
    broadcast: vi.fn(),
}

const mockProjectService = {
    addTransactionToCurrentProject: vi.fn(),
}

describe('Event-Driven Architecture Integration', () => {
    let eventEmitter: EventEmitter
    let transactionPlugin: ReturnType<typeof createTransactionAggregatorPlugin>
    let broadcastService: BroadcastService
    let storageService: StorageService

    beforeEach(() => {
        eventEmitter = new EventEmitter()

        // Create the plugin and services
        transactionPlugin = createTransactionAggregatorPlugin(eventEmitter)
        broadcastService = new BroadcastService(mockHub as any, eventEmitter)
        storageService = new StorageService(
            mockProjectService as any,
            eventEmitter
        )

        // Reset mocks
        mockHub.broadcast.mockReset()
        mockProjectService.addTransactionToCurrentProject.mockReset()
        mockProjectService.addTransactionToCurrentProject.mockResolvedValue(
            undefined
        )
    })

    afterEach(() => {
        broadcastService.cleanup()
        storageService.cleanup()
    })

    describe('Full Transaction Flow', () => {
        it('should handle complete request-response cycle with event-driven architecture', async () => {
            // Simulate a complete HTTP transaction
            const requestCtx: RequestContext = {
                id: 'req_integration_test',
                isHttps: false,
                url: new URL('http://example.com/api/users'),
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: 'Bearer token123',
                },
                clientIp: '192.168.1.100',
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api/users',
                    method: 'POST',
                    headers: {},
                },
            }

            const responseCtx: ResponseContext = {
                ...requestCtx,
                statusCode: 201,
                statusMessage: 'Created',
                responseHeaders: {
                    'content-type': 'application/json',
                    location: '/api/users/123',
                },
            }

            const requestBodyCtx = {
                ...requestCtx,
                body: Buffer.from(
                    '{"name": "John Doe", "email": "john@example.com"}'
                ),
                contentType: 'application/json',
                contentEncoding: undefined,
                setBody: vi.fn(),
            }

            const responseBodyCtx = {
                ...responseCtx,
                body: Buffer.from('{"id": 123, "name": "John Doe"}'),
                contentType: 'application/json',
                contentEncoding: undefined,
                setBody: vi.fn(),
            }

            // Execute the complete flow through the plugin
            await transactionPlugin.onRequest!(requestCtx)
            await transactionPlugin.onRequestBody!(requestBodyCtx)
            await transactionPlugin.onResponse!(responseCtx)
            await transactionPlugin.onResponseBody!(responseBodyCtx)
            await transactionPlugin.onResponseComplete!(responseCtx)

            // Give async operations time to complete
            await new Promise((resolve) => setTimeout(resolve, 0))

            // Verify broadcasting was called for all events
            expect(mockHub.broadcast).toHaveBeenCalledTimes(5)

            // Verify request event was broadcast
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    type: 'request',
                    id: 'req_integration_test',
                    method: 'POST',
                    url: expect.objectContaining({
                        full: 'http://example.com/api/users',
                        protocol: 'http:',
                        host: 'example.com',
                        path: '/api/users',
                    }),
                    headers: expect.arrayContaining([
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
                    ]),
                    clientIp: '192.168.1.100',
                })
            )

            // Verify request body event was broadcast
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    type: 'requestBody',
                    id: 'req_integration_test',
                    content: expect.objectContaining({
                        contentType: 'application/json',
                        detectedFormat: 'json',
                        encoding: 'utf8',
                    }),
                    sample: '{"name": "John Doe", "email": "john@example.com"}',
                })
            )

            // Verify response event was broadcast
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({
                    type: 'responseHead',
                    id: 'req_integration_test',
                    statusCode: 201,
                    statusMessage: 'Created',
                    headers: expect.arrayContaining([
                        {
                            name: 'content-type',
                            value: 'application/json',
                            sensitive: false,
                        },
                        {
                            name: 'location',
                            value: '/api/users/123',
                            sensitive: false,
                        },
                    ]),
                })
            )

            // Verify response body event was broadcast
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(
                4,
                expect.objectContaining({
                    type: 'responseBody',
                    id: 'req_integration_test',
                    content: expect.objectContaining({
                        contentType: 'application/json',
                        detectedFormat: 'json',
                    }),
                    sample: '{"id": 123, "name": "John Doe"}',
                })
            )

            // Verify transaction complete event was broadcast
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(
                5,
                expect.objectContaining({
                    type: 'transactionComplete',
                    id: 'req_integration_test',
                    transaction: expect.objectContaining({
                        request: expect.objectContaining({
                            method: 'POST',
                            url: expect.objectContaining({
                                full: 'http://example.com/api/users',
                            }),
                            body: expect.objectContaining({
                                sample: '{"name": "John Doe", "email": "john@example.com"}',
                            }),
                        }),
                        response: expect.objectContaining({
                            statusCode: 201,
                            statusMessage: 'Created',
                            body: expect.objectContaining({
                                sample: '{"id": 123, "name": "John Doe"}',
                            }),
                        }),
                        timing: expect.objectContaining({
                            duration: expect.any(Number),
                        }),
                        summary: expect.objectContaining({
                            hasRequestBody: true,
                            hasResponseBody: true,
                        }),
                    }),
                })
            )

            // Verify storage was called
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledOnce()
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'transactionComplete',
                    id: 'req_integration_test',
                })
            )
        })

        it('should handle multiple concurrent transactions', async () => {
            const transactions = [
                {
                    id: 'req_1',
                    method: 'GET',
                    path: '/api/users/1',
                },
                {
                    id: 'req_2',
                    method: 'GET',
                    path: '/api/users/2',
                },
                {
                    id: 'req_3',
                    method: 'POST',
                    path: '/api/users',
                },
            ]

            const promises = transactions.map(async (tx) => {
                const requestCtx: RequestContext = {
                    id: tx.id,
                    isHttps: false,
                    url: new URL(`http://example.com${tx.path}`),
                    method: tx.method,
                    headers: { 'content-type': 'application/json' },
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: tx.path,
                        method: tx.method,
                        headers: {},
                    },
                }

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: tx.method === 'POST' ? 201 : 200,
                    statusMessage: tx.method === 'POST' ? 'Created' : 'OK',
                    responseHeaders: { 'content-type': 'application/json' },
                }

                // Execute transaction flow
                await transactionPlugin.onRequest!(requestCtx)
                await transactionPlugin.onResponse!(responseCtx)
                await transactionPlugin.onResponseComplete!(responseCtx)
            })

            await Promise.all(promises)

            // Give async operations time to complete
            await new Promise((resolve) => setTimeout(resolve, 0))

            // Should have broadcast events for all transactions
            // Each transaction: request + response + transactionComplete = 3 events per transaction
            expect(mockHub.broadcast).toHaveBeenCalledTimes(9)

            // Should have stored all transactions
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledTimes(3)

            // Verify each transaction was stored
            transactions.forEach((tx, index) => {
                expect(
                    mockProjectService.addTransactionToCurrentProject
                ).toHaveBeenNthCalledWith(
                    index + 1,
                    expect.objectContaining({
                        type: 'transactionComplete',
                        id: tx.id,
                    })
                )
            })
        })

        it('should handle errors gracefully without disrupting other transactions', async () => {
            // Set up storage to fail for specific transaction
            mockProjectService.addTransactionToCurrentProject.mockImplementation(
                async (event) => {
                    if (event.id === 'req_fail') {
                        throw new Error('Storage failed')
                    }
                    return undefined
                }
            )

            // Set up broadcast to fail for specific transaction
            mockHub.broadcast.mockImplementation((event) => {
                if (event.id === 'req_broadcast_fail') {
                    throw new Error('Broadcast failed')
                }
            })

            const transactions = [
                { id: 'req_success', shouldSucceed: true },
                { id: 'req_fail', shouldSucceed: false }, // Storage will fail
                { id: 'req_broadcast_fail', shouldSucceed: true }, // Broadcast will fail but storage should work
                { id: 'req_success_2', shouldSucceed: true },
            ]

            const promises = transactions.map(async (tx) => {
                const requestCtx: RequestContext = {
                    id: tx.id,
                    isHttps: false,
                    url: new URL('http://example.com/api/test'),
                    method: 'GET',
                    headers: {},
                    requestOptions: {
                        protocol: 'http:',
                        hostname: 'example.com',
                        port: 80,
                        path: '/api/test',
                        method: 'GET',
                        headers: {},
                    },
                }

                const responseCtx: ResponseContext = {
                    ...requestCtx,
                    statusCode: 200,
                    statusMessage: 'OK',
                    responseHeaders: {},
                }

                // This should not throw even if individual services fail
                await transactionPlugin.onRequest!(requestCtx)
                await transactionPlugin.onResponse!(responseCtx)
                await transactionPlugin.onResponseComplete!(responseCtx)
            })

            await Promise.all(promises)

            // Give async operations time to complete
            await new Promise((resolve) => setTimeout(resolve, 0))

            // All transactions should have been processed
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledTimes(4)

            // Verify successful transactions were stored
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'req_success' })
            )
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'req_success_2' })
            )
        })
    })

    describe('Event Isolation', () => {
        it('should ensure services only receive events they care about', async () => {
            const requestCtx: RequestContext = {
                id: 'req_isolation_test',
                isHttps: false,
                url: new URL('http://example.com/api/test'),
                method: 'GET',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api/test',
                    method: 'GET',
                    headers: {},
                },
            }

            const responseCtx: ResponseContext = {
                ...requestCtx,
                statusCode: 200,
                statusMessage: 'OK',
                responseHeaders: {},
            }

            // Execute only partial flow
            await transactionPlugin.onRequest!(requestCtx)
            await transactionPlugin.onResponse!(responseCtx)
            // Note: NOT calling onResponseComplete

            // Give async operations time to complete
            await new Promise((resolve) => setTimeout(resolve, 0))

            // BroadcastService should have received request and response events
            expect(mockHub.broadcast).toHaveBeenCalledTimes(2)
            expect(mockHub.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'request',
                    id: 'req_isolation_test',
                })
            )
            expect(mockHub.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'responseHead',
                    id: 'req_isolation_test',
                })
            )

            // StorageService should NOT have been called (no transactionComplete event)
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).not.toHaveBeenCalled()
        })
    })

    describe('Cleanup', () => {
        it('should properly clean up all services', () => {
            // Verify services have listeners before cleanup
            expect(eventEmitter.listenerCount('request')).toBeGreaterThan(0)
            expect(eventEmitter.listenerCount('response')).toBeGreaterThan(0)
            expect(
                eventEmitter.listenerCount('transactionComplete')
            ).toBeGreaterThan(0)

            // Cleanup services
            broadcastService.cleanup()
            storageService.cleanup()

            // Verify all listeners are removed
            expect(eventEmitter.listenerCount('request')).toBe(0)
            expect(eventEmitter.listenerCount('response')).toBe(0)
            expect(eventEmitter.listenerCount('requestBody')).toBe(0)
            expect(eventEmitter.listenerCount('responseBody')).toBe(0)
            expect(eventEmitter.listenerCount('transactionComplete')).toBe(0)

            // Verify no events are processed after cleanup
            const requestCtx: RequestContext = {
                id: 'req_after_cleanup',
                isHttps: false,
                url: new URL('http://example.com/api/test'),
                method: 'GET',
                headers: {},
                requestOptions: {
                    protocol: 'http:',
                    hostname: 'example.com',
                    port: 80,
                    path: '/api/test',
                    method: 'GET',
                    headers: {},
                },
            }

            transactionPlugin.onRequest!(requestCtx)

            expect(mockHub.broadcast).not.toHaveBeenCalled()
            expect(
                mockProjectService.addTransactionToCurrentProject
            ).not.toHaveBeenCalled()
        })
    })
})
