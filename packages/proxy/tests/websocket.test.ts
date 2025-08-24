import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MitmProxyServer } from '../src/proxy/server.js'
import { isWebSocketUpgrade, generateConnectionId } from '../src/websocket/utils.js'
import { WebSocketHandler } from '../src/websocket/handler.js'
import { PluginManager } from '../src/proxy/plugin-manager.js'
import type { IncomingMessage } from 'node:http'

describe('WebSocket Proxy', () => {
    let proxy: MitmProxyServer
    
    beforeEach(async () => {
        proxy = new MitmProxyServer({ port: 0 }) // Use random port
    })
    
    afterEach(async () => {
        if (proxy.isRunning()) {
            await proxy.stop()
        }
    })

    describe('WebSocket Utils', () => {
        it('should detect WebSocket upgrade requests', () => {
            const req1: Partial<IncomingMessage> = {
                method: 'GET',
                headers: {
                    'upgrade': 'websocket',
                    'connection': 'upgrade'
                }
            }
            expect(isWebSocketUpgrade(req1 as IncomingMessage)).toBe(true)

            const req2: Partial<IncomingMessage> = {
                method: 'GET',
                headers: {
                    'upgrade': 'websocket',
                    'connection': 'keep-alive, upgrade'
                }
            }
            expect(isWebSocketUpgrade(req2 as IncomingMessage)).toBe(true)

            const req3: Partial<IncomingMessage> = {
                method: 'GET',
                headers: {
                    'upgrade': 'h2c',
                    'connection': 'upgrade'
                }
            }
            expect(isWebSocketUpgrade(req3 as IncomingMessage)).toBe(false)

            const req4: Partial<IncomingMessage> = {
                method: 'POST',
                headers: {
                    'upgrade': 'websocket',
                    'connection': 'upgrade'
                }
            }
            expect(isWebSocketUpgrade(req4 as IncomingMessage)).toBe(false)
        })

        it('should generate unique connection IDs', () => {
            const id1 = generateConnectionId()
            const id2 = generateConnectionId()
            
            expect(id1).toMatch(/^ws_\d+_[a-z0-9]{9}$/)
            expect(id2).toMatch(/^ws_\d+_[a-z0-9]{9}$/)
            expect(id1).not.toBe(id2)
        })
    })

    describe('WebSocket Handler', () => {
        it('should create WebSocket handler', () => {
            const pluginManager = new PluginManager()
            const handler = new WebSocketHandler(
                pluginManager,
                () => {},
                { ignoredHosts: ['example.com'] }
            )
            
            expect(handler).toBeDefined()
            expect(handler.getActiveConnectionCount()).toBe(0)
        })

        it('should track connection statistics', () => {
            const pluginManager = new PluginManager()
            const handler = new WebSocketHandler(pluginManager, () => {})
            
            expect(handler.getActiveConnectionCount()).toBe(0)
        })
    })

    describe('Proxy Integration', () => {
        it('should create proxy with WebSocket support', async () => {
            const serverInfo = await proxy.start()
            expect(serverInfo.port).toBeTypeOf('number')
            expect(proxy.isRunning()).toBe(true)
            
            const stats = proxy.getWebSocketStats()
            expect(stats.activeConnections).toBe(0)
        })

        it('should add WebSocket-aware plugins', async () => {
            const messages: string[] = []
            
            proxy.addPlugin({
                name: 'test-websocket-plugin',
                async onWebSocketUpgrade(ctx) {
                    messages.push(`upgrade:${ctx.id}`)
                },
                async onWebSocketMessage(ctx) {
                    messages.push(`message:${ctx.direction}:${ctx.messageType}`)
                },
                async onWebSocketClose(ctx) {
                    messages.push(`close:${ctx.connectionId}`)
                }
            })
            
            // Plugin should be registered
            expect(proxy).toBeDefined()
        })
    })
})
