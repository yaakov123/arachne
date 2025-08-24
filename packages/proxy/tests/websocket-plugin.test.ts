import { describe, it, expect, beforeEach } from 'vitest'
import { WebSocketHandler } from '../src/websocket/handler.js'
import { PluginManager } from '../src/proxy/plugin-manager.js'
import type { 
    WebSocketUpgradeContext, 
    WebSocketMessageContext, 
    WebSocketCloseContext,
    ProxyPlugin 
} from '../src/plugins/types.js'
import { 
    isWebSocketUpgrade,
    extractWebSocketProtocols,
    extractWebSocketExtensions,
    generateConnectionId,
    buildUpstreamWebSocketUrl
} from '../src/websocket/utils.js'
import type { IncomingMessage } from 'node:http'

// Test data based on Postman Echo WebSocket service
const POSTMAN_WS_URL = 'wss://ws.postman-echo.com/raw'

describe('WebSocket Plugin System Tests', () => {
    let pluginManager: PluginManager
    let webSocketHandler: WebSocketHandler
    let capturedEvents: Array<{
        type: string
        context: any
        timestamp: number
    }>

    // Mock plugin that captures all WebSocket events
    const mockPlugin: ProxyPlugin = {
        name: 'test-websocket-plugin',
        
        async onWebSocketUpgrade(ctx: WebSocketUpgradeContext) {
            capturedEvents.push({
                type: 'upgrade',
                context: {
                    id: ctx.id,
                    url: ctx.url.toString(),
                    protocols: ctx.protocols,
                    isHttps: ctx.isHttps,
                    method: ctx.method,
                    headers: ctx.headers
                },
                timestamp: Date.now()
            })
        },

        async onWebSocketMessage(ctx: WebSocketMessageContext) {
            capturedEvents.push({
                type: 'message',
                context: {
                    connectionId: ctx.connectionId,
                    direction: ctx.direction,
                    messageType: ctx.messageType,
                    payloadSize: ctx.payload.length,
                    textContent: ctx.textContent,
                    timestamp: ctx.timestamp
                },
                timestamp: Date.now()
            })
        },

        async onWebSocketClose(ctx: WebSocketCloseContext) {
            capturedEvents.push({
                type: 'close',
                context: {
                    connectionId: ctx.connectionId,
                    code: ctx.code,
                    reason: ctx.reason,
                    timestamp: ctx.timestamp
                },
                timestamp: Date.now()
            })
        },

        onError(err: unknown, ctx: any) {
            capturedEvents.push({
                type: 'error',
                context: {
                    error: err instanceof Error ? err.message : String(err),
                    contextId: ctx.id
                },
                timestamp: Date.now()
            })
        }
    }

    beforeEach(() => {
        capturedEvents = []
        pluginManager = new PluginManager([mockPlugin])
        webSocketHandler = new WebSocketHandler(
            pluginManager,
            (err, ctx) => {
                capturedEvents.push({
                    type: 'handler-error',
                    context: { error: err, ctx },
                    timestamp: Date.now()
                })
            },
            { ignoredHosts: [] }
        )
    })

    describe('WebSocket Utility Functions', () => {
        it('should detect WebSocket upgrade requests correctly', () => {
            const validUpgradeRequest: Partial<IncomingMessage> = {
                method: 'GET',
                headers: {
                    'upgrade': 'websocket',
                    'connection': 'upgrade',
                    'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
                    'sec-websocket-version': '13'
                }
            }

            expect(isWebSocketUpgrade(validUpgradeRequest as IncomingMessage)).toBe(true)

            const invalidUpgradeRequest: Partial<IncomingMessage> = {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                }
            }

            expect(isWebSocketUpgrade(invalidUpgradeRequest as IncomingMessage)).toBe(false)
        })

        it('should extract WebSocket protocols correctly', () => {
            const request: Partial<IncomingMessage> = {
                headers: {
                    'sec-websocket-protocol': 'chat, superchat'
                }
            }

            const protocols = extractWebSocketProtocols(request as IncomingMessage)
            expect(protocols).toEqual(['chat', 'superchat'])
        })

        it('should extract WebSocket extensions correctly', () => {
            const request: Partial<IncomingMessage> = {
                headers: {
                    'sec-websocket-extensions': 'permessage-deflate; client_max_window_bits'
                }
            }

            const extensions = extractWebSocketExtensions(request as IncomingMessage)
            expect(extensions).toEqual(['permessage-deflate; client_max_window_bits'])
        })

        it('should generate unique connection IDs', () => {
            const id1 = generateConnectionId()
            const id2 = generateConnectionId()
            
            expect(id1).toMatch(/^ws_\d+_[a-z0-9]{9}$/)
            expect(id2).toMatch(/^ws_\d+_[a-z0-9]{9}$/)
            expect(id1).not.toBe(id2)
        })

        it('should build upstream WebSocket URLs correctly', () => {
            const request: Partial<IncomingMessage> = {
                url: '/raw',
                headers: {
                    'host': 'ws.postman-echo.com'
                }
            }

            const url = buildUpstreamWebSocketUrl(request as IncomingMessage, true)
            expect(url.toString()).toBe('wss://ws.postman-echo.com/raw')

            const insecureUrl = buildUpstreamWebSocketUrl(request as IncomingMessage, false)
            expect(insecureUrl.toString()).toBe('ws://ws.postman-echo.com/raw')
        })
    })

    describe('Plugin Event Handling', () => {
        it('should trigger onWebSocketUpgrade hook', async () => {
            const mockContext: WebSocketUpgradeContext = {
                id: 'test-conn-1',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {
                    'upgrade': 'websocket',
                    'connection': 'upgrade',
                    'sec-websocket-key': 'test-key',
                    'sec-websocket-version': '13',
                    'origin': 'https://example.com'
                },
                clientIp: '192.168.1.100',
                protocols: ['chat', 'echo'],
                extensions: ['permessage-deflate']
            }

            await pluginManager.runHook('onWebSocketUpgrade', mockContext)

            expect(capturedEvents).toHaveLength(1)
            expect(capturedEvents[0].type).toBe('upgrade')
            expect(capturedEvents[0].context.id).toBe('test-conn-1')
            expect(capturedEvents[0].context.url).toBe(POSTMAN_WS_URL)
            expect(capturedEvents[0].context.protocols).toEqual(['chat', 'echo'])
            expect(capturedEvents[0].context.isHttps).toBe(true)
        })

        it('should trigger onWebSocketMessage hook for text messages', async () => {
            const mockContext: WebSocketMessageContext = {
                id: 'test-conn-1',
                connectionId: 'test-conn-1',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: ['echo'],
                extensions: [],
                direction: 'client-to-server',
                messageType: 'text',
                payload: Buffer.from('Hello Postman Echo!'),
                textContent: 'Hello Postman Echo!',
                timestamp: Date.now()
            }

            await pluginManager.runHook('onWebSocketMessage', mockContext)

            expect(capturedEvents).toHaveLength(1)
            expect(capturedEvents[0].type).toBe('message')
            expect(capturedEvents[0].context.direction).toBe('client-to-server')
            expect(capturedEvents[0].context.messageType).toBe('text')
            expect(capturedEvents[0].context.textContent).toBe('Hello Postman Echo!')
            expect(capturedEvents[0].context.payloadSize).toBe(19)
        })

        it('should trigger onWebSocketMessage hook for binary messages', async () => {
            const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05])
            const mockContext: WebSocketMessageContext = {
                id: 'test-conn-1',
                connectionId: 'test-conn-1',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: [],
                direction: 'server-to-client',
                messageType: 'binary',
                payload: binaryData,
                textContent: undefined,
                timestamp: Date.now()
            }

            await pluginManager.runHook('onWebSocketMessage', mockContext)

            expect(capturedEvents).toHaveLength(1)
            expect(capturedEvents[0].type).toBe('message')
            expect(capturedEvents[0].context.direction).toBe('server-to-client')
            expect(capturedEvents[0].context.messageType).toBe('binary')
            expect(capturedEvents[0].context.textContent).toBeUndefined()
            expect(capturedEvents[0].context.payloadSize).toBe(5)
        })

        it('should trigger onWebSocketMessage hook for control frames', async () => {
            const pingContext: WebSocketMessageContext = {
                id: 'test-conn-1',
                connectionId: 'test-conn-1',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: [],
                direction: 'client-to-server',
                messageType: 'ping',
                payload: Buffer.alloc(0),
                textContent: undefined,
                timestamp: Date.now()
            }

            await pluginManager.runHook('onWebSocketMessage', pingContext)

            expect(capturedEvents).toHaveLength(1)
            expect(capturedEvents[0].type).toBe('message')
            expect(capturedEvents[0].context.messageType).toBe('ping')
        })

        it('should trigger onWebSocketClose hook', async () => {
            const mockContext: WebSocketCloseContext = {
                id: 'test-conn-1',
                connectionId: 'test-conn-1',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: ['echo'],
                extensions: [],
                code: 1000,
                reason: 'Normal closure',
                timestamp: Date.now()
            }

            await pluginManager.runHook('onWebSocketClose', mockContext)

            expect(capturedEvents).toHaveLength(1)
            expect(capturedEvents[0].type).toBe('close')
            expect(capturedEvents[0].context.code).toBe(1000)
            expect(capturedEvents[0].context.reason).toBe('Normal closure')
        })

        it('should handle multiple simultaneous WebSocket connections', async () => {
            const connections = [
                {
                    id: 'conn-1',
                    url: 'wss://ws.postman-echo.com/raw',
                    protocols: ['echo']
                },
                {
                    id: 'conn-2', 
                    url: 'wss://ws.postman-echo.com/chat',
                    protocols: ['chat']
                },
                {
                    id: 'conn-3',
                    url: 'wss://ws.postman-echo.com/broadcast',
                    protocols: []
                }
            ]

            // Simulate upgrade events for all connections
            for (const conn of connections) {
                const mockContext: WebSocketUpgradeContext = {
                    id: conn.id,
                    isHttps: true,
                    url: new URL(conn.url),
                    method: 'GET',
                    headers: { 'upgrade': 'websocket', 'connection': 'upgrade' },
                    protocols: conn.protocols,
                    extensions: []
                }

                await pluginManager.runHook('onWebSocketUpgrade', mockContext)
            }

            expect(capturedEvents).toHaveLength(3)
            expect(capturedEvents.every(e => e.type === 'upgrade')).toBe(true)
            
            const capturedIds = capturedEvents.map(e => e.context.id)
            expect(capturedIds).toEqual(['conn-1', 'conn-2', 'conn-3'])
        })

        it('should handle plugin errors gracefully', async () => {
            // Create a plugin that throws an error
            const errorPlugin: ProxyPlugin = {
                name: 'error-plugin',
                async onWebSocketUpgrade() {
                    throw new Error('Plugin error for testing')
                }
            }

            const errorPluginManager = new PluginManager([errorPlugin, mockPlugin])

            const mockContext: WebSocketUpgradeContext = {
                id: 'test-conn-error',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            // This should not throw, error should be handled internally
            await expect(
                errorPluginManager.runHook('onWebSocketUpgrade', mockContext)
            ).resolves.not.toThrow()

            // The second plugin should still execute despite the first one failing
            // We expect: 1 error event + 1 upgrade event = 2 total events
            expect(capturedEvents).toHaveLength(2)
            
            // Find the upgrade event (should be from the mock plugin)
            const upgradeEvent = capturedEvents.find(e => e.type === 'upgrade')
            expect(upgradeEvent).toBeDefined()
            expect(upgradeEvent!.context.id).toBe('test-conn-error')
        })
    })

    describe('WebSocket Handler Integration', () => {
        it('should initialize with correct configuration', () => {
            expect(webSocketHandler).toBeDefined()
            expect(webSocketHandler.getActiveConnectionCount()).toBe(0)
        })

        it('should track connection statistics', () => {
            const initialCount = webSocketHandler.getActiveConnectionCount()
            expect(typeof initialCount).toBe('number')
            expect(initialCount).toBeGreaterThanOrEqual(0)
        })

        it('should handle ignored hosts configuration', () => {
            const handlerWithIgnoredHosts = new WebSocketHandler(
                pluginManager,
                () => {},
                { ignoredHosts: ['ws.postman-echo.com', '*.example.com'] }
            )

            expect(handlerWithIgnoredHosts).toBeDefined()
        })
    })

    describe('Performance and Edge Cases', () => {
        it('should handle rapid message sequences', async () => {
            const messageCount = 100
            const startTime = Date.now()

            for (let i = 0; i < messageCount; i++) {
                const mockContext: WebSocketMessageContext = {
                    id: 'perf-test-conn',
                    connectionId: 'perf-test-conn',
                    isHttps: true,
                    url: new URL(POSTMAN_WS_URL),
                    method: 'GET',
                    headers: {},
                    protocols: [],
                    extensions: [],
                    direction: i % 2 === 0 ? 'client-to-server' : 'server-to-client',
                    messageType: 'text',
                    payload: Buffer.from(`Message ${i}`),
                    textContent: `Message ${i}`,
                    timestamp: Date.now()
                }

                await pluginManager.runHook('onWebSocketMessage', mockContext)
            }

            const endTime = Date.now()
            const duration = endTime - startTime

            expect(capturedEvents).toHaveLength(messageCount)
            expect(duration).toBeLessThan(1000) // Should complete within 1 second
            
            // Verify message order and content
            for (let i = 0; i < messageCount; i++) {
                expect(capturedEvents[i].context.textContent).toBe(`Message ${i}`)
            }
        })

        it('should handle large message payloads', async () => {
            // Test with 1MB message
            const largePayload = Buffer.alloc(1024 * 1024, 'A')
            
            const mockContext: WebSocketMessageContext = {
                id: 'large-msg-conn',
                connectionId: 'large-msg-conn',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: [],
                direction: 'client-to-server',
                messageType: 'binary',
                payload: largePayload,
                textContent: undefined,
                timestamp: Date.now()
            }

            const startTime = Date.now()
            await pluginManager.runHook('onWebSocketMessage', mockContext)
            const endTime = Date.now()

            expect(capturedEvents).toHaveLength(1)
            expect(capturedEvents[0].context.payloadSize).toBe(1024 * 1024)
            expect(endTime - startTime).toBeLessThan(100) // Should be fast even for large payloads
        })

        it('should handle Unicode text messages correctly', async () => {
            const unicodeMessages = [
                'Hello 世界! 🌍',
                'Café ☕ и чай 🍵',
                '数学: 2 + 2 = 4 ✓',
                'Emoji: 😀😃😄😁😆🤣😂'
            ]

            for (const message of unicodeMessages) {
                const mockContext: WebSocketMessageContext = {
                    id: 'unicode-test-conn',
                    connectionId: 'unicode-test-conn',
                    isHttps: true,
                    url: new URL(POSTMAN_WS_URL),
                    method: 'GET',
                    headers: {},
                    protocols: [],
                    extensions: [],
                    direction: 'client-to-server',
                    messageType: 'text',
                    payload: Buffer.from(message, 'utf8'),
                    textContent: message,
                    timestamp: Date.now()
                }

                await pluginManager.runHook('onWebSocketMessage', mockContext)
            }

            expect(capturedEvents).toHaveLength(unicodeMessages.length)
            
            for (let i = 0; i < unicodeMessages.length; i++) {
                expect(capturedEvents[i].context.textContent).toBe(unicodeMessages[i])
                expect(capturedEvents[i].context.payloadSize).toBe(
                    Buffer.from(unicodeMessages[i], 'utf8').length
                )
            }
        })
    })
})
