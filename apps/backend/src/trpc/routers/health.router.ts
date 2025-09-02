import { router, publicProcedure } from '../init'

export const healthRouter = router({
    // Health check
    check: publicProcedure.query(async () => {
        return { ok: true }
    }),
})
