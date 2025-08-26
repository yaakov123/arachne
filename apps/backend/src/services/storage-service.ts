import { EventEmitter } from 'events'
import type { ProjectService } from './project-service'
import type { TransactionCompleteEvent } from '@arachne/api-types'

export class StorageService {
    private transactionCompleteListener!: (
        event: TransactionCompleteEvent
    ) => void

    constructor(
        private projectService: ProjectService,
        private eventEmitter: EventEmitter
    ) {
        this.setupEventListeners()
    }

    private setupEventListeners() {
        this.transactionCompleteListener = async (
            event: TransactionCompleteEvent
        ) => {
            try {
                await this.projectService.addTransactionToCurrentProject(event)
            } catch (error) {
                // Log error but don't throw to prevent disrupting the event flow
                console.error('Failed to store transaction:', error)
            }
        }

        this.eventEmitter.on(
            'transactionComplete',
            this.transactionCompleteListener
        )
    }

    /**
     * Clean up event listeners to prevent memory leaks
     */
    cleanup() {
        this.eventEmitter.removeListener(
            'transactionComplete',
            this.transactionCompleteListener
        )
    }
}
