import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Context } from './context'
import superjson from 'superjson'

/**
 * Initialize tRPC with the context
 */
const t = initTRPC.context<Context>().create({
    transformer: superjson,
})

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure

/**
 * Protected procedure - requires authentication if token is configured
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.token && !ctx.isAuthenticated) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
        })
    }
    return next()
})

/**
 * Router builder
 */
export const router = t.router

/**
 * Middleware builder
 */
export const middleware = t.middleware

/**
 * Common validation schemas
 */
export const schemas = {
    id: z.string().min(1, 'ID is required'),
    pagination: z
        .object({
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
        })
        .optional(),
}

export { z }
