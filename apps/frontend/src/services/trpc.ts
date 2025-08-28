import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../types'
import superjson from 'superjson'
import type { inferRouterInputs } from '@trpc/server'

type RouterInput = inferRouterInputs<AppRouter>

export type ProjectCreateInput = RouterInput['projects']['create']
export type ProjectUpdateInput = RouterInput['projects']['update']

export const trpc = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: 'http://127.0.0.1:8080/api',
            transformer: superjson,
        }),
    ],
})
