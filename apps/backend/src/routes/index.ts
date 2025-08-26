import type { FastifyInstance } from 'fastify'
import type { RouteOptions } from './types'
import { createAuthMiddleware } from './types'
import { registerHealthRoutes } from './health'
import { registerCertRoutes } from './cert'
import { registerProxyRoutes } from './proxy'
import { registerCARoutes } from './ca'
import { registerRepeaterRoutes } from './repeater'
import { registerProjectRoutes } from './projects'

export async function registerAllRoutes(
    app: FastifyInstance,
    opts: RouteOptions
) {
    const auth = createAuthMiddleware(opts.token)

    // Register all route modules
    registerHealthRoutes(app)
    registerCertRoutes(app, opts, auth)
    registerProxyRoutes(app, opts, auth)
    registerCARoutes(app, opts, auth)
    registerRepeaterRoutes(app, opts, auth)
    registerProjectRoutes(app, opts, auth)
}

// Re-export types for convenience
export type { RouteOptions } from './types'
