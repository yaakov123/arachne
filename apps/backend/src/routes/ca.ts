import type { FastifyInstance } from 'fastify'
import type {
    CACreateResponse,
    CAErrorResponse,
    CATrustInstructionsResponse,
    CAStatusResponse,
} from '@arachne/api-types'
import { getTrustInstructions } from '@arachne/os'
import type { RouteOptions } from './types'

export function registerCARoutes(
    app: FastifyInstance,
    opts: Pick<RouteOptions, 'prefix' | 'ca'>
) {
    const { prefix, ca } = opts

    // Get CA status
    app.get(`${prefix}/ca/status`, async (_req, rep) => {
        // Check filesystem for certificate existence, not just in-memory state
        const certPath = ca.certStore.caCertPath()
        const keyPath = ca.certStore.caKeyPath()
        const certExists = !!ca.certStore.readFileIfExists(certPath)
        const keyExists = !!ca.certStore.readFileIfExists(keyPath)
        const exists = certExists && keyExists

        const response: CAStatusResponse = {
            exists,
            message: exists
                ? 'Root CA certificate exists on filesystem'
                : 'Root CA certificate not found on filesystem',
        }
        rep.send(response)
    })

    // Create CA
    app.post(`${prefix}/ca/create`, async (_req, rep) => {
        try {
            const result = await ca.ensureRootCA()
            const response: CACreateResponse = {
                message: 'Root CA created/ensured successfully',
                certPem: result.certPem,
            }
            rep.send(response)
        } catch (error) {
            const response: CAErrorResponse = {
                error: 'Failed to create Root CA',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(500).send(response)
        }
    })

    // Get trust instructions
    app.get(
        `${prefix}/ca/trust-instructions`,

        async (_req, rep) => {
            try {
                // Check if certificate exists on filesystem first
                const certPath = ca.certStore.caCertPath()
                const certExists = !!ca.certStore.readFileIfExists(certPath)

                if (!certExists) {
                    const response: CAErrorResponse = {
                        error: 'Certificate not found',
                        message:
                            'Root CA certificate has not been created yet. Create the certificate first.',
                    }
                    rep.code(404).send(response)
                    return
                }

                const instructions = await getTrustInstructions(certPath)
                const response: CATrustInstructionsResponse = {
                    trustCommand: instructions.trustCommand,
                    untrustCommands: instructions.untrustCommands,
                    certPath,
                }
                rep.send(response)
            } catch (error) {
                const response: CAErrorResponse = {
                    error: 'Failed to get trust instructions',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )
}
