import { router, publicProcedure } from '../init'
import type { BackendEvent } from '@arachne/api-types'
import type { Transaction } from '@arachne/database'
import { EventEmitter } from 'events'
import { mapTransactionCompleteEventToTransaction } from '../../utils/mapper'

// Create a global event emitter for broadcasting events
// This will replace the WsHub functionality
export const subscriptionEvents = new EventEmitter()

/**
 * Subscription router that provides WebSocket subscriptions
 * for real-time updates using async generators (modern tRPC approach)
 */
export const subscriptionsRouter = router({
    /**
     * Subscribe to all backend events (transactions, projects, etc.)
     */
    events: publicProcedure.subscription(async function* () {
        const eventQueue: BackendEvent[] = []
        let resolve: (() => void) | null = null
        let promise = new Promise<void>((res) => {
            resolve = res
        })

        const onEvent = (event: BackendEvent) => {
            eventQueue.push(event)
            if (resolve) {
                resolve()
                promise = new Promise<void>((res) => {
                    resolve = res
                })
            }
        }

        // Listen for all backend events
        subscriptionEvents.on('event', onEvent)

        try {
            while (true) {
                // Wait for events or yield any queued events
                if (eventQueue.length === 0) {
                    await promise
                }

                // Yield all queued events
                while (eventQueue.length > 0) {
                    const event = eventQueue.shift()!
                    yield event
                }
            }
        } finally {
            // Cleanup
            subscriptionEvents.off('event', onEvent)
        }
    }),

    /**
     * Subscribe to transaction-specific events
     */
    transactions: publicProcedure.subscription(async function* () {
        const eventQueue: Omit<Transaction, 'projectId'>[] = []
        let resolve: (() => void) | null = null
        let promise = new Promise<void>((res) => {
            resolve = res
        })

        const onEvent = (event: BackendEvent) => {
            if (event.type === 'transactionComplete') {
                eventQueue.push(
                    mapTransactionCompleteEventToTransaction(event, '1')
                )
                if (resolve) {
                    resolve()
                    promise = new Promise<void>((res) => {
                        resolve = res
                    })
                }
            }
        }

        subscriptionEvents.on('event', onEvent)

        try {
            while (true) {
                if (eventQueue.length === 0) {
                    await promise
                }

                while (eventQueue.length > 0) {
                    const event = eventQueue.shift()!
                    yield event
                }
            }
        } finally {
            subscriptionEvents.off('event', onEvent)
        }
    }),

    /**
     * Subscribe to error events
     */
    errors: publicProcedure.subscription(async function* () {
        const eventQueue: BackendEvent[] = []
        let resolve: (() => void) | null = null
        let promise = new Promise<void>((res) => {
            resolve = res
        })

        const onEvent = (event: BackendEvent) => {
            // Only queue error events
            if (event.type === 'error') {
                eventQueue.push(event)
                if (resolve) {
                    resolve()
                    promise = new Promise<void>((res) => {
                        resolve = res
                    })
                }
            }
        }

        subscriptionEvents.on('event', onEvent)

        try {
            while (true) {
                if (eventQueue.length === 0) {
                    await promise
                }

                while (eventQueue.length > 0) {
                    const event = eventQueue.shift()!
                    yield event
                }
            }
        } finally {
            subscriptionEvents.off('event', onEvent)
        }
    }),
})

/**
 * Helper function to broadcast events through tRPC subscriptions
 * This replaces the WsHub.broadcast() method
 */
export function broadcastEvent(event: BackendEvent) {
    subscriptionEvents.emit('event', event)
}
