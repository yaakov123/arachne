/**
 * Builder classes for modifying HTTP requests and responses in plugins
 */

export class RequestBuilder {
    private _headers: Record<string, string | string[]>
    private _body?: Buffer
    private _url: URL
    private _method: string

    constructor(
        url: URL,
        method: string,
        headers: Record<string, string | string[]>,
        body?: Buffer
    ) {
        this._url = new URL(url.toString()) // Clone URL
        this._method = method
        this._headers = { ...headers } // Clone headers
        this._body = body ? Buffer.from(body) : undefined // Clone body
    }

    /**
     * Add a header (preserves existing values if header already exists)
     */
    addHeader(name: string, value: string): this {
        const existing = this._headers[name.toLowerCase()]
        if (existing) {
            if (Array.isArray(existing)) {
                existing.push(value)
            } else {
                this._headers[name.toLowerCase()] = [existing, value]
            }
        } else {
            this._headers[name.toLowerCase()] = value
        }
        return this
    }

    /**
     * Remove a header completely
     */
    removeHeader(name: string): this {
        delete this._headers[name.toLowerCase()]
        return this
    }

    /**
     * Set a header (replaces existing value)
     */
    setHeader(name: string, value: string): this {
        this._headers[name.toLowerCase()] = value
        return this
    }

    /**
     * Get a header value
     */
    getHeader(name: string): string | string[] | undefined {
        return this._headers[name.toLowerCase()]
    }

    /**
     * Set the request body
     */
    setBody(body: Buffer | string): this {
        this._body = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')
        // Update content-length header
        this.setHeader('content-length', String(this._body.length))
        return this
    }

    /**
     * Get the current body
     */
    getBody(): Buffer | undefined {
        return this._body ? Buffer.from(this._body) : undefined
    }

    /**
     * Set the request URL
     */
    setUrl(url: string): this {
        this._url = new URL(url)
        return this
    }

    /**
     * Get the current URL
     */
    getUrl(): URL {
        return new URL(this._url.toString())
    }

    /**
     * Set the HTTP method
     */
    setMethod(method: string): this {
        this._method = method.toUpperCase()
        return this
    }

    /**
     * Get the current method
     */
    getMethod(): string {
        return this._method
    }

    /**
     * Get all current headers
     */
    getHeaders(): Record<string, string | string[]> {
        return { ...this._headers }
    }

    /**
     * Internal method to get final state for processing
     */
    _getFinalState() {
        return {
            url: new URL(this._url.toString()),
            method: this._method,
            headers: { ...this._headers },
            body: this._body ? Buffer.from(this._body) : undefined,
        }
    }
}

export class ResponseBuilder {
    private _statusCode: number
    private _statusMessage?: string
    private _headers: Record<string, string | string[]>
    private _body?: Buffer

    constructor(
        statusCode: number,
        statusMessage: string | undefined,
        headers: Record<string, string | string[]>,
        body?: Buffer
    ) {
        this._statusCode = statusCode
        this._statusMessage = statusMessage
        this._headers = { ...headers } // Clone headers
        this._body = body ? Buffer.from(body) : undefined // Clone body
    }

    /**
     * Add a header (preserves existing values if header already exists)
     */
    addHeader(name: string, value: string): this {
        const existing = this._headers[name.toLowerCase()]
        if (existing) {
            if (Array.isArray(existing)) {
                existing.push(value)
            } else {
                this._headers[name.toLowerCase()] = [existing, value]
            }
        } else {
            this._headers[name.toLowerCase()] = value
        }
        return this
    }

    /**
     * Remove a header completely
     */
    removeHeader(name: string): this {
        delete this._headers[name.toLowerCase()]
        return this
    }

    /**
     * Set a header (replaces existing value)
     */
    setHeader(name: string, value: string): this {
        this._headers[name.toLowerCase()] = value
        return this
    }

    /**
     * Get a header value
     */
    getHeader(name: string): string | string[] | undefined {
        return this._headers[name.toLowerCase()]
    }

    /**
     * Set the response body
     */
    setBody(body: Buffer | string): this {
        this._body = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')
        // Update content-length header
        this.setHeader('content-length', String(this._body.length))
        return this
    }

    /**
     * Get the current body
     */
    getBody(): Buffer | undefined {
        return this._body ? Buffer.from(this._body) : undefined
    }

    /**
     * Set the HTTP status code
     */
    setStatusCode(code: number): this {
        this._statusCode = code
        return this
    }

    /**
     * Get the current status code
     */
    getStatusCode(): number {
        return this._statusCode
    }

    /**
     * Set the HTTP status message
     */
    setStatusMessage(message: string): this {
        this._statusMessage = message
        return this
    }

    /**
     * Get the current status message
     */
    getStatusMessage(): string | undefined {
        return this._statusMessage
    }

    /**
     * Get all current headers
     */
    getHeaders(): Record<string, string | string[]> {
        return { ...this._headers }
    }

    /**
     * Internal method to get final state for processing
     */
    _getFinalState() {
        return {
            statusCode: this._statusCode,
            statusMessage: this._statusMessage,
            headers: { ...this._headers },
            body: this._body ? Buffer.from(this._body) : undefined,
        }
    }
}
