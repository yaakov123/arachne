import {
    createTRPCClient,
    createWSClient,
    wsLink,
    httpBatchLink,
    splitLink,
} from '@trpc/client'
import type { AppRouter } from '../types'
import superjson from 'superjson'
import type { inferRouterInputs } from '@trpc/server'

type RouterInput = inferRouterInputs<AppRouter>

export type ProjectCreateInput = RouterInput['projects']['create']
export type ProjectUpdateInput = RouterInput['projects']['update']

export function isProjectCreateInput(
    input: ProjectCreateInput | ProjectUpdateInput
): input is ProjectCreateInput {
    return 'name' in input
}

export function isProjectUpdateInput(
    input: ProjectCreateInput | ProjectUpdateInput
): input is ProjectUpdateInput {
    return 'id' in input
}

// Create persistent WebSocket connection for subscriptions
const wsClient = createWSClient({
    url: 'ws://127.0.0.1:8080/api',
})

// Configure TRPCClient to use HTTP for queries/mutations and WebSocket for subscriptions
export const trpc = createTRPCClient<AppRouter>({
    links: [
        splitLink({
            condition: (op) => op.type === 'subscription',
            // Use WebSocket for subscriptions
            true: wsLink({
                client: wsClient,
                transformer: superjson,
            }),
            // Use HTTP for queries and mutations
            false: httpBatchLink({
                url: 'http://127.0.0.1:8080/api',
                transformer: superjson,
            }),
        }),
    ],
})

// Export WebSocket client for manual connection management if needed
export { wsClient }
