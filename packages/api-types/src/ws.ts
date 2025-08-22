// Shared WS message contracts mirroring backend `apps/backend/src/types.ts`

export type HeaderMap = Record<string, string | string[]>

export type BackendEvent =
    | RequestEvent
    | RequestBodyEvent
    | ResponseHeadEvent
    | ResponseBodyEvent
    | ErrorEvent

export interface BaseEvent {
    type:
        | 'request'
        | 'requestBody'
        | 'responseHead'
        | 'responseBody'
        | 'intercept:requestBody'
        | 'intercept:requestBody:resolved'
        | 'error'
    id: string // proxy ctx.id
    ts: string // ISO timestamp
}

export interface RequestEvent extends BaseEvent {
    type: 'request'
    method: string
    url: string
    headers: HeaderMap
    clientIp?: string
    isHttps: boolean
}

export interface RequestBodyEvent extends BaseEvent {
    type: 'requestBody'
    contentType?: string
    sample: string // utf8 text or "base64:..."
    truncated: boolean
    request: RequestEvent
}

export interface ResponseHeadEvent extends BaseEvent {
    type: 'responseHead'
    statusCode: number
    statusMessage?: string
    headers: HeaderMap
}

export interface ResponseBodyEvent extends BaseEvent {
    type: 'responseBody'
    contentType?: string
    sample: string
    truncated: boolean
    response: ResponseHeadEvent
}

export interface ErrorEvent extends BaseEvent {
    type: 'error'
    message: string
}

export interface ClientHello {
    type: 'hello'
}

export type ClientMessage = ClientHello
