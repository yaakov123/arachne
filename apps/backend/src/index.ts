import fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import {
    MitmProxyServer,
    CertificateAuthority,
    getDefaultCertStoreOptions,
} from '@arachne/proxy'
import { registerTRPCApi } from './trpc-api'
import { logger } from './logger'
import { buildProjectConfiguration } from './services/proxy-configuration-manager'
import { ServiceContainer } from './services/service-container'
import { AppConfig } from './types'
import { TransactionHandler } from './plugins/transaction-handler.plugin'
import { AuthExtracterPlugin } from './plugins/auth-extracter.plugin'

// Environment variable utilities
function envNum(name: string, def: number): number {
    const v = process.env[name]
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) ? n : def
}

function envStr(name: string, def: string): string {
    const v = process.env[name]
    return v && v.length > 0 ? v : def
}

function loadConfiguration(): AppConfig {
    return {
        backend: {
            host: envStr('BACKEND_HOST', '127.0.0.1'),
            port: envNum('BACKEND_PORT', 8080),
            apiPrefix: envStr('BACKEND_API_PREFIX', '/api'),
            cors: envStr('BACKEND_CORS', '*'),
            token: process.env['BACKEND_TOKEN'],
        },
        proxy: {
            host: envStr('ARACHNE_PROXY_HOST', '127.0.0.1'),
            port: envNum('ARACHNE_PROXY_PORT', 8899),
            caBaseDir: process.env['ARACHNE_CA_STORE_DIR'],
        },
        recording: {
            outDir: process.env['ARACHNE_REC_OUT_DIR'],
            maxBytes: envNum('ARACHNE_REC_MAX_BYTES', 1024 * 1024),
        },
        projects: {
            baseDir: envStr('ARACHNE_PROJECTS_DIR', './projects'),
        },
    }
}

function logStartupInfo(config: AppConfig): void {
    logger.info('Starting Arachne backend server', {
        backendHost: config.backend.host,
        backendPort: config.backend.port,
        proxyHost: config.proxy.host,
        proxyPort: config.proxy.port,
        recMaxBytes: config.recording.maxBytes,
        hasToken: !!config.backend.token,
        recOutDir: config.recording.outDir,
        projectsBaseDir: config.projects.baseDir,
    })
}

async function setupServer(config: AppConfig) {
    const app = fastify({ logger: true })

    // CORS setup
    const origin =
        config.backend.cors === '*'
            ? true
            : config.backend.cors
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
    await app.register(cors, {
        origin,
        allowedHeaders: ['Authorization', 'Content-Type'],
    })

    // Register WebSocket support for tRPC (required for subscriptions)
    await app.register(websocket)

    // Health endpoint (traditional REST for monitoring)
    app.get('/health', async (_req, rep) => {
        rep.send({ ok: true })
    })

    return app
}

async function initializeServices(
    config: AppConfig
): Promise<ServiceContainer> {
    const container = new ServiceContainer()
    await container.initialize()

    logger.info('Event-driven architecture initialized', {
        maxSampleBytes: config.recording.maxBytes,
        eventListeners: {
            broadcast: 'BroadcastService',
            storage: 'StorageService',
        },
    })

    return container
}

function setupProxyServer(config: AppConfig, container: ServiceContainer) {
    // Certificate Authority
    const store = config.proxy.caBaseDir
        ? { baseDir: config.proxy.caBaseDir }
        : getDefaultCertStoreOptions()
    const ca = new CertificateAuthority({ store })

    // Create proxy instance with plugins
    const proxy = new MitmProxyServer({
        host: config.proxy.host,
        port: config.proxy.port,
        ca,
        plugins: [
            new TransactionHandler(
                container.storageService,
                container.projectService,
                container.broadcastService
            ),
            new AuthExtracterPlugin(
                container.storageService,
                container.projectService
            ),
        ],
    })

    // Set up project change handler
    container.projectService.on('projectChanged', async (id) => {
        const project = await container.projectService.getProject(id)
        if (project) {
            proxy.updateConfiguration(
                buildProjectConfiguration(project.settings)
            )
        }
    })

    return { ca, proxy }
}

function setupGracefulShutdown(
    app: any,
    proxy: any,
    container: ServiceContainer
) {
    let stopping = false
    const shutdown = async (signal: string) => {
        try {
            app.log.info(`Shutting down on ${signal}...`)
            if (stopping) return
            stopping = true

            // Clean up event-driven services
            logger.info('Cleaning up event-driven services...')
            container.cleanup()

            // Stop other services
            await proxy.stop()
            await app.close()

            logger.info('Shutdown complete')
        } catch (e) {
            console.error('Error during shutdown', e)
        } finally {
            process.exit(0)
        }
    }
    process.on('SIGINT', () => void shutdown('SIGINT'))
    process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

async function main() {
    const config = loadConfiguration()
    logStartupInfo(config)

    const app = await setupServer(config)
    const container = await initializeServices(config)
    const { ca, proxy } = setupProxyServer(config, container)

    // Register tRPC API routes
    await registerTRPCApi(app, {
        prefix: config.backend.apiPrefix,
        token: config.backend.token,
        ca,
        proxy,
        projectService: container.projectService,
        transactionService: container.transactionService,
        authProfileService: container.authProfileService,
    })

    // Start HTTP server
    await app.listen({ host: config.backend.host, port: config.backend.port })
    app.log.info(
        `Backend listening on http://${config.backend.host}:${config.backend.port}`
    )
    app.log.info(
        `tRPC WebSocket subscriptions available at ${config.backend.apiPrefix}`
    )

    // Set up graceful shutdown
    setupGracefulShutdown(app, proxy, container)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
