// Shared WS message contracts mirroring backend `apps/backend/src/types.ts`

export type HeaderMap = Record<string, string | string[]>

export type BackendEvent =
  | RequestEvent
  | RequestBodyEvent
  | ResponseHeadEvent
  | ResponseBodyEvent
  | InterceptRequestBodyEvent
  | InterceptResolvedEvent
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
}

export interface InterceptRequestBodyEvent extends BaseEvent {
  type: 'intercept:requestBody'
  interceptId: string
  method: string
  url: string
  headers: HeaderMap
  contentType?: string
  sample: string
  sampleEncoding: 'utf8' | 'base64'
  truncated: boolean
  maxBytes: number
}

export interface InterceptResolvedEvent extends BaseEvent {
  type: 'intercept:requestBody:resolved'
  interceptId: string
  acceptedByClientId?: string
  edited: boolean
}

export interface ErrorEvent extends BaseEvent {
  type: 'error'
  message: string
}

export interface ClientHello {
  type: 'hello'
  filters?: {
    host?: string
    method?: string
    pathGlob?: string
    status?: string // e.g. "2xx,4xx"
  }
  intercept?: boolean // enable receiving intercept prompts
  token?: string
}

export interface InterceptSubmitMessage {
  type: 'intercept:requestBody:submit'
  reqId: string
  interceptId: string
  body: string // utf8 text or base64
  bodyEncoding: 'utf8' | 'base64'
}

export interface InterceptSkipMessage {
  type: 'intercept:requestBody:skip'
  reqId: string
  interceptId: string
}

export type ClientMessage =
  | ClientHello
  | InterceptSubmitMessage
  | InterceptSkipMessage
