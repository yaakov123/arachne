import type { FastifyInstance } from 'fastify'
import type { RouteOptions } from './types'
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
    // Register all route modules
    registerHealthRoutes(app)
    registerCertRoutes(app, opts)
    registerProxyRoutes(app, opts)
    registerCARoutes(app, opts)
    registerRepeaterRoutes(app, opts)
    registerProjectRoutes(app, opts)
}

// Re-export types for convenience
export type { RouteOptions } from './types'
