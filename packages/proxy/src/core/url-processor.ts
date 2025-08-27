import { IncomingMessage } from 'node:http'
import { URL } from 'node:url'
import { parseHostPort } from './utils/headers'
import { logger } from '../logger'

export class UrlProcessor {
    static parseRequestUrl(req: IncomingMessage, isHttps: boolean): URL {
        // Handle absolute URLs in request line
        if (req.url && /^https?:\/\//i.test(req.url)) {
            return new URL(req.url)
        }

        // Handle origin-form requests (most common)
        const hostHeader = req.headers['host'] as string | undefined
        if (!hostHeader) {
            throw new Error('Origin-form request missing Host header')
        }

        const { hostname, port } = parseHostPort(hostHeader)
        const protocol = isHttps ? 'https:' : 'http:'
        const portPart = port ? `:${port}` : ''
        
        return new URL(
            `${protocol}//${hostname}${portPart}${req.url || '/'}`
        )
    }

    static validateHostHeader(hostHeader?: string): void {
        if (!hostHeader) {
            throw new Error('Missing Host header')
        }
    }

    static buildFullUrl(req: IncomingMessage, isHttps: boolean): URL {
        try {
            return this.parseRequestUrl(req, isHttps)
        } catch (error) {
            logger.warn('Origin-form request missing Host header', {
                url: req.url,
                headers: req.headers,
                component: 'url-processor'
            })
            throw error
        }
    }
}
