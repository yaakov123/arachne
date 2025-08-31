import { router } from './init'
import { healthRouter } from './routers/health'
import { certRouter } from './routers/cert'
import { projectsRouter } from './routers/projects'
import { proxyRouter } from './routers/proxy'
import { caRouter } from './routers/ca'
import { subscriptionsRouter } from './routers/subscriptions'
import { transactionsRouter } from './routers/transactions'
import { hostsRouter } from './routers/hosts'
import { authProfilesRouter } from './routers/auth-profiles'

/**
 * Main tRPC router that combines all sub-routers
 */
export const appRouter = router({
    health: healthRouter,
    cert: certRouter,
    projects: projectsRouter,
    proxy: proxyRouter,
    ca: caRouter,
    subscriptions: subscriptionsRouter,
    transactions: transactionsRouter,
    hosts: hostsRouter,
    authProfiles: authProfilesRouter,
})

export type AppRouter = typeof appRouter
