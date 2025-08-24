import { IncomingMessage } from 'node:http'

export interface ProcessedRequestBody {
    body?: Buffer
    updatedHeaders: Record<string, string | string[]>
}

export interface ProcessedResponseBody {
    body: Buffer
    headers: Record<string, string | string[]>
}

export interface BufferResult {
    canBuffer: boolean
    reason?: string
}

export interface StreamBufferOptions {
    maxSize: number
    expectedLength?: number
}

export interface BodyProcessingResult {
    body: Buffer
    shouldStream: boolean
    headers: Record<string, string | string[]>
}

export interface UpstreamRequestResult {
    response: IncomingMessage
    error?: Error
}
