import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import type { StorageAdapter } from '@arachne/recorder'
import type {
  InventoryTree,
  HostRecord,
  HealthResponse,
  CertResponse,
  ProxyStartResponse,
  ProxyStopResponse,
  ProxyErrorResponse,
  CACreateResponse,
  CATrustResponse,
  CAErrorResponse,
  ProxyStatusResponse,
} from '@arachne/api-types'
import { installRootCATrust, uninstallRootCATrust, type TrustResult } from '@arachne/os'

interface ApiOptions {
  prefix: string
  token?: string
  storage: StorageAdapter
  ca: CertificateAuthority
  proxy?: MitmProxyServer
}

export async function registerApi(app: FastifyInstance, opts: ApiOptions) {
  const { prefix, token, storage, ca, proxy } = opts

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
    const res: HealthResponse = { ok: true }
    rep.send(res)
  })

  app.get(`${prefix}/inventory`, { preHandler: auth }, async (_req, rep) => {
    const inv = storage.snapshot() as unknown as InventoryTree
    rep.send(inv)
  })

  app.get(`${prefix}/hosts`, { preHandler: auth }, async (_req, rep) => {
    const inv = storage.snapshot() as unknown as InventoryTree
    const hosts = Object.keys(inv.hosts || {})
    rep.send(hosts)
  })

  app.get(`${prefix}/hosts/:host`, { preHandler: auth }, async (req, rep) => {
    const inv = storage.snapshot() as unknown as InventoryTree
    const host = (req.params as any).host as string
    const data: HostRecord | undefined = (inv.hosts || {})[host]
    if (!data) return rep.code(404).send({ error: 'Not Found' })
    rep.send(data)
  })

  app.get(`${prefix}/cert`, { preHandler: auth }, async (_req, rep) => {
    // Ensure CA exists and return PEM
    const pem = ca.caCert || (await ca.ensureRootCA()).certPem
    const res: CertResponse = { pem }
    rep.send(res)
  })

  // Proxy management routes
  if (proxy) {
    app.post(`${prefix}/proxy/start`, { preHandler: auth }, async (_req, rep) => {
      try {
        const serverInfo = await proxy.start()
        const response: ProxyStartResponse = { 
          ok: true, 
          message: 'Proxy started successfully',
          serverInfo 
        }
        rep.send(response)
      } catch (error) {
        const response: ProxyErrorResponse = { 
          ok: false, 
          error: 'Failed to start proxy',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
        rep.code(500).send(response)
      }
    })

    app.post(`${prefix}/proxy/stop`, { preHandler: auth }, async (_req, rep) => {
      try {
        await proxy.stop()
        const response: ProxyStopResponse = { 
          ok: true, 
          message: 'Proxy stopped successfully'
        }
        rep.send(response)
      } catch (error) {
        const response: ProxyErrorResponse = { 
          ok: false, 
          error: 'Failed to stop proxy',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
        rep.code(500).send(response)
      }
    })

    app.get(`${prefix}/proxy/status`, { preHandler: auth }, async (_req, rep) => {
      const isRunning = proxy.isRunning()
      const response: ProxyStatusResponse = {
        ok: true,
        isRunning,
        serverInfo: proxy.getServerInfo() ?? undefined
      }
      rep.send(response)
    })  
  }

  // Certificate Authority management routes
  app.post(`${prefix}/ca/create`, { preHandler: auth }, async (_req, rep) => {
    try {
      const result = await ca.ensureRootCA()
      const response: CACreateResponse = {
        ok: true,
        message: 'Root CA created/ensured successfully',
        certPem: result.certPem
      }
      rep.send(response)
    } catch (error) {
      const response: CAErrorResponse = {
        ok: false,
        error: 'Failed to create Root CA',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
      rep.code(500).send(response)
    }
  })

  app.post(`${prefix}/ca/trust`, { preHandler: auth }, async (_req, rep) => {
    try {
      // Ensure CA exists first
      await ca.ensureRootCA()
      const result: TrustResult = await installRootCATrust(ca.certStore)
      const response: CATrustResponse = {
        ok: result.ok,
        message: result.message,
        code: result.code
      }
      rep.send(response)
    } catch (error) {
      const response: CAErrorResponse = {
        ok: false,
        error: 'Failed to trust Root CA',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
      rep.code(500).send(response)
    }
  })

  app.post(`${prefix}/ca/untrust`, { preHandler: auth }, async (_req, rep) => {
    try {
      const result: TrustResult = await uninstallRootCATrust()
      const response: CATrustResponse = {
        ok: result.ok,
        message: result.message,
        code: result.code
      }
      rep.send(response)
    } catch (error) {
      const response: CAErrorResponse = {
        ok: false,
        error: 'Failed to untrust Root CA',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
      rep.code(500).send(response)
    }
  })
}
