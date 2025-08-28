import { router } from './init'
import { healthRouter } from './routers/health'
import { certRouter } from './routers/cert'
import { projectsRouter } from './routers/projects'
import { proxyRouter } from './routers/proxy'
import { caRouter } from './routers/ca'
import { repeaterRouter } from './routers/repeater'
import { subscriptionsRouter } from './routers/subscriptions'

/**
 * Main tRPC router that combines all sub-routers
 */
export const appRouter = router({
    health: healthRouter,
    cert: certRouter,
    projects: projectsRouter,
    proxy: proxyRouter,
    ca: caRouter,
    repeater: repeaterRouter,
    subscriptions: subscriptionsRouter,
})

export type AppRouter = typeof appRouter
