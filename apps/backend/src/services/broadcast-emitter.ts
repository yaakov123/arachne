import { EventEmitter } from 'events'
import {
    ErrorEvent,
    RequestBodyEvent,
    RequestEvent,
    ResponseBodyEvent,
    ResponseHeadEvent,
    TransactionCompleteEvent,
} from '@arachne/api-types'

type EventMap = {
    request: [RequestEvent]
    requestBody: [RequestBodyEvent]
    responseHead: [ResponseHeadEvent]
    responseBody: [ResponseBodyEvent]
    error: [ErrorEvent]
    transactionComplete: [TransactionCompleteEvent]
}

export class BroadcastEmitter extends EventEmitter<EventMap> {
    constructor() {
        super()
    }
}
