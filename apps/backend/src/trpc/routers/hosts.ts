import { TRPCError } from '@trpc/server'
import { router, publicProcedure, z } from '../init'
import { HostRepository } from '@arachne/database'

const hostRepository = new HostRepository()

export const hostsRouter = router({
    // List hosts for a specific project
    list: publicProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ input }) => {
            try {
                const hosts = await hostRepository.findHostWithTransactionCount(
                    input.projectId
                )
                return hosts
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to list hosts',
                    cause: error,
                })
            }
        }),

    // Get host by ID with endpoints
    getById: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            try {
                const host = await hostRepository.findHostWithTransactionCount(
                    input.id
                )
                if (!host) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Host ${input.id} was not found`,
                    })
                }
                return { host }
            } catch (error) {
                if (error instanceof TRPCError) throw error
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get host',
                    cause: error,
                })
            }
        }),

    // Get analytics summary
    getAnalyticsSummary: publicProcedure.query(async () => {
        try {
            const summary = await hostRepository.getAnalyticsSummary()
            return { summary }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get analytics summary',
                cause: error,
            })
        }
    }),

    // Get top endpoints across all hosts
    getTopEndpoints: publicProcedure
        .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
        .query(async ({ input }) => {
            try {
                const endpoints = await hostRepository.getTopEndpoints(
                    input.limit
                )
                return { endpoints }
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get top endpoints',
                    cause: error,
                })
            }
        }),

    // Get endpoints for a specific host
    getEndpointsByHost: publicProcedure
        .input(
            z.object({
                hostId: z.string(),
                limit: z.number().min(1).max(100).default(10),
            })
        )
        .query(async ({ input }) => {
            try {
                const endpoints = await hostRepository.getTopEndpointsByHost(
                    input.hostId,
                    input.limit
                )
                return { endpoints }
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get endpoints for host',
                    cause: error,
                })
            }
        }),
})
