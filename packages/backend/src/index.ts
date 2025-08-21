import fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import {
    MitmProxyServer,
    CertificateAuthority,
    getDefaultCertStoreOptions,
} from '@arachne/proxy'
import { createRecorderPlugin, FileStorageAdapter } from '@arachne/recorder'
import { createBroadcastPlugin } from './broadcast-plugin'
import { WsHub } from './ws-hub'
import { registerApi } from './api'

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
    const hub = new WsHub({ token: BACKEND_TOKEN })
    hub.start()

    await app.register(websocket)
    app.get(BACKEND_WS_PATH, { websocket: true }, (conn, req) => {
        const rawUrl = req.raw.url || BACKEND_WS_PATH
        const base = `http://${req.headers.host || 'localhost'}`
        const u = new URL(rawUrl, base)
        hub.handleConnection(conn.socket, u)
    })

    // Recorder storage and plugin
    const storage = new FileStorageAdapter({ outDir: REC_OUT_DIR })
    const { plugin: recorderPlugin } = createRecorderPlugin({
        storage,
        maxCaptureBytes: REC_MAX_BYTES,
    })

    // Broadcast plugin
    const broadcastPlugin = createBroadcastPlugin({
        hub,
        maxSampleBytes: REC_MAX_BYTES,
    })

    // Certificate Authority
    const store = CA_BASE_DIR
        ? { baseDir: CA_BASE_DIR }
        : getDefaultCertStoreOptions()
    const ca = new CertificateAuthority({ store })
    await ca.ensureRootCA()

    // API routes
    await registerApi(app, {
        prefix: BACKEND_API_PREFIX,
        token: BACKEND_TOKEN,
        storage,
        ca,
    })

    // Start HTTP server first
    await app.listen({ host: BACKEND_HOST, port: BACKEND_PORT })
    app.log.info(`Backend listening on http://${BACKEND_HOST}:${BACKEND_PORT}`)
    app.log.info(`WS at ${BACKEND_WS_PATH}`)

    // Start Proxy with plugins (broadcast first to allow interception before recorder)
    const proxy = new MitmProxyServer({
        host: PROXY_HOST,
        port: PROXY_PORT,
        ca,
        plugins: [broadcastPlugin, recorderPlugin],
    })
    await proxy.start()
    app.log.info(`Proxy listening on ${PROXY_HOST}:${PROXY_PORT}`)

    let stopping = false
    const shutdown = async (signal: string) => {
        try {
            app.log.info(`Shutting down on ${signal}...`)
            if (stopping) return
            stopping = true
            hub.stop()
            await proxy.stop()
            await app.close()
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

export { main }
