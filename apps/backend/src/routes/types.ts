import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import type { ProjectService } from '../services/project-service'
import { TransactionService } from '../services/transaction-service'

export interface RouteOptions {
    prefix: string
    token?: string
    ca: CertificateAuthority
    proxy: MitmProxyServer
    projectService: ProjectService
    transactionService: TransactionService
}

export type AuthMiddleware = (
    req: FastifyRequest,
    rep: FastifyReply
) => Promise<void>

export function createAuthMiddleware(token?: string): AuthMiddleware {
    return async (req, rep) => {
        if (!token) return
        const authH = String(req.headers['authorization'] || '')
        const m = /^Bearer\s+(.+)$/i.exec(authH)
        if (!m || m[1] !== token) {
            return rep.code(401).send({ error: 'Unauthorized' })
        }
    }
}
