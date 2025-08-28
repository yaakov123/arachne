import { EventEmitter } from 'events'
import type { BackendEvent } from '@arachne/api-types'

export class BroadcastService {
    private requestListener!: (event: any) => void
    private responseListener!: (event: any) => void
    private requestBodyListener!: (event: any) => void
    private responseBodyListener!: (event: any) => void
    private transactionCompleteListener!: (event: any) => void

    constructor(
        private broadcastFunction: (event: BackendEvent) => void,
        private eventEmitter: EventEmitter
    ) {
        this.setupEventListeners()
    }

    private setupEventListeners() {
        // Request events
        this.requestListener = (event: any) => {
            try {
                this.broadcastFunction({
                    type: 'request',
                    ...event,
                })
            } catch (error) {
                // Silently handle broadcast errors to prevent disrupting the flow
                console.error('Failed to broadcast request event:', error)
            }
        }

        // Response events
        this.responseListener = (event: any) => {
            try {
                this.broadcastFunction({
                    type: 'responseHead',
                    ...event,
                })
            } catch (error) {
                console.error('Failed to broadcast response event:', error)
            }
        }

        // Request body events
        this.requestBodyListener = (event: any) => {
            try {
                this.broadcastFunction({
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
                this.broadcastFunction({
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
                this.broadcastFunction(event)
            } catch (error) {
                console.error(
                    'Failed to broadcast transaction complete event:',
                    error
                )
            }
        }

        // Register all listeners
        this.eventEmitter.on('request', this.requestListener)
        this.eventEmitter.on('response', this.responseListener)
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
        this.eventEmitter.removeListener('response', this.responseListener)
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
