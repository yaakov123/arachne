import { router, publicProcedure, z } from '../init'

// Define the unified filter schema
const transactionFiltersSchema = z.object({
    projectId: z.string(),
    hostId: z.string().optional(),
    searchQuery: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
    includeRelatedData: z.boolean().default(false),
})

export const transactionsRouter = router({
    getFullTransaction: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const transaction = await ctx.transactionService.getFullTransaction(
                input.id
            )
            return { transaction }
        }),

    // New unified filtering endpoint
    getFiltered: publicProcedure
        .input(transactionFiltersSchema)
        .query(async ({ ctx, input }) => {
            const result =
                await ctx.transactionService.getFilteredTransactionsWithCount(
                    input
                )
            return result
        }),

    // Legacy endpoints - kept for backward compatibility
    // TODO: Deprecate these endpoints in favor of getFiltered
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

    // TODO: Deprecate this endpoint in favor of getFiltered
    search: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                query: z.string(),
                limit: z.number().min(1).max(100).default(50),
                offset: z.number().min(0).default(0),
                hostId: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const transactions =
                await ctx.transactionService.searchTransactions(
                    input.projectId,
                    input.query,
                    {
                        limit: input.limit,
                        offset: input.offset,
                        hostId: input.hostId,
                    }
                )
            return { transactions }
        }),
})
