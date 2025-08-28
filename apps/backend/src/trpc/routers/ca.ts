import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '../init'
import { getTrustInstructions } from '@arachne/os'

export const caRouter = router({
    // Get CA status
    status: publicProcedure.query(async ({ ctx }) => {
        try {
            // Check filesystem for certificate existence, not just in-memory state
            const certPath = ctx.ca.certStore.caCertPath()
            const keyPath = ctx.ca.certStore.caKeyPath()
            const certExists = !!ctx.ca.certStore.readFileIfExists(certPath)
            const keyExists = !!ctx.ca.certStore.readFileIfExists(keyPath)
            const exists = certExists && keyExists

            return {
                exists,
                message: exists
                    ? 'Root CA certificate exists on filesystem'
                    : 'Root CA certificate not found on filesystem',
            }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to check CA status',
                cause: error,
            })
        }
    }),

    // Create CA
    create: publicProcedure.mutation(async ({ ctx }) => {
        try {
            const result = await ctx.ca.ensureRootCA()
            return {
                message: 'Root CA created/ensured successfully',
                certPem: result.certPem,
            }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to create Root CA',
                cause: error,
            })
        }
    }),

    // Get trust instructions
    getTrustInstructions: publicProcedure.query(async ({ ctx }) => {
        try {
            // Check if certificate exists on filesystem first
            const certPath = ctx.ca.certStore.caCertPath()
            const certExists = !!ctx.ca.certStore.readFileIfExists(certPath)

            if (!certExists) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message:
                        'Root CA certificate has not been created yet. Create the certificate first.',
                })
            }

            const instructions = await getTrustInstructions(certPath)
            return {
                trustCommand: instructions.trustCommand,
                untrustCommands: instructions.untrustCommands,
                certPath,
            }
        } catch (error) {
            if (error instanceof TRPCError) throw error
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get trust instructions',
                cause: error,
            })
        }
    }),
})
