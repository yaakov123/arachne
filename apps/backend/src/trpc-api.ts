import type { FastifyInstance } from 'fastify'
import {
    fastifyTRPCPlugin,
    FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import type { ProjectService } from './services/project.service'
import type { TransactionService } from './services/transaction.service'
import type { AuthProfileService } from './services/auth-profile.service'
import { AppRouter, appRouter, createTRPCContext } from './trpc'

interface TRPCApiOptions {
    prefix: string
    token?: string
    ca: CertificateAuthority
    proxy: MitmProxyServer
    projectService: ProjectService
    transactionService: TransactionService
    authProfileService: AuthProfileService
}

export async function registerTRPCApi(
    app: FastifyInstance,
    opts: TRPCApiOptions
) {
    // Create the context factory with the provided dependencies
    const createContext = createTRPCContext(
        opts.projectService,
        opts.transactionService,
        opts.authProfileService,
        opts.ca,
        opts.proxy,
        opts.token
    )

    // Register the tRPC plugin with Fastify with WebSocket support
    await app.register(fastifyTRPCPlugin, {
        prefix: opts.prefix,
        useWSS: true,
        // Enable heartbeat messages to keep connection open (disabled by default)
        keepAlive: {
            enabled: true,
            // server ping message interval in milliseconds
            pingMs: 30000,
            // connection is terminated if pong message is not received in this many milliseconds
            pongWaitMs: 5000,
        },
        trpcOptions: {
            router: appRouter,
            createContext,
            onError({ path, error }) {
                // Log tRPC errors for debugging
                console.error(
                    `❌ tRPC failed on ${path ?? '<no-path>'}:`,
                    error
                )
            },
        } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
    })
}
