import type {
    ResponseBodyEvent,
    RequestBodyEvent,
    RequestEvent,
    TransactionCompleteEvent,
} from '@arachne/api-types'
import { BroadcastEmitter } from './broadcast-emitter'
import { broadcastEvent } from '../trpc/routers/subscriptions'

export class BroadcastService {
    private requestListener!: (event: RequestEvent) => void
    private requestBodyListener!: (event: RequestBodyEvent) => void
    private responseBodyListener!: (event: ResponseBodyEvent) => void
    private transactionCompleteListener!: (
        event: TransactionCompleteEvent
    ) => void

    constructor(private eventEmitter: BroadcastEmitter) {
        this.setupEventListeners()
    }

    private setupEventListeners() {
        // Request events
        this.requestListener = (event: any) => {
            try {
                broadcastEvent({
                    type: 'request',
                    ...event,
                })
            } catch (error) {
                // Silently handle broadcast errors to prevent disrupting the flow
                console.error('Failed to broadcast request event:', error)
            }
        }

        // Request body events
        this.requestBodyListener = (event: any) => {
            try {
                broadcastEvent({
                    type: 'requestBody',
                    ...event,
                })
            } catch (error) {
                console.error('Failed to broadcast request body event:', error)
            }
        }

        // Response body events
        this.responseBodyListener = (event: any) => {
            try {
                broadcastEvent({
                    type: 'responseBody',
                    ...event,
                })
            } catch (error) {
                console.error('Failed to broadcast response body event:', error)
            }
        }

        // Transaction complete events
        this.transactionCompleteListener = (event: any) => {
            try {
                // Transaction complete events already have the correct format
                broadcastEvent(event)
            } catch (error) {
                console.error(
                    'Failed to broadcast transaction complete event:',
                    error
                )
            }
        }

        // Register all listeners
        this.eventEmitter.on('request', this.requestListener)
        this.eventEmitter.on('requestBody', this.requestBodyListener)
        this.eventEmitter.on('responseBody', this.responseBodyListener)
        this.eventEmitter.on(
            'transactionComplete',
            this.transactionCompleteListener
        )
    }

    /**
     * Clean up event listeners to prevent memory leaks
     */
    cleanup() {
        this.eventEmitter.removeListener('request', this.requestListener)
        this.eventEmitter.removeListener(
            'requestBody',
            this.requestBodyListener
        )
        this.eventEmitter.removeListener(
            'responseBody',
            this.responseBodyListener
        )
        this.eventEmitter.removeListener(
            'transactionComplete',
            this.transactionCompleteListener
        )
    }
}
