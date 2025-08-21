import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { CertificateAuthority } from '@arachne/proxy'
import type { StorageAdapter, InventoryTree, HostRecord } from '@arachne/recorder'

interface ApiOptions {
  prefix: string
  token?: string
  storage: StorageAdapter
  ca: CertificateAuthority
}

export async function registerApi(app: FastifyInstance, opts: ApiOptions) {
  const { prefix, token, storage, ca } = opts

  const auth: (req: FastifyRequest, rep: FastifyReply) => Promise<void> = async (
    req,
    rep
  ) => {
    if (!token) return
    const authH = String(req.headers['authorization'] || '')
    const m = /^Bearer\s+(.+)$/i.exec(authH)
    if (!m || m[1] !== token) {
      return rep.code(401).send({ error: 'Unauthorized' })
    }
  }

  app.get('/health', async (_req, rep) => {
    rep.send({ ok: true })
  })

  app.get(`${prefix}/inventory`, { preHandler: auth }, async (_req, rep) => {
    const inv: InventoryTree = storage.snapshot()
    rep.send(inv)
  })

  app.get(`${prefix}/hosts`, { preHandler: auth }, async (_req, rep) => {
    const inv: InventoryTree = storage.snapshot()
    const hosts = Object.keys(inv.hosts || {})
    rep.send(hosts)
  })

  app.get(`${prefix}/hosts/:host`, { preHandler: auth }, async (req, rep) => {
    const inv: InventoryTree = storage.snapshot()
    const host = (req.params as any).host as string
    const data: HostRecord | undefined = (inv.hosts || {})[host]
    if (!data) return rep.code(404).send({ error: 'Not Found' })
    rep.send(data)
  })

  app.get(`${prefix}/cert`, { preHandler: auth }, async (_req, rep) => {
    // Ensure CA exists and return PEM
    const pem = ca.caCert || (await ca.ensureRootCA()).certPem
    rep.send({ pem })
  })
}
