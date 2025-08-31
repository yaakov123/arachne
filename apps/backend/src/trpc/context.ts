import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import type { ProjectService } from '../services/project-service'
import type { TransactionService } from '../services/transaction-service'
import type { AuthProfileService } from '../services/auth-profile-service'

/**
 * tRPC context interface - contains all services and dependencies
 * that procedures will need access to
 */
export interface TRPCContext {
    // Request/response objects
    req: CreateFastifyContextOptions['req']
    res: CreateFastifyContextOptions['res']

    // Services
    projectService: ProjectService
    transactionService: TransactionService
    authProfileService: AuthProfileService

    // Core dependencies
    ca: CertificateAuthority
    proxy: MitmProxyServer

    // Authentication
    token?: string
    isAuthenticated: boolean
}

/**
 * Creates the tRPC context for each request
 */
export function createTRPCContext(
    projectService: ProjectService,
    transactionService: TransactionService,
    authProfileService: AuthProfileService,
    ca: CertificateAuthority,
    proxy: MitmProxyServer,
    token?: string
) {
    return ({ req, res }: CreateFastifyContextOptions): TRPCContext => {
        // Check authentication
        let isAuthenticated = true
        if (token) {
            const authHeader = String(req.headers['authorization'] || '')
            const match = /^Bearer\s+(.+)$/i.exec(authHeader)
            isAuthenticated = match ? match[1] === token : false
        }

        return {
            req,
            res,
            projectService,
            transactionService,
            authProfileService,
            ca,
            proxy,
            token,
            isAuthenticated,
        }
    }
}

export type Context = TRPCContext
