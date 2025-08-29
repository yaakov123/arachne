import type { TransactionCompleteEvent } from '@arachne/api-types'
import { TransactionService } from './transaction-service'

export class StorageService {
    constructor(private transactionService: TransactionService) {}

    async handleTransactionComplete(
        projectId: string,
        event: TransactionCompleteEvent
    ) {
        try {
            return this.transactionService.addTransaction(projectId, event)
        } catch (error) {
            // Log error with more context but don't throw to prevent disrupting the event flow
            console.error(
                `Failed to store transaction ${event.id} for project ${projectId}:`,
                error
            )
        }
    }
}
