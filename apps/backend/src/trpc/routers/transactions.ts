import { router, publicProcedure, z } from '../init'

export const transactionsRouter = router({
    getFullTransaction: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const transaction = await ctx.transactionService.getFullTransaction(
                input.id
            )
            return { transaction }
        }),

    getByHost: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                hostId: z.string(),
                limit: z.number().min(1).max(100).default(50),
                offset: z.number().min(0).default(0),
                includeRelatedData: z.boolean().default(false),
            })
        )
        .query(async ({ ctx, input }) => {
            const transactions =
                await ctx.transactionService.getTransactionsByHost(
                    input.projectId,
                    input.hostId,
                    {
                        limit: input.limit,
                        offset: input.offset,
                        includeRelatedData: input.includeRelatedData,
                    }
                )
            return { transactions }
        }),

    getCountByHost: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                hostId: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            const count =
                await ctx.transactionService.getTransactionCountByHost(
                    input.projectId,
                    input.hostId
                )
            return { count }
        }),
})
