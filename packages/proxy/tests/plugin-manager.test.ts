import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PluginManager } from '../src/core/plugin-manager'
import type {
    ProxyPlugin,
    BeforeRequestContext,
    AfterRequestContext,
    BeforeResponseContext,
    AfterResponseContext,
    ConnectContext,
} from '../src/plugins/types'
import { RequestBuilder, ResponseBuilder } from '../src/plugins/builders'

// Mock plugins for testing
const createMockPlugin = (
    name: string,
    hooks: Partial<ProxyPlugin> = {}
): ProxyPlugin => ({
    name,
    ...hooks,
})

const createMockBeforeRequestContext = (): BeforeRequestContext => ({
    id: 'req_123',
    isHttps: true,
    url: new URL('https://example.com'),
    method: 'GET',
    headers: {},
    request: new RequestBuilder(new URL('https://example.com'), 'GET', {}),
})

const createMockAfterRequestContext = (): AfterRequestContext => ({
    id: 'req_123',
    isHttps: true,
    url: new URL('https://example.com'),
    method: 'GET',
    headers: {},
    finalUrl: new URL('https://example.com'),
    finalMethod: 'GET',
    finalHeaders: {},
})

const createMockBeforeResponseContext = (): BeforeResponseContext => ({
    ...createMockAfterRequestContext(),
    statusCode: 200,
    statusMessage: 'OK',
    responseHeaders: {},
    response: new ResponseBuilder(200, 'OK', {}),
})

const createMockAfterResponseContext = (): AfterResponseContext => ({
    ...createMockBeforeResponseContext(),
    finalStatusCode: 200,
    finalStatusMessage: 'OK',
    finalResponseHeaders: {},
    duration: 100,
})

const createMockConnectContext = (): ConnectContext => ({
    id: 'conn_123',
    hostname: 'example.com',
    port: 443,
})

describe('PluginManager', () => {
    let manager: PluginManager

    beforeEach(() => {
        manager = new PluginManager()
    })

    describe('plugin management', () => {
        it('should add plugins successfully', () => {
            const plugin = createMockPlugin('test-plugin')

            manager.addPlugin(plugin)

            expect(manager.getPlugins()).toHaveLength(1)
            expect(manager.getPlugins()[0]).toBe(plugin)
        })

        it('should initialize with plugins', () => {
            const plugin1 = createMockPlugin('plugin1')
            const plugin2 = createMockPlugin('plugin2')

            const managerWithPlugins = new PluginManager([plugin1, plugin2])

            expect(managerWithPlugins.getPlugins()).toHaveLength(2)
        })

        it('should reject plugins without names', () => {
            const invalidPlugin = { name: '' } as ProxyPlugin

            expect(() => {
                manager.addPlugin(invalidPlugin)
            }).toThrow('Plugin must have a valid name')
        })

        it('should reject duplicate plugin names', () => {
            const plugin1 = createMockPlugin('duplicate')
            const plugin2 = createMockPlugin('duplicate')

            manager.addPlugin(plugin1)

            expect(() => {
                manager.addPlugin(plugin2)
            }).toThrow("Plugin with name 'duplicate' already exists")
        })

        it('should remove plugins by name', () => {
            const plugin = createMockPlugin('removable')
            manager.addPlugin(plugin)

            const removed = manager.removePlugin('removable')

            expect(removed).toBe(true)
            expect(manager.getPlugins()).toHaveLength(0)
        })

        it('should return false when removing non-existent plugin', () => {
            const removed = manager.removePlugin('non-existent')

            expect(removed).toBe(false)
        })

        it('should return readonly plugin list', () => {
            const plugin = createMockPlugin('test')
            manager.addPlugin(plugin)

            const plugins = manager.getPlugins()

            // The array is frozen, so it should be immutable
            expect(Object.isFrozen(plugins)).toBe(true)
        })
    })

    describe('hook detection', () => {
        it('should detect beforeRequest hooks', () => {
            const plugin = createMockPlugin('test', {
                beforeRequest: vi.fn(),
            })
            manager.addPlugin(plugin)

            expect(manager.hasHook('beforeRequest')).toBe(true)
            expect(manager.hasHook('afterRequest')).toBe(false)
        })

        it('should detect response hooks', () => {
            const plugin1 = createMockPlugin('plugin1', {
                beforeResponse: vi.fn(),
            })
            const plugin2 = createMockPlugin('plugin2', {
                afterResponse: vi.fn(),
            })

            manager.addPlugin(plugin1)
            expect(manager.hasResponseHooks()).toBe(true)

            const manager2 = new PluginManager()
            manager2.addPlugin(plugin2)
            expect(manager2.hasResponseHooks()).toBe(true)
        })

        it('should return false for response hooks when none present', () => {
            const plugin = createMockPlugin('test', {
                beforeRequest: vi.fn(),
            })
            manager.addPlugin(plugin)

            expect(manager.hasResponseHooks()).toBe(false)
        })
    })

    describe('hook execution', () => {
        describe('executeBeforeRequest', () => {
            it('should execute beforeRequest hooks in order', async () => {
                const execution: string[] = []
                const plugin1 = createMockPlugin('plugin1', {
                    beforeRequest: vi.fn().mockImplementation(() => {
                        execution.push('plugin1')
                    }),
                })
                const plugin2 = createMockPlugin('plugin2', {
                    beforeRequest: vi.fn().mockImplementation(() => {
                        execution.push('plugin2')
                    }),
                })

                manager.addPlugin(plugin1)
                manager.addPlugin(plugin2)

                const context = createMockBeforeRequestContext()
                const result = await manager.executeBeforeRequest(context)

                expect(execution).toEqual(['plugin1', 'plugin2'])
                expect(result).toBe(context.request)
                expect(plugin1.beforeRequest).toHaveBeenCalledWith(context)
                expect(plugin2.beforeRequest).toHaveBeenCalledWith(context)
            })

            it('should skip plugins without beforeRequest hook', async () => {
                const plugin1 = createMockPlugin('plugin1', {
                    beforeRequest: vi.fn(),
                })
                const plugin2 = createMockPlugin('plugin2') // No beforeRequest

                manager.addPlugin(plugin1)
                manager.addPlugin(plugin2)

                const context = createMockBeforeRequestContext()
                await manager.executeBeforeRequest(context)

                expect(plugin1.beforeRequest).toHaveBeenCalled()
            })

            it('should handle plugin errors gracefully', async () => {
                const consoleErrorSpy = vi
                    .spyOn(console, 'error')
                    .mockImplementation(() => {})
                const plugin1 = createMockPlugin('plugin1', {
                    beforeRequest: vi
                        .fn()
                        .mockRejectedValue(new Error('Plugin error')),
                })
                const plugin2 = createMockPlugin('plugin2', {
                    beforeRequest: vi.fn(),
                    onError: vi.fn(),
                })

                manager.addPlugin(plugin1)
                manager.addPlugin(plugin2)

                const context = createMockBeforeRequestContext()
                await manager.executeBeforeRequest(context)

                expect(consoleErrorSpy).toHaveBeenCalled()
                expect(plugin2.onError).toHaveBeenCalledWith(
                    expect.any(Error),
                    expect.objectContaining({
                        pluginName: 'plugin1',
                        hookName: 'beforeRequest',
                    })
                )

                consoleErrorSpy.mockRestore()
            })
        })

        describe('executeAfterRequest', () => {
            it('should execute afterRequest hooks', async () => {
                const plugin = createMockPlugin('test', {
                    afterRequest: vi.fn(),
                })
                manager.addPlugin(plugin)

                const context = createMockAfterRequestContext()
                await manager.executeAfterRequest(context)

                expect(plugin.afterRequest).toHaveBeenCalledWith(context)
            })
        })

        describe('executeBeforeResponse', () => {
            it('should execute beforeResponse hooks and return response builder', async () => {
                const plugin = createMockPlugin('test', {
                    beforeResponse: vi.fn(),
                })
                manager.addPlugin(plugin)

                const context = createMockBeforeResponseContext()
                const result = await manager.executeBeforeResponse(context)

                expect(plugin.beforeResponse).toHaveBeenCalledWith(context)
                expect(result).toBe(context.response)
            })
        })

        describe('executeAfterResponse', () => {
            it('should execute afterResponse hooks', async () => {
                const plugin = createMockPlugin('test', {
                    afterResponse: vi.fn(),
                })
                manager.addPlugin(plugin)

                const context = createMockAfterResponseContext()
                await manager.executeAfterResponse(context)

                expect(plugin.afterResponse).toHaveBeenCalledWith(context)
            })
        })

        describe('executeOnConnect', () => {
            it('should execute onConnect hooks', async () => {
                const plugin = createMockPlugin('test', {
                    onConnect: vi.fn(),
                })
                manager.addPlugin(plugin)

                const context = createMockConnectContext()
                await manager.executeOnConnect(context)

                expect(plugin.onConnect).toHaveBeenCalledWith(context)
            })
        })

        describe('executeOnError', () => {
            it('should execute onError hooks on all plugins', () => {
                const plugin1 = createMockPlugin('plugin1', {
                    onError: vi.fn(),
                })
                const plugin2 = createMockPlugin('plugin2', {
                    onError: vi.fn(),
                })

                manager.addPlugin(plugin1)
                manager.addPlugin(plugin2)

                const error = new Error('Test error')
                const context = { id: 'test' }

                manager.executeOnError(error, context)

                expect(plugin1.onError).toHaveBeenCalledWith(error, context)
                expect(plugin2.onError).toHaveBeenCalledWith(error, context)
            })

            it('should handle errors in onError hooks', () => {
                const consoleErrorSpy = vi
                    .spyOn(console, 'error')
                    .mockImplementation(() => {})
                const plugin = createMockPlugin('test', {
                    onError: vi.fn().mockImplementation(() => {
                        throw new Error('Error in error handler')
                    }),
                })

                manager.addPlugin(plugin)

                manager.executeOnError(new Error('Original error'), {})

                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(
                        "Error in plugin 'test' onError hook"
                    ),
                    expect.any(Error)
                )

                consoleErrorSpy.mockRestore()
            })
        })
    })

    describe('legacy compatibility', () => {
        it('should support legacy runHook method for onConnect', async () => {
            const consoleWarnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})
            const plugin = createMockPlugin('test', {
                onConnect: vi.fn(),
            })
            manager.addPlugin(plugin)

            const context = createMockConnectContext()
            await manager.runHook('onConnect', context)

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Legacy runHook method called')
            )
            expect(plugin.onConnect).toHaveBeenCalledWith(context)

            consoleWarnSpy.mockRestore()
        })

        it('should warn about unsupported legacy hooks', async () => {
            const consoleWarnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})

            await manager.runHook('beforeRequest' as any, {} as any)

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Legacy hook 'beforeRequest' is not supported"
                )
            )

            consoleWarnSpy.mockRestore()
        })
    })

    describe('error handling', () => {
        it('should call error hooks on other plugins when one fails', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            const failingPlugin = createMockPlugin('failing', {
                beforeRequest: vi
                    .fn()
                    .mockRejectedValue(new Error('Plugin failure')),
            })
            const errorHandlerPlugin = createMockPlugin('error-handler', {
                onError: vi.fn(),
            })

            manager.addPlugin(failingPlugin)
            manager.addPlugin(errorHandlerPlugin)

            const context = createMockBeforeRequestContext()
            await manager.executeBeforeRequest(context)

            expect(errorHandlerPlugin.onError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    pluginName: 'failing',
                    hookName: 'beforeRequest',
                    originalError: expect.any(Error),
                })
            )

            consoleErrorSpy.mockRestore()
        })

        it('should not call error hook on the plugin that failed', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {})
            const failingPlugin = createMockPlugin('failing', {
                beforeRequest: vi
                    .fn()
                    .mockRejectedValue(new Error('Plugin failure')),
                onError: vi.fn(),
            })

            manager.addPlugin(failingPlugin)

            const context = createMockBeforeRequestContext()
            await manager.executeBeforeRequest(context)

            expect(failingPlugin.onError).not.toHaveBeenCalled()

            consoleErrorSpy.mockRestore()
        })
    })
})
