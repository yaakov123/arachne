import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import type {
  HealthResponse,
  CertResponse,
  ProxyStartResponse,
  ProxyStopResponse,
  ProxyErrorResponse,
  CACreateResponse,
  CAErrorResponse,
  CATrustInstructionsResponse,
  ProxyStatusResponse,
  CAStatusResponse,
} from '@arachne/api-types'
import { getTrustInstructions } from '@arachne/os'

interface ApiOptions {
  prefix: string
  token?: string
  ca: CertificateAuthority
  proxy?: MitmProxyServer
}

export async function registerApi(app: FastifyInstance, opts: ApiOptions) {
  const { prefix, token, ca, proxy } = opts

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





  app.get(`${prefix}/cert`, { preHandler: auth }, async (_req, rep) => {
    // Check in-memory first, then filesystem
    let certPem = ca.caCert
    if (!certPem) {
      // Try to load from filesystem
      const certPath = ca.certStore.caCertPath()
      certPem = ca.certStore.readFileIfExists(certPath)
    }
    
    if (certPem) {
      const res: CertResponse = { pem: certPem }
      rep.send(res)
    } else {
      // Certificate doesn't exist in memory or filesystem
      rep.code(404).send({ error: 'Certificate not found', message: 'Root CA certificate has not been created yet. Use the CA management endpoints to create one.' })
    }
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
  app.get(`${prefix}/ca/status`, { preHandler: auth }, async (_req, rep) => {
    // Check filesystem for certificate existence, not just in-memory state
    const certPath = ca.certStore.caCertPath()
    const keyPath = ca.certStore.caKeyPath()
    const certExists = !!ca.certStore.readFileIfExists(certPath)
    const keyExists = !!ca.certStore.readFileIfExists(keyPath)
    const exists = certExists && keyExists
    
    const response: CAStatusResponse = {
      ok: true,
      exists,
      message: exists 
        ? 'Root CA certificate exists on filesystem' 
        : 'Root CA certificate not found on filesystem'
    }
    rep.send(response)
  })

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

  app.get(`${prefix}/ca/trust-instructions`, { preHandler: auth }, async (_req, rep) => {
    try {
      // Check if certificate exists on filesystem first
      const certPath = ca.certStore.caCertPath()
      const certExists = !!ca.certStore.readFileIfExists(certPath)
      
      if (!certExists) {
        const response: CAErrorResponse = {
          ok: false,
          error: 'Certificate not found',
          message: 'Root CA certificate has not been created yet. Create the certificate first.'
        }
        rep.code(404).send(response)
        return
      }
      
      const instructions = await getTrustInstructions(certPath)
      const response: CATrustInstructionsResponse = {
        ok: true,
        trustCommand: instructions.trustCommand,
        untrustCommands: instructions.untrustCommands,
        certPath
      }
      rep.send(response)
    } catch (error) {
      const response: CAErrorResponse = {
        ok: false,
        error: 'Failed to get trust instructions',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
      rep.code(500).send(response)
    }
  })
}
