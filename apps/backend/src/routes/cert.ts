import type { FastifyInstance } from 'fastify'
import type { CertResponse } from '@arachne/api-types'
import type { RouteOptions, AuthMiddleware } from './types'

export function registerCertRoutes(
    app: FastifyInstance,
    opts: Pick<RouteOptions, 'prefix' | 'ca'>,
    auth: AuthMiddleware
) {
    const { prefix, ca } = opts

    app.get(`${prefix}/cert`, { preHandler: auth }, async (_req, rep) => {
        // Check in-memory first, then filesystem
        let certPem = ca.caCert
        if (!certPem) {
            // Try to load from filesystem
            const certPath = ca.certStore.caCertPath()
            certPem = ca.certStore.readFileIfExists(certPath)
        }

        if (certPem) {
            const res: CertResponse = { pem: certPem }
            rep.send(res)
        } else {
            // Certificate doesn't exist in memory or filesystem
            rep.code(404).send({
                error: 'Certificate not found',
                message:
                    'Root CA certificate has not been created yet. Use the CA management endpoints to create one.',
            })
        }
    })
}
