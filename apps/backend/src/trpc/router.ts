import { router } from './init'
import { healthRouter } from './routers/health.router'
import { certRouter } from './routers/cert.router'
import { projectsRouter } from './routers/projects.router'
import { proxyRouter } from './routers/proxy.router'
import { caRouter } from './routers/ca.router'
import { subscriptionsRouter } from './routers/subscriptions.router'
import { transactionsRouter } from './routers/transactions.router'
import { hostsRouter } from './routers/hosts.router'
import { authProfilesRouter } from './routers/auth-profiles.router'

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
