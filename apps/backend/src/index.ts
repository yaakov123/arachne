import fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import {
    MitmProxyServer,
    CertificateAuthority,
    getDefaultCertStoreOptions,
} from '@arachne/proxy'
import { EventEmitter } from 'events'
import { createTransactionAggregatorPlugin } from './plugins/transaction-aggregator-plugin'
import { BroadcastService } from './services/broadcast-service'
import { StorageService } from './services/storage-service'
import { WsHub } from './ws-hub'
import { registerTRPCApi } from './trpc-api'
import { logger } from './logger'
import { ProjectService } from './services/project-service'
import { buildProjectConfiguration } from './services/proxy-configuration-manager'
import { TransactionService } from './services/transaction-service'

function envNum(name: string, def: number): number {
    const v = process.env[name]
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) ? n : def
}

function envStr(name: string, def: string): string {
    const v = process.env[name]
    return v && v.length > 0 ? v : def
}

async function main() {
    const BACKEND_HOST = envStr('BACKEND_HOST', '127.0.0.1')
    const BACKEND_PORT = envNum('BACKEND_PORT', 8080)
    const BACKEND_API_PREFIX = envStr('BACKEND_API_PREFIX', '/api')
    const BACKEND_WS_PATH = envStr('BACKEND_WS_PATH', '/ws')
    const BACKEND_CORS = envStr('BACKEND_CORS', '*')
    const BACKEND_TOKEN = process.env['BACKEND_TOKEN']

    const PROXY_HOST = envStr('ARACHNE_PROXY_HOST', '127.0.0.1')
    const PROXY_PORT = envNum('ARACHNE_PROXY_PORT', 8899)
    const CA_BASE_DIR = process.env['ARACHNE_CA_STORE_DIR']

    const REC_OUT_DIR = process.env['ARACHNE_REC_OUT_DIR']
    const REC_MAX_BYTES = envNum('ARACHNE_REC_MAX_BYTES', 1024 * 1024)

    const PROJECTS_BASE_DIR = envStr('ARACHNE_PROJECTS_DIR', './projects')

    logger.info('Starting Arachne backend server', {
        backendHost: BACKEND_HOST,
        backendPort: BACKEND_PORT,
        proxyHost: PROXY_HOST,
        proxyPort: PROXY_PORT,
        recMaxBytes: REC_MAX_BYTES,
        hasToken: !!BACKEND_TOKEN,
        recOutDir: REC_OUT_DIR,
        projectsBaseDir: PROJECTS_BASE_DIR,
    })

    const app = fastify({ logger: true })

    // CORS
    const origin =
        BACKEND_CORS === '*'
            ? true
            : BACKEND_CORS.split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
    await app.register(cors, {
        origin,
        allowedHeaders: ['Authorization', 'Content-Type'],
    })

    // WebSocket Hub
    const hub = new WsHub()
    hub.start()

    // Project Service
    const projectService = new ProjectService()
    const transactionService = new TransactionService()

    projectService.on('projectChanged', async (id) => {
        const project = await projectService.getProject(id)
        if (project) {
            proxy.updateConfiguration(
                buildProjectConfiguration(project.settings)
            )
        }
    })

    const currentProject = await projectService.initialize()

    // Ensure there's always a default project available
    logger.info('Current active project', {
        projectId: currentProject.id,
        projectName: currentProject.name,
    })

    await app.register(websocket)
    app.get(BACKEND_WS_PATH, { websocket: true }, (conn) => {
        const wsAny: any = (conn as any).socket ?? (conn as any)
        hub.handleConnection(wsAny)
    })

    // Event-driven architecture setup
    const transactionEvents = new EventEmitter()

    // Create services that listen to transaction events
    const broadcastService = new BroadcastService(hub, transactionEvents)
    const storageService = new StorageService(
        transactionService,
        projectService,
        transactionEvents
    )

    // Create the single plugin that emits events
    const transactionAggregatorPlugin = createTransactionAggregatorPlugin(
        transactionEvents,
        REC_MAX_BYTES
    )

    logger.info('Event-driven architecture initialized', {
        maxSampleBytes: REC_MAX_BYTES,
        eventListeners: {
            broadcast: 'BroadcastService',
            storage: 'StorageService',
        },
    })

    // Certificate Authority
    const store = CA_BASE_DIR
        ? { baseDir: CA_BASE_DIR }
        : getDefaultCertStoreOptions()
    const ca = new CertificateAuthority({ store })
    // Certificate creation is now manually controlled from the UI

    // Create proxy instance with the single transaction aggregator plugin
    const proxy = new MitmProxyServer({
        host: PROXY_HOST,
        port: PROXY_PORT,
        ca,
        plugins: [transactionAggregatorPlugin],
    })

    // Health endpoint (traditional REST for monitoring)
    app.get('/health', async (_req, rep) => {
        rep.send({ ok: true })
    })

    // tRPC API routes
    await registerTRPCApi(app, {
        prefix: BACKEND_API_PREFIX,
        token: BACKEND_TOKEN,
        ca,
        proxy,
        projectService,
        transactionService,
    })

    // Start HTTP server first
    await app.listen({ host: BACKEND_HOST, port: BACKEND_PORT })
    app.log.info(`Backend listening on http://${BACKEND_HOST}:${BACKEND_PORT}`)
    app.log.info(`WS at ${BACKEND_WS_PATH}`)

    let stopping = false
    const shutdown = async (signal: string) => {
        try {
            app.log.info(`Shutting down on ${signal}...`)
            if (stopping) return
            stopping = true

            // Clean up event-driven services
            logger.info('Cleaning up event-driven services...')
            broadcastService.cleanup()
            storageService.cleanup()

            projectService.cleanup()
            // Stop other services
            hub.stop()
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

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
