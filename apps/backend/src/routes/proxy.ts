import type { FastifyInstance } from 'fastify'
import type {
    ProxyStartResponse,
    ProxyStopResponse,
    ProxyErrorResponse,
    ProxyStatusResponse,
} from '@arachne/api-types'
import type { RouteOptions, AuthMiddleware } from './types'

export function registerProxyRoutes(
    app: FastifyInstance,
    opts: Pick<RouteOptions, 'prefix' | 'proxy'>,
    auth: AuthMiddleware
) {
    const { prefix, proxy } = opts

    // Start proxy
    app.post(
        `${prefix}/proxy/start`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                const serverInfo = await proxy.start()
                const response: ProxyStartResponse = {
                    ok: true,
                    message: 'Proxy started successfully',
                    serverInfo,
                }
                rep.send(response)
            } catch (error) {
                const response: ProxyErrorResponse = {
                    ok: false,
                    error: 'Failed to start proxy',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    // Stop proxy
    app.post(
        `${prefix}/proxy/stop`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                await proxy.stop()
                const response: ProxyStopResponse = {
                    ok: true,
                    message: 'Proxy stopped successfully',
                }
                rep.send(response)
            } catch (error) {
                const response: ProxyErrorResponse = {
                    ok: false,
                    error: 'Failed to stop proxy',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    // Get proxy status
    app.get(
        `${prefix}/proxy/status`,
        { preHandler: auth },
        async (_req, rep) => {
            const isRunning = proxy.isRunning()
            const response: ProxyStatusResponse = {
                ok: true,
                isRunning,
                serverInfo: proxy.getServerInfo() ?? undefined,
            }
            rep.send(response)
        }
    )
}
