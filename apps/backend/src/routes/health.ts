import type { FastifyInstance } from 'fastify'
import type { HealthResponse } from '@arachne/api-types'

export function registerHealthRoutes(app: FastifyInstance) {
    app.get('/health', async (_req, rep) => {
        const res: HealthResponse = { ok: true }
        rep.send(res)
    })
}
