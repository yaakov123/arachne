import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { BroadcastService } from '../src/services/broadcast-service'

// Mock WsHub
vi.mock('../src/ws-hub')

describe('BroadcastService', () => {
    let eventEmitter: EventEmitter
    let mockHub: MockedWsHub
    let broadcastService: BroadcastService

    type MockedWsHub = {
        broadcast: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
        eventEmitter = new EventEmitter()
        mockHub = {
            broadcast: vi.fn(),
        }
        broadcastService = new BroadcastService(mockHub as any, eventEmitter)
    })

    describe('initialization', () => {
        it('should initialize without errors', () => {
            expect(broadcastService).toBeDefined()
        })

        it('should register event listeners', () => {
            const listeners = eventEmitter.eventNames()
            expect(listeners).toContain('request')
            expect(listeners).toContain('response')
            expect(listeners).toContain('requestBody')
            expect(listeners).toContain('responseBody')
            expect(listeners).toContain('transactionComplete')
        })
    })

    describe('request event handling', () => {
        it('should broadcast request event', () => {
            const requestEvent = {
                id: 'req_123',
                method: 'GET',
                url: {
                    full: 'http://example.com/api',
                    protocol: 'http:',
                    host: 'example.com',
                    path: '/api',
                },
                headers: [
                    {
                        name: 'content-type',
                        value: 'application/json',
                        sensitive: false,
                    },
                ],
                clientIp: '127.0.0.1',
                timestamp: 1640995200000,
                ts: '2022-01-01T00:00:00.000Z',
                repeaterMeta: { source: 'proxy' },
            }

            eventEmitter.emit('request', requestEvent)

            expect(mockHub.broadcast).toHaveBeenCalledWith({
                type: 'request',
                ...requestEvent,
            })
        })
    })

    describe('response event handling', () => {
        it('should broadcast response event', () => {
            const responseEvent = {
                id: 'req_123',
                statusCode: 200,
                statusMessage: 'OK',
                headers: [
                    {
                        name: 'content-type',
                        value: 'application/json',
                        sensitive: false,
                    },
                ],
                timing: {
                    startTime: 1640995200000,
                    responseTime: 1640995200500,
                    duration: 500,
                },
                ts: '2022-01-01T00:00:00.500Z',
            }

            eventEmitter.emit('response', responseEvent)

            expect(mockHub.broadcast).toHaveBeenCalledWith({
                type: 'responseHead',
                ...responseEvent,
            })
        })
    })

    describe('requestBody event handling', () => {
        it('should broadcast requestBody event', () => {
            const requestBodyEvent = {
                id: 'req_123',
                content: {
                    contentType: 'application/json',
                    size: 25,
                    sampleSize: 25,
                    truncated: false,
                    detectedFormat: 'json',
                    encoding: 'utf8',
                    isCompressed: false,
                },
                sample: '{"message": "hello"}',
                ts: '2022-01-01T00:00:00.100Z',
            }

            eventEmitter.emit('requestBody', requestBodyEvent)

            expect(mockHub.broadcast).toHaveBeenCalledWith({
                type: 'requestBody',
                ...requestBodyEvent,
            })
        })
    })

    describe('responseBody event handling', () => {
        it('should broadcast responseBody event', () => {
            const responseBodyEvent = {
                id: 'req_123',
                content: {
                    contentType: 'application/json',
                    size: 30,
                    sampleSize: 30,
                    truncated: false,
                    detectedFormat: 'json',
                    encoding: 'utf8',
                    isCompressed: false,
                },
                sample: '{"result": "success"}',
                ts: '2022-01-01T00:00:00.600Z',
            }

            eventEmitter.emit('responseBody', responseBodyEvent)

            expect(mockHub.broadcast).toHaveBeenCalledWith({
                type: 'responseBody',
                ...responseBodyEvent,
            })
        })
    })

    describe('transactionComplete event handling', () => {
        it('should broadcast transactionComplete event', () => {
            const transactionCompleteEvent = {
                type: 'transactionComplete',
                id: 'req_123',
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
                        headers: [
                            {
                                name: 'content-type',
                                value: 'application/json',
                                sensitive: false,
                            },
                        ],
                        rawHeaders: { 'content-type': 'application/json' },
                        clientIp: '127.0.0.1',
                        body: {
                            content: {
                                contentType: 'application/json',
                                size: 25,
                                detectedFormat: 'json',
                            },
                            sample: '{"name": "John Doe"}',
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
                                size: 20,
                                detectedFormat: 'json',
                            },
                            sample: '{"id": 123}',
                        },
                    },
                    timing: {
                        startTime: 1640995200000,
                        responseTime: 1640995201000,
                        duration: 1000,
                    },
                    summary: {
                        requestSize: 25,
                        responseSize: 20,
                        hasRequestBody: true,
                        hasResponseBody: true,
                    },
                    repeater: { source: 'proxy' },
                },
            }

            eventEmitter.emit('transactionComplete', transactionCompleteEvent)

            expect(mockHub.broadcast).toHaveBeenCalledWith(
                transactionCompleteEvent
            )
        })
    })

    describe('multiple events', () => {
        it('should handle multiple events in sequence', () => {
            const events = [
                {
                    type: 'request',
                    data: {
                        id: 'req_1',
                        method: 'GET',
                        url: { full: 'http://example.com/api' },
                        headers: [],
                        timestamp: Date.now(),
                        ts: new Date().toISOString(),
                    },
                },
                {
                    type: 'response',
                    data: {
                        id: 'req_1',
                        statusCode: 200,
                        headers: [],
                        timing: {
                            startTime: Date.now(),
                            responseTime: Date.now(),
                            duration: 100,
                        },
                        ts: new Date().toISOString(),
                    },
                },
            ]

            events.forEach((event) => {
                eventEmitter.emit(event.type, event.data)
            })

            expect(mockHub.broadcast).toHaveBeenCalledTimes(2)
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(1, {
                type: 'request',
                ...events[0].data,
            })
            expect(mockHub.broadcast).toHaveBeenNthCalledWith(2, {
                type: 'responseHead',
                ...events[1].data,
            })
        })
    })

    describe('error handling', () => {
        it('should handle hub broadcast errors gracefully', () => {
            mockHub.broadcast.mockImplementation(() => {
                throw new Error('Broadcast failed')
            })

            const requestEvent = {
                id: 'req_error',
                method: 'GET',
                url: { full: 'http://example.com/api' },
                headers: [],
                timestamp: Date.now(),
                ts: new Date().toISOString(),
            }

            // Should not throw
            expect(() => {
                eventEmitter.emit('request', requestEvent)
            }).not.toThrow()
        })

        it('should continue working after broadcast errors', () => {
            // First call fails
            mockHub.broadcast.mockImplementationOnce(() => {
                throw new Error('Temporary failure')
            })

            const requestEvent1 = {
                id: 'req_1',
                method: 'GET',
                url: { full: 'http://example.com/api' },
                headers: [],
                timestamp: Date.now(),
                ts: new Date().toISOString(),
            }

            const requestEvent2 = {
                id: 'req_2',
                method: 'POST',
                url: { full: 'http://example.com/api' },
                headers: [],
                timestamp: Date.now(),
                ts: new Date().toISOString(),
            }

            // First emit should fail but not throw
            eventEmitter.emit('request', requestEvent1)

            // Second emit should work
            eventEmitter.emit('request', requestEvent2)

            expect(mockHub.broadcast).toHaveBeenCalledTimes(2)
            expect(mockHub.broadcast).toHaveBeenLastCalledWith({
                type: 'request',
                ...requestEvent2,
            })
        })
    })

    describe('cleanup', () => {
        it('should provide cleanup method', () => {
            expect(typeof broadcastService.cleanup).toBe('function')
        })

        it('should remove all event listeners on cleanup', () => {
            broadcastService.cleanup()

            const listeners =
                eventEmitter.listenerCount('request') +
                eventEmitter.listenerCount('response') +
                eventEmitter.listenerCount('requestBody') +
                eventEmitter.listenerCount('responseBody') +
                eventEmitter.listenerCount('transactionComplete')

            expect(listeners).toBe(0)
        })

        it('should not broadcast events after cleanup', () => {
            broadcastService.cleanup()

            const requestEvent = {
                id: 'req_after_cleanup',
                method: 'GET',
                url: { full: 'http://example.com/api' },
                headers: [],
                timestamp: Date.now(),
                ts: new Date().toISOString(),
            }

            eventEmitter.emit('request', requestEvent)

            expect(mockHub.broadcast).not.toHaveBeenCalled()
        })
    })
})
