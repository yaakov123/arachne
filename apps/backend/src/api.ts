import type { FastifyInstance } from 'fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import type { ProjectService } from './services/project-service'
import { registerAllRoutes, type RouteOptions } from './routes'
import { TransactionService } from './services/transaction-service'

interface ApiOptions {
    prefix: string
    token?: string
    ca: CertificateAuthority
    proxy: MitmProxyServer
    projectService: ProjectService
    transactionService: TransactionService
}

export async function registerApi(app: FastifyInstance, opts: ApiOptions) {
    const routeOptions: RouteOptions = {
        prefix: opts.prefix,
        token: opts.token,
        ca: opts.ca,
        proxy: opts.proxy,
        projectService: opts.projectService,
        transactionService: opts.transactionService,
    }

    await registerAllRoutes(app, routeOptions)
}
