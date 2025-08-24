// Shared WS message contracts mirroring backend `apps/backend/src/types.ts`

export type HeaderMap = Record<string, string | string[]>

export type BackendEvent =
    | RequestEvent
    | RequestBodyEvent
    | ResponseHeadEvent
    | ResponseBodyEvent
    | ErrorEvent
    | TransactionCompleteEvent

export interface BaseEvent {
    type:
        | 'request'
        | 'requestBody'
        | 'responseHead'
        | 'responseBody'
        | 'error'
        | 'transactionComplete'
    id: string // proxy ctx.id
    ts: string // ISO timestamp
}

// Structured header for easier client display
export interface DisplayHeader {
    name: string
    value: string
    sensitive?: boolean // true for auth headers, cookies, etc.
}

// Enhanced content metadata for better parsing/display
export interface ContentInfo {
    contentType?: string
    contentEncoding?: string
    size: number // actual content size in bytes
    sampleSize: number // size of the sample provided
    truncated: boolean
    detectedFormat?: 'json' | 'xml' | 'html' | 'css' | 'javascript' | 'text' | 'binary' | 'image' | 'form'
    encoding: 'utf8' | 'base64'
    isCompressed?: boolean // was originally compressed
}

// URL breakdown for easier display
export interface RequestURL {
    full: string
    protocol: string
    host: string
    port?: number
    path: string
    query?: string
    fragment?: string
}

export interface RequestEvent extends BaseEvent {
    type: 'request'
    method: string
    url: RequestURL
    headers: DisplayHeader[]
    rawHeaders: HeaderMap // keep for backward compatibility
    clientIp?: string
    timestamp: number // Unix timestamp for sorting
}

export interface RequestBodyEvent extends BaseEvent {
    type: 'requestBody'
    content: ContentInfo
    sample: string // formatted based on content.encoding
}

export interface ResponseHeadEvent extends BaseEvent {
    type: 'responseHead'
    statusCode: number
    statusMessage?: string
    headers: DisplayHeader[]
    rawHeaders: HeaderMap // keep for backward compatibility
    timing?: {
        startTime: number // when request was sent
        responseTime: number // when response headers received
        duration: number // response time in ms
    }
}

export interface ResponseBodyEvent extends BaseEvent {
    type: 'responseBody'
    content: ContentInfo
    sample: string // formatted based on content.encoding
}

export interface ErrorEvent extends BaseEvent {
    type: 'error'
    message: string
    stack?: string
    phase?: 'request' | 'response' | 'body' | 'connection'
}

export interface TransactionRequest {
    method: string
    url: RequestURL
    headers: DisplayHeader[]
    rawHeaders: HeaderMap
    clientIp?: string
    body?: TransactionBody
}

export interface TransactionBody {
    content: ContentInfo
    sample: string
}

export interface TransactionResponse {
    statusCode: number
    statusMessage?: string
    headers: DisplayHeader[]
    rawHeaders: HeaderMap
    body?: TransactionBody
}

export interface TransactionTiming {
    startTime: number
    responseTime?: number
    duration?: number
}

export interface TransactionSummary {
    requestSize?: number
    responseSize?: number
    hasRequestBody: boolean
    hasResponseBody: boolean
}

export interface TransactionData {
    request: TransactionRequest
    response?: TransactionResponse
    timing: TransactionTiming
    summary: TransactionSummary
}

// Dependency analysis types
export interface TransactionDependency {
    type: 'data_flow' | 'cookie' | 'auth_token' | 'csrf' | 'referrer'
    sourceTransactionId: string
    targetTransactionId: string
    detail: {
        field: string           // source field -> target field
        value: string          // the actual value that flowed
        confidence: number     // 0-1 confidence score
        sourceLocation?: 'header' | 'body_field' | 'status_code'
        targetLocation?: 'header' | 'query_param' | 'url_path' | 'body_field'
        timespan?: number      // milliseconds between source and target
    }
}

export interface TransactionCompleteEvent extends BaseEvent {
    type: 'transactionComplete'
    transaction: TransactionData
    dependencies?: TransactionDependency[]
}

export interface ClientHello {
    type: 'hello'
}

export type ClientMessage = ClientHello
