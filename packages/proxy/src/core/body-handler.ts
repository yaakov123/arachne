import type { IncomingMessage } from 'node:http'
import { readStreamToBuffer, decodeBody } from './utils/body'
import { getNumericHeader } from './utils/headers'

/**
 * Simplified body handler for the new plugin API
 * Always buffers bodies when response hooks are present
 */
export class BodyHandler {
    constructor(private maxBodySize: number) {}

    /**
     * Check if a request body should be buffered
     */
    shouldBufferRequest(method: string, contentLength?: number): boolean {
        const upperMethod = method.toUpperCase()

        // Only buffer methods that typically have bodies
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod)) {
            return false
        }

        // Don't buffer if no content-length or if too large
        if (!contentLength || contentLength > this.maxBodySize) {
            return false
        }

        return true
    }

    /**
     * Check if a response body should be buffered
     */
    shouldBufferResponse(
        method: string,
        statusCode: number,
        contentLength?: number,
        hasResponseHooks: boolean = false
    ): boolean {
        // Always buffer if there are response hooks that might modify the body
        if (!hasResponseHooks) {
            return false
        }

        const upperMethod = method.toUpperCase()

        // Don't buffer HEAD responses or certain status codes
        if (
            upperMethod === 'HEAD' ||
            statusCode === 204 ||
            statusCode === 304
        ) {
            return false
        }

        // Don't buffer if too large
        if (contentLength && contentLength > this.maxBodySize) {
            return false
        }

        return true
    }

    /**
     * Buffer and decode request body
     */
    async bufferRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
        const method = (req.method || 'GET').toUpperCase()
        const contentLength = getNumericHeader(req.headers['content-length'])

        if (!this.shouldBufferRequest(method, contentLength)) {
            return undefined
        }

        try {
            const buffered = await readStreamToBuffer(
                req,
                contentLength as number,
                this.maxBodySize
            )

            const encoding = this.getHeaderValue(
                req.headers['content-encoding']
            )
            return await decodeBody(buffered, encoding)
        } catch (error) {
            console.warn('Failed to buffer request body:', error)
            return undefined
        }
    }

    /**
     * Buffer and decode response body
     */
    async bufferResponseBody(
        res: IncomingMessage,
        method: string,
        statusCode: number,
        hasResponseHooks: boolean
    ): Promise<Buffer | undefined> {
        const contentLength = getNumericHeader(res.headers['content-length'])

        if (
            !this.shouldBufferResponse(
                method,
                statusCode,
                contentLength,
                hasResponseHooks
            )
        ) {
            return undefined
        }

        try {
            const buffered = await readStreamToBuffer(
                res,
                contentLength || 0,
                this.maxBodySize
            )

            const encoding = this.getHeaderValue(
                res.headers['content-encoding']
            )
            return await decodeBody(buffered, encoding)
        } catch (error) {
            console.warn('Failed to buffer response body:', error)
            return undefined
        }
    }

    /**
     * Prepare headers for sending buffered content
     */
    prepareHeadersForBufferedContent(
        headers: Record<string, string | string[]>,
        bodyLength: number
    ): Record<string, string | string[]> {
        const newHeaders = { ...headers }

        // Update content-length
        newHeaders['content-length'] = String(bodyLength)

        // Remove content-encoding since we decoded the body
        delete newHeaders['content-encoding']

        // Remove transfer-encoding since we're sending the full body
        delete newHeaders['transfer-encoding']

        return newHeaders
    }

    /**
     * Prepare headers for streaming content
     */
    prepareHeadersForStreaming(
        headers: Record<string, string | string[]>
    ): Record<string, string | string[]> {
        const newHeaders = { ...headers }

        // Remove content-length for streaming
        delete newHeaders['content-length']

        return newHeaders
    }

    private getHeaderValue(
        header: string | string[] | undefined
    ): string | undefined {
        if (!header) return undefined
        return Array.isArray(header) ? header[0] : header
    }
}
