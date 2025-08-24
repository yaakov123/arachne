import { IncomingMessage } from 'node:http'
import type { RequestContext, RequestBodyContext } from '../plugins/types'
import type { PluginManager } from './plugin-manager'
import { 
    getNumericHeader, 
    headerToString, 
    readStreamToBuffer, 
    decodeBody,
    MAX_BODY_SIZE 
} from './proxy-utils'
import type { ProcessedRequestBody } from './http-types'

export class RequestBodyHandler {
    constructor(private pluginManager: PluginManager) {}

    canBuffer(method: string, contentLength: number | undefined, hasHook: boolean): boolean {
        const hasRequestBody = !['GET', 'HEAD'].includes(method.toUpperCase())
        return (
            hasHook &&
            hasRequestBody &&
            typeof contentLength === 'number' &&
            contentLength > 0 &&
            contentLength <= MAX_BODY_SIZE
        )
    }

    async processBody(
        req: IncomingMessage,
        ctx: RequestContext
    ): Promise<ProcessedRequestBody> {
        const method = (req.method || 'GET').toUpperCase()
        const reqContentLength = getNumericHeader(req.headers['content-length'])
        const hasReqBodyHook = this.pluginManager.hasHook('onRequestBody')

        if (!this.canBuffer(method, reqContentLength, hasReqBodyHook)) {
            return { updatedHeaders: {} }
        }

        try {
            const buffered = await readStreamToBuffer(req, reqContentLength as number)
            const reqEnc = headerToString(req.headers['content-encoding'])
            const decoded = await decodeBody(buffered, reqEnc)
            
            let bodyBuf = decoded
            const reqBodyCtx: RequestBodyContext = Object.assign({}, ctx, {
                body: bodyBuf,
                contentType: headerToString(req.headers['content-type']),
                contentEncoding: reqEnc,
                setBody: (b: Buffer | string) => {
                    bodyBuf = Buffer.isBuffer(b) ? b : Buffer.from(b)
                    ;(reqBodyCtx as any).body = bodyBuf
                },
            })

            await this.pluginManager.runHook('onRequestBody', reqBodyCtx as any)

            // Update headers for new body
            const updatedHeaders: Record<string, string | string[]> = {
                'content-length': String(bodyBuf.length)
            }

            // Remove conflicting headers
            if (reqEnc) {
                updatedHeaders['content-encoding'] = ''  // Mark for deletion
            }

            return {
                body: bodyBuf,
                updatedHeaders
            }
        } catch {
            // Return empty result on error - caller will handle fallback to streaming
            return { updatedHeaders: {} }
        }
    }

    updateRequestHeaders(
        headers: Record<string, any>,
        updatedHeaders: Record<string, string | string[]>
    ): void {
        Object.entries(updatedHeaders).forEach(([key, value]) => {
            if (value === '' || (Array.isArray(value) && value.length === 0)) {
                delete headers[key]
            } else {
                headers[key] = value
            }
        })

        // Always remove transfer-encoding when we buffer the body
        delete headers['transfer-encoding']
    }
}
