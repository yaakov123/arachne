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
    ProjectListResponse,
    ProjectResponse,
    ProjectCreateResponse,
    ProjectErrorResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '@arachne/api-types'
import { getTrustInstructions } from '@arachne/os'
import type { ProjectService } from './services/project-service'

interface ApiOptions {
    prefix: string
    token?: string
    ca: CertificateAuthority
    proxy: MitmProxyServer
    projectService: ProjectService
}

export async function registerApi(app: FastifyInstance, opts: ApiOptions) {
    const { prefix, token, ca, proxy, projectService } = opts

    const auth: (
        req: FastifyRequest,
        rep: FastifyReply
    ) => Promise<void> = async (req, rep) => {
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
            rep.code(404).send({
                error: 'Certificate not found',
                message:
                    'Root CA certificate has not been created yet. Use the CA management endpoints to create one.',
            })
        }
    })

    // Proxy management routes
    app.post(
        `${prefix}/proxy/start`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                const serverInfo = await proxy.start()
                const response: ProxyStartResponse = {
                    ok: true,
                    message: 'Proxy started successfully',
                    serverInfo,
                }
                rep.send(response)
            } catch (error) {
                const response: ProxyErrorResponse = {
                    ok: false,
                    error: 'Failed to start proxy',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    app.post(
        `${prefix}/proxy/stop`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                await proxy.stop()
                const response: ProxyStopResponse = {
                    ok: true,
                    message: 'Proxy stopped successfully',
                }
                rep.send(response)
            } catch (error) {
                const response: ProxyErrorResponse = {
                    ok: false,
                    error: 'Failed to stop proxy',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    app.get(
        `${prefix}/proxy/status`,
        { preHandler: auth },
        async (_req, rep) => {
            const isRunning = proxy.isRunning()
            const response: ProxyStatusResponse = {
                ok: true,
                isRunning,
                serverInfo: proxy.getServerInfo() ?? undefined,
            }
            rep.send(response)
        }
    )

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
                : 'Root CA certificate not found on filesystem',
        }
        rep.send(response)
    })

    app.post(`${prefix}/ca/create`, { preHandler: auth }, async (_req, rep) => {
        try {
            const result = await ca.ensureRootCA()
            const response: CACreateResponse = {
                ok: true,
                message: 'Root CA created/ensured successfully',
                certPem: result.certPem,
            }
            rep.send(response)
        } catch (error) {
            const response: CAErrorResponse = {
                ok: false,
                error: 'Failed to create Root CA',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(500).send(response)
        }
    })

    app.get(
        `${prefix}/ca/trust-instructions`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                // Check if certificate exists on filesystem first
                const certPath = ca.certStore.caCertPath()
                const certExists = !!ca.certStore.readFileIfExists(certPath)

                if (!certExists) {
                    const response: CAErrorResponse = {
                        ok: false,
                        error: 'Certificate not found',
                        message:
                            'Root CA certificate has not been created yet. Create the certificate first.',
                    }
                    rep.code(404).send(response)
                    return
                }

                const instructions = await getTrustInstructions(certPath)
                const response: CATrustInstructionsResponse = {
                    ok: true,
                    trustCommand: instructions.trustCommand,
                    untrustCommands: instructions.untrustCommands,
                    certPath,
                }
                rep.send(response)
            } catch (error) {
                const response: CAErrorResponse = {
                    ok: false,
                    error: 'Failed to get trust instructions',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    // Repeater functionality
    app.post(
        `${prefix}/repeater/send`,
        { preHandler: auth },
        async (req, rep) => {
            try {
                const { originalTransactionId, transaction } =
                    req.body as RepeatRequestBody

                if (!proxy || !proxy.isRunning()) {
                    const response: RepeatResponse = {
                        ok: false,
                        message: 'Proxy is not running',
                        error: 'Cannot repeat request when proxy is not running',
                    }
                    rep.code(400).send(response)
                    return
                }

                // Create repeater metadata header
                const repeaterMeta = {
                    source: 'repeater',
                    originalId: originalTransactionId,
                    timestamp: Date.now(),
                }

                // Prepare headers - convert DisplayHeader[] to the format needed for HTTP request
                const headers: Record<string, string> = {}
                transaction.request.headers.forEach((h) => {
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
                        error: 'Cannot get proxy server configuration',
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
                    body,
                })

                const response: RepeatResponse = {
                    ok: true,
                    message: 'Request repeated successfully',
                }
                rep.send(response)
            } catch (error) {
                const response: RepeatResponse = {
                    ok: false,
                    message: 'Failed to repeat request',
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    // Project management routes
    // List all projects
    app.get(`${prefix}/projects`, { preHandler: auth }, async (_req, rep) => {
        try {
            const projects = await projectService.listProjects()
            const response: ProjectListResponse = {
                ok: true,
                projects,
            }
            rep.send(response)
        } catch (error) {
            const response: ProjectErrorResponse = {
                ok: false,
                error: 'Failed to list projects',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(500).send(response)
        }
    })

    // Create new project
    app.post(`${prefix}/projects`, { preHandler: auth }, async (req, rep) => {
        try {
            const createRequest = req.body as CreateProjectRequest
            const project = await projectService.createProject(createRequest)
            const response: ProjectCreateResponse = {
                ok: true,
                project,
                message: 'Project created successfully',
            }
            rep.code(201).send(response)
        } catch (error) {
            const response: ProjectErrorResponse = {
                ok: false,
                error: 'Failed to create project',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(400).send(response)
        }
    })

    // Get specific project
    app.get(
        `${prefix}/projects/:id`,
        { preHandler: auth },
        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }
                const project = await projectService.getProject(id)
                const response: ProjectResponse = {
                    ok: true,
                    project,
                }
                rep.send(response)
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to get project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 500
                rep.code(statusCode).send(response)
            }
        }
    )

    // Update project
    app.put(
        `${prefix}/projects/:id`,
        { preHandler: auth },
        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }
                const updateRequest = req.body as UpdateProjectRequest
                const project = await projectService.updateProject(
                    id,
                    updateRequest
                )
                const response: ProjectResponse = {
                    ok: true,
                    project,
                }
                rep.send(response)
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to update project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 400
                rep.code(statusCode).send(response)
            }
        }
    )

    // Delete project
    app.delete(
        `${prefix}/projects/:id`,
        { preHandler: auth },
        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }
                await projectService.deleteProject(id)
                rep.code(204).send()
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to delete project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 500
                rep.code(statusCode).send(response)
            }
        }
    )

    // Get project transactions
    app.get(
        `${prefix}/projects/:id/transactions`,
        { preHandler: auth },
        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }

                const transactions = await projectService.getTransactions(id)
                rep.send({
                    ok: true,
                    transactions,
                    total: transactions.length,
                })
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to get project transactions',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 500
                rep.code(statusCode).send(response)
            }
        }
    )

    // Set current project (for active recording)
    app.post(
        `${prefix}/projects/:id/activate`,
        { preHandler: auth },
        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }

                // Verify project exists
                if (
                    id !== 'none' &&
                    !(await projectService.projectExists(id))
                ) {
                    const response: ProjectErrorResponse = {
                        ok: false,
                        error: 'Project not found',
                        message: `Project ${id} does not exist`,
                    }
                    rep.code(404).send(response)
                    return
                }

                projectService.setCurrentProject(id === 'none' ? null : id)
                rep.send({
                    ok: true,
                    message:
                        id === 'none'
                            ? 'No project is now active'
                            : `Project ${id} is now active`,
                    currentProject: projectService.getCurrentProject(),
                })
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to activate project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    // Get current active project
    app.get(
        `${prefix}/projects/current`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                const currentProjectId = projectService.getCurrentProject()
                if (!currentProjectId) {
                    rep.send({
                        ok: true,
                        currentProject: null,
                        message: 'No project is currently active',
                    })
                    return
                }

                const project = await projectService.getProject(
                    currentProjectId
                )
                rep.send({
                    ok: true,
                    currentProject: currentProjectId,
                    project,
                })
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to get current project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )
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
        const req = http.request(
            {
                hostname: proxyHost,
                port: proxyPort,
                method,
                path: url,
                headers,
            },
            (res) => {
                // Consume the response to complete the request
                res.on('data', () => {})
                res.on('end', () => {
                    resolve()
                })
                res.on('error', (err) => {
                    reject(err)
                })
            }
        )

        req.on('error', (err) => {
            reject(err)
        })

        if (body) {
            req.write(body)
        }

        req.end()
    })
}
