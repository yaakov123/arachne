import type { FastifyInstance } from 'fastify'
import type {
    ProxyStartResponse,
    ProxyStopResponse,
    ProxyErrorResponse,
    ProxyStatusResponse,
} from '@arachne/api-types'
import type { RouteOptions } from './types'
import { buildProjectConfiguration } from '../services/proxy-configuration-manager'

export function registerProxyRoutes(
    app: FastifyInstance,
    opts: Pick<RouteOptions, 'prefix' | 'proxy' | 'projectService'>
) {
    const { prefix, proxy, projectService } = opts

    // Start proxy
    app.post(
        `${prefix}/proxy/start`,

        async (_req, rep) => {
            try {
                const currentProject = await projectService.getCurrentProject()
                if (currentProject) {
                    proxy.updateConfiguration(
                        buildProjectConfiguration(currentProject.metadata)
                    )
                }

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
