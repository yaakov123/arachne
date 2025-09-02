import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '../init'
import { buildProjectConfiguration } from '../../services/proxy-configuration.service'

export const proxyRouter = router({
    // Start proxy
    start: publicProcedure.mutation(async ({ ctx }) => {
        try {
            const currentProject = await ctx.projectService.getCurrentProject()
            if (currentProject) {
                ctx.proxy.updateConfiguration(
                    buildProjectConfiguration(currentProject.settings)
                )
            }

            const serverInfo = await ctx.proxy.start()
            return {
                message: 'Proxy started successfully',
                serverInfo,
            }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to start proxy',
                cause: error,
            })
        }
    }),

    // Stop proxy
    stop: publicProcedure.mutation(async ({ ctx }) => {
        try {
            await ctx.proxy.stop()
            return {
                message: 'Proxy stopped successfully',
            }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to stop proxy',
                cause: error,
            })
        }
    }),

    // Get proxy status
    status: publicProcedure.query(async ({ ctx }) => {
        try {
            const isRunning = ctx.proxy.isRunning()
            const serverInfo = ctx.proxy.getServerInfo() ?? undefined

            return {
                isRunning,
                serverInfo,
            }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get proxy status',
                cause: error,
            })
        }
    }),
})
