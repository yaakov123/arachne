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
})
