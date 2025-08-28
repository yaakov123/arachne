import type { FastifyInstance } from 'fastify'
import {
    fastifyTRPCPlugin,
    FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify'
import type { CertificateAuthority, MitmProxyServer } from '@arachne/proxy'
import type { ProjectService } from './services/project-service'
import type { TransactionService } from './services/transaction-service'
import { AppRouter, appRouter, createTRPCContext } from './trpc'

interface TRPCApiOptions {
    prefix: string
    token?: string
    ca: CertificateAuthority
    proxy: MitmProxyServer
    projectService: ProjectService
    transactionService: TransactionService
}

export async function registerTRPCApi(
    app: FastifyInstance,
    opts: TRPCApiOptions
) {
    // Create the context factory with the provided dependencies
    const createContext = createTRPCContext(
        opts.projectService,
        opts.transactionService,
        opts.ca,
        opts.proxy,
        opts.token
    )

    // Register the tRPC plugin with Fastify
    await app.register(fastifyTRPCPlugin, {
        prefix: opts.prefix,
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
