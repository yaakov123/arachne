import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRecorderPlugin } from '../src/plugin.js'
import type { 
    WebSocketUpgradeContext, 
    WebSocketMessageContext, 
    WebSocketCloseContext 
} from '../src/types.js'
import { FileStorageAdapter } from '../src/storage/file.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'

// Test data based on Postman Echo WebSocket service
const POSTMAN_WS_URL = 'wss://ws.postman-echo.com/raw'

describe('WebSocket Recorder Tests', () => {
    let tempDir: string
    let storage: FileStorageAdapter
    let recorderPlugin: any

    beforeEach(() => {
        // Create temporary directory for test storage
        tempDir = join(tmpdir(), `arachne-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
        
        storage = new FileStorageAdapter({ outDir: tempDir })
        const result = createRecorderPlugin({ 
            storage,
            maxCaptureBytes: 1024 * 10 // 10KB for testing
        })
        recorderPlugin = result.plugin
    })

    afterEach(async () => {
        // Clean up temporary directory
        try {
            await rm(tempDir, { recursive: true, force: true })
        } catch {
            // Ignore cleanup errors
        }
    })

    describe('WebSocket Recording', () => {
        it('should record WebSocket upgrade events', async () => {
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'test-ws-conn-1',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {
                    'upgrade': 'websocket',
                    'connection': 'upgrade',
                    'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
                    'sec-websocket-version': '13',
                    'origin': 'https://test.example.com',
                    'user-agent': 'Arachne WebSocket Test'
                },
                clientIp: '192.168.1.100',
                protocols: ['echo', 'chat'],
                extensions: ['permessage-deflate']
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            const inventory = storage.snapshot()
            expect(inventory.hosts).toHaveProperty('ws.postman-echo.com')
            
            const hostRecord = inventory.hosts['ws.postman-echo.com']
            expect(hostRecord.websockets).toHaveProperty('test-ws-conn-1')
            
            const wsRecord = hostRecord.websockets['test-ws-conn-1']
            expect(wsRecord).toMatchObject({
                id: 'test-ws-conn-1',
                url: POSTMAN_WS_URL,
                protocols: ['echo', 'chat'],
                state: 'open',
                messageCount: 0,
                messages: []
            })
            
            expect(wsRecord.startTime).toBeDefined()
            expect(new Date(wsRecord.startTime).getTime()).toBeGreaterThan(0)
        })

        it('should record text WebSocket messages', async () => {
            // First establish the connection
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'test-ws-conn-2',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            // Then send some messages
            const messages = [
                'Hello Postman Echo!',
                'Testing WebSocket recording',
                JSON.stringify({ type: 'test', data: 'JSON message' }),
                'Final test message'
            ]

            for (let i = 0; i < messages.length; i++) {
                const messageContext: WebSocketMessageContext = {
                    id: 'test-ws-conn-2',
                    connectionId: 'test-ws-conn-2',
                    isHttps: true,
                    url: new URL(POSTMAN_WS_URL),
                    method: 'GET',
                    headers: {},
                    protocols: [],
                    extensions: [],
                    direction: i % 2 === 0 ? 'client-to-server' : 'server-to-client',
                    messageType: 'text',
                    payload: Buffer.from(messages[i]),
                    textContent: messages[i],
                    timestamp: Date.now() + i * 10 // Slightly different timestamps
                }

                await recorderPlugin.onWebSocketMessage(messageContext)
            }

            const inventory = storage.snapshot()
            const wsRecord = inventory.hosts['ws.postman-echo.com'].websockets['test-ws-conn-2']
            
            expect(wsRecord.messageCount).toBe(4)
            expect(wsRecord.messages).toHaveLength(4)
            
            // Verify message content and order
            for (let i = 0; i < messages.length; i++) {
                const recordedMessage = wsRecord.messages[i]
                expect(recordedMessage.direction).toBe(i % 2 === 0 ? 'client-to-server' : 'server-to-client')
                expect(recordedMessage.messageType).toBe('text')
                expect(recordedMessage.payload).toBe(messages[i])
                expect(recordedMessage.size).toBe(Buffer.from(messages[i]).length)
            }
        })

        it('should record binary WebSocket messages', async () => {
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'test-ws-conn-binary',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            // Send binary data
            const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD])
            const messageContext: WebSocketMessageContext = {
                id: 'test-ws-conn-binary',
                connectionId: 'test-ws-conn-binary',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: [],
                direction: 'client-to-server',
                messageType: 'binary',
                payload: binaryData,
                textContent: undefined,
                timestamp: Date.now()
            }

            await recorderPlugin.onWebSocketMessage(messageContext)

            const inventory = storage.snapshot()
            const wsRecord = inventory.hosts['ws.postman-echo.com'].websockets['test-ws-conn-binary']
            
            expect(wsRecord.messageCount).toBe(1)
            expect(wsRecord.messages).toHaveLength(1)
            
            const recordedMessage = wsRecord.messages[0]
            expect(recordedMessage.messageType).toBe('binary')
            expect(recordedMessage.size).toBe(7)
            expect(recordedMessage.payload).toMatch(/^base64:/)
            
            // Verify base64 encoding
            const base64Data = recordedMessage.payload!.replace('base64:', '')
            const decodedData = Buffer.from(base64Data, 'base64')
            expect(decodedData).toEqual(binaryData)
        })

        it('should record control frame messages', async () => {
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'test-ws-conn-control',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            // Test ping, pong, and close frames
            const controlFrames = [
                { type: 'ping' as const, payload: Buffer.alloc(0) },
                { type: 'pong' as const, payload: Buffer.alloc(0) },
                { type: 'close' as const, payload: Buffer.from([0x03, 0xE8]) } // Close code 1000
            ]

            for (const frame of controlFrames) {
                const messageContext: WebSocketMessageContext = {
                    id: 'test-ws-conn-control',
                    connectionId: 'test-ws-conn-control',
                    isHttps: true,
                    url: new URL(POSTMAN_WS_URL),
                    method: 'GET',
                    headers: {},
                    protocols: [],
                    extensions: [],
                    direction: 'client-to-server',
                    messageType: frame.type,
                    payload: frame.payload,
                    textContent: undefined,
                    timestamp: Date.now()
                }

                await recorderPlugin.onWebSocketMessage(messageContext)
            }

            const inventory = storage.snapshot()
            const wsRecord = inventory.hosts['ws.postman-echo.com'].websockets['test-ws-conn-control']
            
            expect(wsRecord.messageCount).toBe(3)
            expect(wsRecord.messages).toHaveLength(3)
            
            // Verify control frame recording
            expect(wsRecord.messages[0].messageType).toBe('ping')
            expect(wsRecord.messages[0].payload).toBe('[PING]')
            
            expect(wsRecord.messages[1].messageType).toBe('pong')
            expect(wsRecord.messages[1].payload).toBe('[PONG]')
            
            expect(wsRecord.messages[2].messageType).toBe('close')
            expect(wsRecord.messages[2].payload).toBe('[CLOSE]')
        })

        it('should record WebSocket close events', async () => {
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'test-ws-conn-close',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            const closeContext: WebSocketCloseContext = {
                id: 'test-ws-conn-close',
                connectionId: 'test-ws-conn-close',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: [],
                code: 1000,
                reason: 'Normal closure',
                timestamp: Date.now()
            }

            await recorderPlugin.onWebSocketClose(closeContext)

            const inventory = storage.snapshot()
            const wsRecord = inventory.hosts['ws.postman-echo.com'].websockets['test-ws-conn-close']
            
            expect(wsRecord.state).toBe('closed')
            expect(wsRecord.endTime).toBeDefined()
            expect(new Date(wsRecord.endTime!).getTime()).toBeGreaterThan(0)
        })

        it('should handle message size limits', async () => {
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'test-ws-conn-limits',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            // Create a message larger than the 10KB limit
            const largeMessage = 'A'.repeat(15 * 1024) // 15KB
            const messageContext: WebSocketMessageContext = {
                id: 'test-ws-conn-limits',
                connectionId: 'test-ws-conn-limits',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: [],
                direction: 'client-to-server',
                messageType: 'text',
                payload: Buffer.from(largeMessage),
                textContent: largeMessage,
                timestamp: Date.now()
            }

            await recorderPlugin.onWebSocketMessage(messageContext)

            const inventory = storage.snapshot()
            const wsRecord = inventory.hosts['ws.postman-echo.com'].websockets['test-ws-conn-limits']
            
            expect(wsRecord.messageCount).toBe(1)
            const recordedMessage = wsRecord.messages[0]
            
            // Should be truncated
            expect(recordedMessage.payload!.length).toBeLessThan(largeMessage.length)
            expect(recordedMessage.payload).toMatch(/\.\.\.\[truncated\]$/)
            expect(recordedMessage.size).toBe(15 * 1024) // Original size should be preserved
        })

        it('should handle multiple concurrent WebSocket connections', async () => {
            const connectionIds = ['conn-1', 'conn-2', 'conn-3']
            
            // Establish multiple connections
            for (const connId of connectionIds) {
                const upgradeContext: WebSocketUpgradeContext = {
                    id: connId,
                    isHttps: true,
                    url: new URL(POSTMAN_WS_URL),
                    method: 'GET',
                    headers: {},
                    protocols: [`protocol-${connId}`],
                    extensions: []
                }

                await recorderPlugin.onWebSocketUpgrade(upgradeContext)
            }

            // Send messages from each connection
            for (let i = 0; i < connectionIds.length; i++) {
                const connId = connectionIds[i]
                const messageContext: WebSocketMessageContext = {
                    id: connId,
                    connectionId: connId,
                    isHttps: true,
                    url: new URL(POSTMAN_WS_URL),
                    method: 'GET',
                    headers: {},
                    protocols: [],
                    extensions: [],
                    direction: 'client-to-server',
                    messageType: 'text',
                    payload: Buffer.from(`Message from ${connId}`),
                    textContent: `Message from ${connId}`,
                    timestamp: Date.now()
                }

                await recorderPlugin.onWebSocketMessage(messageContext)
            }

            const inventory = storage.snapshot()
            const hostRecord = inventory.hosts['ws.postman-echo.com']
            
            expect(Object.keys(hostRecord.websockets)).toHaveLength(3)
            
            for (const connId of connectionIds) {
                expect(hostRecord.websockets).toHaveProperty(connId)
                const wsRecord = hostRecord.websockets[connId]
                expect(wsRecord.messageCount).toBe(1)
                expect(wsRecord.messages[0].payload).toBe(`Message from ${connId}`)
                expect(wsRecord.protocols).toEqual([`protocol-${connId}`])
            }
        })

        it('should handle Unicode content correctly', async () => {
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'test-ws-conn-unicode',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            const unicodeMessages = [
                '你好世界 🌍',
                'Café ☕ и чай 🍵',
                '数学: π ≈ 3.14159 ∞',
                'Emoji party: 🎉🎊🥳🎈🎁'
            ]

            for (const message of unicodeMessages) {
                const messageContext: WebSocketMessageContext = {
                    id: 'test-ws-conn-unicode',
                    connectionId: 'test-ws-conn-unicode',
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

                await recorderPlugin.onWebSocketMessage(messageContext)
            }

            const inventory = storage.snapshot()
            const wsRecord = inventory.hosts['ws.postman-echo.com'].websockets['test-ws-conn-unicode']
            
            expect(wsRecord.messageCount).toBe(unicodeMessages.length)
            
            for (let i = 0; i < unicodeMessages.length; i++) {
                expect(wsRecord.messages[i].payload).toBe(unicodeMessages[i])
                expect(wsRecord.messages[i].size).toBe(Buffer.from(unicodeMessages[i], 'utf8').length)
            }
        })
    })

    describe('Storage Integration', () => {
        it('should persist WebSocket data to storage', async () => {
            // Create a connection and send some messages
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'persist-test-conn',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: ['test'],
                extensions: []
            }

            await recorderPlugin.onWebSocketUpgrade(upgradeContext)

            // Send a few messages
            for (let i = 0; i < 3; i++) {
                const messageContext: WebSocketMessageContext = {
                    id: 'persist-test-conn',
                    connectionId: 'persist-test-conn',
                    isHttps: true,
                    url: new URL(POSTMAN_WS_URL),
                    method: 'GET',
                    headers: {},
                    protocols: [],
                    extensions: [],
                    direction: 'client-to-server',
                    messageType: 'text',
                    payload: Buffer.from(`Test message ${i}`),
                    textContent: `Test message ${i}`,
                    timestamp: Date.now()
                }

                await recorderPlugin.onWebSocketMessage(messageContext)
            }

            // Close the connection
            const closeContext: WebSocketCloseContext = {
                id: 'persist-test-conn',
                connectionId: 'persist-test-conn',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: [],
                code: 1000,
                reason: 'Test complete',
                timestamp: Date.now()
            }

            await recorderPlugin.onWebSocketClose(closeContext)

            // Verify data integrity
            const inventory = storage.snapshot()
            const wsRecord = inventory.hosts['ws.postman-echo.com'].websockets['persist-test-conn']

            expect(wsRecord).toMatchObject({
                id: 'persist-test-conn',
                url: POSTMAN_WS_URL,
                protocols: ['test'],
                state: 'closed',
                messageCount: 3
            })

            expect(wsRecord.startTime).toBeDefined()
            expect(wsRecord.endTime).toBeDefined()
            expect(wsRecord.messages).toHaveLength(3)
            
            // Verify message ordering
            for (let i = 0; i < 3; i++) {
                expect(wsRecord.messages[i].payload).toBe(`Test message ${i}`)
            }
        })

        it('should reset storage correctly', () => {
            // Add some data
            const upgradeContext: WebSocketUpgradeContext = {
                id: 'reset-test-conn',
                isHttps: true,
                url: new URL(POSTMAN_WS_URL),
                method: 'GET',
                headers: {},
                protocols: [],
                extensions: []
            }

            recorderPlugin.onWebSocketUpgrade(upgradeContext)

            // Verify data exists
            let inventory = storage.snapshot()
            expect(Object.keys(inventory.hosts)).toHaveLength(1)

            // Reset storage
            storage.reset?.()

            // Verify data is cleared
            inventory = storage.snapshot()
            expect(Object.keys(inventory.hosts)).toHaveLength(0)
        })
    })
})
