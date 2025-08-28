import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '../init'

export const certRouter = router({
    // Get certificate
    get: publicProcedure.query(async ({ ctx }) => {
        try {
            // Check in-memory first, then filesystem
            let certPem = ctx.ca.caCert
            if (!certPem) {
                // Try to load from filesystem
                const certPath = ctx.ca.certStore.caCertPath()
                certPem = ctx.ca.certStore.readFileIfExists(certPath)
            }

            if (certPem) {
                return { pem: certPem }
            } else {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message:
                        'Root CA certificate has not been created yet. Use the CA management endpoints to create one.',
                })
            }
        } catch (error) {
            if (error instanceof TRPCError) throw error
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get certificate',
                cause: error,
            })
        }
    }),
})
