import { IncomingMessage } from 'node:http'
import type { ResponseContext, ResponseBodyContext } from '../plugins/types'
import type { PluginManager } from './plugin-manager'
import { 
    getNumericHeader, 
    headerToString, 
    readStreamToBuffer, 
    decodeBody,
    MAX_BODY_SIZE 
} from './proxy-utils'
import { sanitizeHeaders } from './utils'
import type { ProcessedResponseBody } from './http-types'

export class ResponseBodyHandler {
    constructor(private pluginManager: PluginManager) {}

    canBuffer(
        response: IncomingMessage, 
        method: string, 
        statusCode: number,
        hasHook: boolean
    ): boolean {
        const resContentLength = getNumericHeader(response.headers['content-length'])
        const isBodyless =
            method === 'HEAD' ||
            [101, 204, 304].includes(statusCode) ||
            resContentLength === 0

        return (
            hasHook &&
            !isBodyless &&
            ((typeof resContentLength === 'number' &&
                resContentLength >= 0 &&
                resContentLength <= MAX_BODY_SIZE) ||
                typeof resContentLength === 'undefined')
        )
    }

    async processBody(
        response: IncomingMessage,
        ctx: ResponseContext,
        method: string
    ): Promise<ProcessedResponseBody | null> {
        const statusCode = response.statusCode || 502
        const hasResBodyHook = this.pluginManager.hasHook('onResponseBody')

        if (!this.canBuffer(response, method, statusCode, hasResBodyHook)) {
            return null
        }

        try {
            const resContentLength = getNumericHeader(response.headers['content-length'])
            const resContentEncoding = headerToString(response.headers['content-encoding'])

            const raw = await readStreamToBuffer(
                response,
                typeof resContentLength === 'number'
                    ? resContentLength
                    : MAX_BODY_SIZE + 1
            )
            
            const decoded = await decodeBody(raw, resContentEncoding)
            let bodyBuf = decoded
            
            const resBodyCtx: ResponseBodyContext = Object.assign({}, ctx, {
                body: bodyBuf,
                contentType: headerToString(response.headers['content-type']),
                contentEncoding: resContentEncoding,
                setBody: (b: Buffer | string) => {
                    bodyBuf = Buffer.isBuffer(b) ? b : Buffer.from(b)
                    resBodyCtx.body = bodyBuf
                },
            })

            await this.pluginManager.runHook('onResponseBody', resBodyCtx)

            // Prepare headers for uncompressed, rewritten body
            const headersOut = sanitizeHeaders(ctx.responseHeaders as any)
            delete headersOut['content-encoding']
            delete (headersOut as any)['transfer-encoding']
            headersOut['content-length'] = String(bodyBuf.length)

            return {
                body: bodyBuf,
                headers: headersOut
            }
        } catch  {
            // Return null on error - caller will handle fallback to streaming
            return null
        }
    }

    prepareStreamingHeaders(headers: Record<string, any>): Record<string, any> {
        return sanitizeHeaders(headers)
    }
}
