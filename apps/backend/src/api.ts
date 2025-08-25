import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import * as http from 'http'
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
  RepeatRequestBody,
  RepeatResponse,
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

  // Repeater functionality
  app.post(`${prefix}/repeater/send`, { preHandler: auth }, async (req, rep) => {
    try {
      const { originalTransactionId, transaction } = req.body as RepeatRequestBody
      
      if (!proxy || !proxy.isRunning()) {
        const response: RepeatResponse = {
          ok: false,
          message: 'Proxy is not running',
          error: 'Cannot repeat request when proxy is not running'
        }
        rep.code(400).send(response)
        return
      }

      // Create repeater metadata header
      const repeaterMeta = {
        source: 'repeater',
        originalId: originalTransactionId,
        timestamp: Date.now()
      }
      
      // Prepare headers - convert DisplayHeader[] to the format needed for HTTP request
      const headers: Record<string, string> = {}
      transaction.request.headers.forEach(h => {
        headers[h.name] = h.value
      })
      
      // Add special header to track this as a repeater request
      headers['X-Arachne-Repeater'] = JSON.stringify(repeaterMeta)
      
      // Get proxy server info
      const serverInfo = proxy.getServerInfo()
      if (!serverInfo) {
        const response: RepeatResponse = {
          ok: false,
          message: 'Proxy server info not available',
          error: 'Cannot get proxy server configuration'
        }
        rep.code(500).send(response)
        return
      }

      // Prepare body for sending
      let body: string | Buffer | undefined = undefined
      if (transaction.request.body?.sample) {
        const sample = transaction.request.body.sample
        const encoding = transaction.request.body.content.encoding
        
        if (encoding === 'base64') {
          body = Buffer.from(sample, 'base64')
        } else {
          body = sample
        }
      }

      // Send HTTP request through our own proxy using original request data
      await sendRepeaterRequest({
        proxyHost: serverInfo.host,
        proxyPort: serverInfo.port,
        method: transaction.request.method,
        url: transaction.request.url.full,
        headers,
        body
      })
      
      const response: RepeatResponse = { 
        ok: true, 
        message: 'Request repeated successfully' 
      }
      rep.send(response)
    } catch (error) {
      const response: RepeatResponse = {
        ok: false,
        message: 'Failed to repeat request',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      rep.code(500).send(response)
    }
  })
}

// Helper function to send requests through the proxy
async function sendRepeaterRequest(options: {
  proxyHost: string
  proxyPort: number
  method: string
  url: string
  headers: Record<string, string>
  body?: string | Buffer
}): Promise<void> {
  const { proxyHost, proxyPort, method, url, headers, body } = options
  
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: proxyHost,
      port: proxyPort,
      method,
      path: url,
      headers
    }, (res) => {
      // Consume the response to complete the request
      res.on('data', () => {})
      res.on('end', () => {
        resolve()
      })
      res.on('error', (err) => {
        reject(err)
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    if (body) {
      req.write(body)
    }
    
    req.end()
  })
}
