import type { TransactionCompleteEvent } from '@arachne/api-types'
import { broadcastEvent } from '../trpc/routers/subscriptions.router'

export class BroadcastService {
    constructor() {}

    async handleTransactionComplete(event: TransactionCompleteEvent) {
        try {
            broadcastEvent(event)
        } catch (error) {
            console.error(
                'Failed to broadcast transaction complete event:',
                error
            )
        }
    }
}
