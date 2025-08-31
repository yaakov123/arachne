import { EventEmitter } from 'events'
import { ErrorEvent, TransactionCompleteEvent } from '@arachne/api-types'

type EventMap = {
    error: [ErrorEvent]
    transactionComplete: [TransactionCompleteEvent]
}

export class BroadcastEmitter extends EventEmitter<EventMap> {
    constructor() {
        super()
    }
}
