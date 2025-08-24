import type {
    TransactionData,
    TransactionDependency,
    TransactionBody
} from '@arachne/api-types'
import { logger } from './logger'

export interface ExtractedRequestValue {
    value: string
    location: 'header' | 'query_param' | 'url_path' | 'body_field'
    field: string
    confidence: number
}

export interface ResponseDataEntry {
    value: string
    sourceTransactionId: string
    location: 'header' | 'body_field' | 'status_code'
    field: string
    timestamp: number
}

/**
 * Extracts all interesting values from incoming requests
 */
export class RequestValueExtractor {
    private commonHeaders = new Set([
        'accept', 'accept-encoding', 'accept-language', 'cache-control',
        'connection', 'content-length', 'content-type', 'host', 'origin',
        'referer', 'user-agent', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site'
    ])

    private commonValues = new Set([
        'true', 'false', 'null', 'undefined', 'GET', 'POST', 'PUT', 'DELETE',
        'application/json', 'text/html', 'text/plain', 'utf-8'
    ])

    extractAllValues(transaction: TransactionData): ExtractedRequestValue[] {
        const values: ExtractedRequestValue[] = []

        // Extract from headers
        for (const header of transaction.request.headers) {
            if (this.isCommonHeader(header.name)) continue
            values.push(...this.extractFromHeaderValue(header.name, header.value))
        }

        // Extract from URL query parameters
        if (transaction.request.url.query) {
            values.push(...this.extractFromQueryParams(transaction.request.url.query))
        }

        // Extract from URL path segments
        values.push(...this.extractFromUrlPath(transaction.request.url.path))

        // Extract from request body
        if (transaction.request.body) {
            values.push(...this.extractFromRequestBody(transaction.request.body))
        }

        return values.filter(v => this.isInterestingValue(v.value))
    }

    private extractFromHeaderValue(headerName: string, headerValue: string): ExtractedRequestValue[] {
        const values: ExtractedRequestValue[] = []

        // For Authorization headers, extract the token
        if (headerName.toLowerCase() === 'authorization') {
            const tokenMatch = headerValue.match(/Bearer\s+(.+)/) || 
                             headerValue.match(/Token\s+(.+)/) ||
                             headerValue.match(/Basic\s+(.+)/)
            if (tokenMatch) {
                values.push({
                    value: tokenMatch[1],
                    location: 'header',
                    field: headerName,
                    confidence: 0.9
                })
            }
        }

        // For Cookie headers, extract individual cookies
        if (headerName.toLowerCase() === 'cookie') {
            const cookies = this.parseCookies(headerValue)
            for (const [name, value] of cookies) {
                if (this.isInterestingValue(value)) {
                    values.push({
                        value,
                        location: 'header',
                        field: `cookie:${name}`,
                        confidence: 0.8
                    })
                }
            }
        }

        // For other headers, extract tokens/IDs
        const tokens = this.extractTokensFromString(headerValue)
        for (const token of tokens) {
            values.push({
                value: token,
                location: 'header',
                field: headerName,
                confidence: 0.7
            })
        }

        return values
    }

    private extractFromQueryParams(queryString: string): ExtractedRequestValue[] {
        const values: ExtractedRequestValue[] = []
        const params = new URLSearchParams(queryString)

        for (const [key, value] of params.entries()) {
            if (this.isInterestingValue(value)) {
                values.push({
                    value,
                    location: 'query_param',
                    field: key,
                    confidence: 0.8
                })
            }
        }

        return values
    }

    private extractFromUrlPath(path: string): ExtractedRequestValue[] {
        const values: ExtractedRequestValue[] = []
        const segments = path.split('/').filter(Boolean)

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i]
            if (this.looksLikeId(segment)) {
                values.push({
                    value: segment,
                    location: 'url_path',
                    field: `path_segment_${i}`,
                    confidence: 0.9
                })
            }
        }

        return values
    }

    private extractFromRequestBody(body: TransactionBody): ExtractedRequestValue[] {
        const values: ExtractedRequestValue[] = []

        if (body.content.detectedFormat === 'json') {
            try {
                const parsed = JSON.parse(body.sample)
                this.extractFromJsonObject(parsed, '', values)
            } catch  {
                // Fallback to string extraction
                const tokens = this.extractTokensFromString(body.sample)
                for (const token of tokens) {
                    values.push({
                        value: token,
                        location: 'body_field',
                        field: 'raw_body',
                        confidence: 0.5
                    })
                }
            }
        } else if (body.content.detectedFormat === 'form') {
            const formData = this.parseFormData(body.sample)
            for (const [key, value] of formData) {
                if (this.isInterestingValue(value)) {
                    values.push({
                        value,
                        location: 'body_field',
                        field: key,
                        confidence: 0.8
                    })
                }
            }
        }

        return values
    }

    private extractFromJsonObject(obj: any, path: string, values: ExtractedRequestValue[]) {
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key

            if (typeof value === 'string' && this.isInterestingValue(value)) {
                values.push({
                    value,
                    location: 'body_field',
                    field: currentPath,
                    confidence: 0.8
                })
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                values.push({
                    value: String(value),
                    location: 'body_field',
                    field: currentPath,
                    confidence: 0.7
                })
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.extractFromJsonObject(value, currentPath, values)
            }
        }
    }

    private parseCookies(cookieHeader: string): Map<string, string> {
        const cookies = new Map<string, string>()
        const pairs = cookieHeader.split(';')
        
        for (const pair of pairs) {
            const [name, value] = pair.trim().split('=')
            if (name && value) {
                cookies.set(name, value)
            }
        }
        
        return cookies
    }

    private parseFormData(formBody: string): Map<string, string> {
        const formData = new Map<string, string>()
        const params = new URLSearchParams(formBody)
        
        for (const [key, value] of params.entries()) {
            formData.set(key, value)
        }
        
        return formData
    }

    private extractTokensFromString(text: string): string[] {
        const tokens: string[] = []
        
        // JWT pattern
        const jwtMatches = text.match(/[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g)
        if (jwtMatches) tokens.push(...jwtMatches)
        
        // UUID pattern
        const uuidMatches = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)
        if (uuidMatches) tokens.push(...uuidMatches)
        
        // Long alphanumeric strings (potential tokens/IDs)
        const tokenMatches = text.match(/[a-zA-Z0-9_-]{16,}/g)
        if (tokenMatches) tokens.push(...tokenMatches)
        
        return tokens
    }

    private isCommonHeader(headerName: string): boolean {
        return this.commonHeaders.has(headerName.toLowerCase())
    }

    private isInterestingValue(value: string): boolean {
        if (!value || value.length < 3) return false
        
        if (this.commonValues.has(value.toLowerCase())) return false
        
        return this.looksLikeId(value) ||
               this.looksLikeToken(value) ||
               this.looksLikeUrl(value) ||
               value.length > 8
    }

    private looksLikeId(value: string): boolean {
        // Numeric ID
        if (/^\d+$/.test(value) && value.length > 0) return true
        
        // UUID-like
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true
        
        // Alphanumeric ID
        if (/^[a-zA-Z0-9_-]{8,}$/.test(value)) return true
        
        return false
    }

    private looksLikeToken(value: string): boolean {
        // JWT pattern
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value)) return true
        
        // Long base64-like string
        if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 20) return true
        
        // Long hex string
        if (/^[a-fA-F0-9]{32,}$/.test(value)) return true
        
        return false
    }

    private looksLikeUrl(value: string): boolean {
        try {
            new URL(value)
            return true
        } catch {
            return false
        }
    }
}

/**
 * Indexes response data for efficient reverse lookup
 */
export class ResponseDataIndex {
    private valueIndex = new Map<string, ResponseDataEntry[]>() // value -> where it appeared
    private transactionData = new Map<string, TransactionData>() // keep recent transactions
    private maxEntries = 10000 // Limit memory usage
    private maxAge = 10 * 60 * 1000 // 10 minutes

    indexResponse(transaction: TransactionData, transactionId: string) {
        if (!transaction.response) return

        // Store transaction for later reference
        this.transactionData.set(transactionId, transaction)

        // Index response headers
        for (const header of transaction.response.headers) {
            this.indexValue(header.value, {
                sourceTransactionId: transactionId,
                location: 'header',
                field: header.name,
                timestamp: transaction.timing.startTime
            })

            // For Set-Cookie headers, index individual cookies
            if (header.name.toLowerCase() === 'set-cookie') {
                const cookies = this.parseCookieHeader(header.value)
                for (const [name, value] of cookies) {
                    this.indexValue(value, {
                        sourceTransactionId: transactionId,
                        location: 'header',
                        field: `set-cookie:${name}`,
                        timestamp: transaction.timing.startTime
                    })
                }
            }
        }

        // Index response body
        if (transaction.response.body) {
            this.indexResponseBody(transaction.response.body, transactionId, transaction.timing.startTime)
        }

        // Cleanup old entries
        this.cleanupOldEntries(transaction.timing.startTime - this.maxAge)
    }

    findValueOrigins(value: string, beforeTimestamp: number): ResponseDataEntry[] {
        const entries = this.valueIndex.get(value) || []
        return entries.filter(entry => entry.timestamp < beforeTimestamp)
    }

    private indexResponseBody(body: TransactionBody, transactionId: string, timestamp: number) {
        if (body.content.detectedFormat === 'json') {
            try {
                const parsed = JSON.parse(body.sample)
                this.indexJsonObject(parsed, '', transactionId, timestamp)
            } catch  {
                // Fallback to string token extraction
                const tokens = this.extractTokensFromString(body.sample)
                for (const token of tokens) {
                    this.indexValue(token, {
                        sourceTransactionId: transactionId,
                        location: 'body_field',
                        field: 'raw_body',
                        timestamp
                    })
                }
            }
        }
    }

    private indexJsonObject(obj: any, path: string, transactionId: string, timestamp: number) {
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key

            if (typeof value === 'string' || typeof value === 'number') {
                this.indexValue(String(value), {
                    sourceTransactionId: transactionId,
                    location: 'body_field',
                    field: currentPath,
                    timestamp
                })
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.indexJsonObject(value, currentPath, transactionId, timestamp)
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (typeof item === 'string' || typeof item === 'number') {
                        this.indexValue(String(item), {
                            sourceTransactionId: transactionId,
                            location: 'body_field',
                            field: `${currentPath}[${index}]`,
                            timestamp
                        })
                    }
                })
            }
        }
    }

    private indexValue(value: string, entry: Omit<ResponseDataEntry, 'value'>) {
        if (!this.shouldIndexValue(value)) return

        const fullEntry: ResponseDataEntry = { value, ...entry }

        if (!this.valueIndex.has(value)) {
            this.valueIndex.set(value, [])
        }
        this.valueIndex.get(value)!.push(fullEntry)
    }

    private shouldIndexValue(value: string): boolean {
        // Skip very short values
        if (value.length < 4) return false

        // Skip very common HTTP values
        const commonValues = new Set([
            'application/json', 'text/html', 'GET', 'POST', 'PUT', 'DELETE',
            'true', 'false', 'null', 'undefined', '200', '404', '500',
            'OK', 'Not Found', 'Internal Server Error'
        ])
        if (commonValues.has(value)) return false

        // Index anything that looks interesting
        return this.looksLikeId(value) ||
               this.looksLikeToken(value) ||
               this.looksLikeUrl(value) ||
               this.looksLikeEmail(value) ||
               value.length > 12
    }

    private parseCookieHeader(setCookieValue: string): Map<string, string> {
        const cookies = new Map<string, string>()
        
        // Parse Set-Cookie header: "name=value; Path=/; HttpOnly"
        const parts = setCookieValue.split(';')
        if (parts.length > 0) {
            const [name, value] = parts[0].trim().split('=')
            if (name && value) {
                cookies.set(name, value)
            }
        }
        
        return cookies
    }

    private extractTokensFromString(text: string): string[] {
        const tokens: string[] = []
        
        // JWT pattern
        const jwtMatches = text.match(/[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g)
        if (jwtMatches) tokens.push(...jwtMatches)
        
        // UUID pattern
        const uuidMatches = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)
        if (uuidMatches) tokens.push(...uuidMatches)
        
        // Long alphanumeric strings
        const tokenMatches = text.match(/[a-zA-Z0-9_-]{16,}/g)
        if (tokenMatches) tokens.push(...tokenMatches)
        
        return tokens
    }

    private cleanupOldEntries(cutoffTime: number) {
        let totalEntries = 0
        
        for (const [value, entries] of this.valueIndex.entries()) {
            const validEntries = entries.filter(entry => entry.timestamp > cutoffTime)
            
            if (validEntries.length === 0) {
                this.valueIndex.delete(value)
            } else if (validEntries.length !== entries.length) {
                this.valueIndex.set(value, validEntries)
            }
            
            totalEntries += validEntries.length
        }

        // If we still have too many entries, remove oldest
        if (totalEntries > this.maxEntries) {
            this.trimToMaxEntries()
        }

        // Cleanup transaction data as well
        for (const [id, transaction] of this.transactionData.entries()) {
            if (transaction.timing.startTime < cutoffTime) {
                this.transactionData.delete(id)
            }
        }
    }

    private trimToMaxEntries() {
        // Collect all entries with timestamps
        const allEntries: (ResponseDataEntry & { mapKey: string })[] = []
        
        for (const [value, entries] of this.valueIndex.entries()) {
            for (const entry of entries) {
                allEntries.push({ ...entry, mapKey: value })
            }
        }
        
        // Sort by timestamp (oldest first)
        allEntries.sort((a, b) => a.timestamp - b.timestamp)
        
        // Keep only the newest maxEntries
        const entriesToKeep = allEntries.slice(-this.maxEntries)
        
        // Rebuild the index
        this.valueIndex.clear()
        for (const entry of entriesToKeep) {
            const { mapKey, ...entryData } = entry
            if (!this.valueIndex.has(mapKey)) {
                this.valueIndex.set(mapKey, [])
            }
            this.valueIndex.get(mapKey)!.push(entryData)
        }
    }

    private looksLikeId(value: string): boolean {
        if (/^\d+$/.test(value) && value.length > 0) return true
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true
        if (/^[a-zA-Z0-9_-]{8,}$/.test(value)) return true
        return false
    }

    private looksLikeToken(value: string): boolean {
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value)) return true
        if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 20) return true
        if (/^[a-fA-F0-9]{32,}$/.test(value)) return true
        return false
    }

    private looksLikeUrl(value: string): boolean {
        try {
            new URL(value)
            return true
        } catch {
            return false
        }
    }

    private looksLikeEmail(value: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    }
}

/**
 * Main dependency detector that performs reverse lookup analysis
 */
export class ReverseLookupDependencyDetector {
    private responseIndex = new ResponseDataIndex()
    private valueExtractor = new RequestValueExtractor()

    analyzeRequest(transaction: TransactionData, transactionId: string): TransactionDependency[] {
        const dependencies: TransactionDependency[] = []

        try {
            // Extract all interesting values from the current request
            const requestValues = this.valueExtractor.extractAllValues(transaction)

            logger.debug('Analyzing request for dependencies', {
                transactionId,
                url: transaction.request.url.full,
                method: transaction.request.method,
                extractedValuesCount: requestValues.length
            })

            // For each value, look backwards to see where it came from
            for (const requestValue of requestValues) {
                const origins = this.responseIndex.findValueOrigins(
                    requestValue.value,
                    transaction.timing.startTime
                )

                for (const origin of origins) {
                    const dependency: TransactionDependency = {
                        type: this.determineDependencyType(requestValue, origin),
                        sourceTransactionId: origin.sourceTransactionId,
                        targetTransactionId: transactionId,
                        detail: {
                            field: `${origin.field} -> ${requestValue.field}`,
                            value: requestValue.value,
                            confidence: this.calculateConfidence(requestValue, origin),
                            sourceLocation: origin.location,
                            targetLocation: requestValue.location,
                            timespan: transaction.timing.startTime - origin.timestamp
                        }
                    }

                    dependencies.push(dependency)

                    logger.debug('Found dependency', {
                        type: dependency.type,
                        sourceId: origin.sourceTransactionId,
                        targetId: transactionId,
                        field: dependency.detail.field,
                        value: dependency.detail.value.substring(0, 20) + '...',
                        confidence: dependency.detail.confidence
                    })
                }
            }
        } catch (error) {
            logger.error('Error analyzing request dependencies', {
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            })
        }

        return dependencies
    }

    indexResponse(transaction: TransactionData, transactionId: string) {
        try {
            this.responseIndex.indexResponse(transaction, transactionId)
            
            logger.debug('Indexed response for future dependency analysis', {
                transactionId,
                url: transaction.request.url.full,
                hasResponseBody: !!transaction.response?.body
            })
        } catch (error) {
            logger.error('Error indexing response', {
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            })
        }
    }

    private determineDependencyType(
        requestValue: ExtractedRequestValue,
        origin: ResponseDataEntry
    ): TransactionDependency['type'] {
        // Check for authentication tokens
        if (this.isAuthRelated(requestValue.field) || this.isAuthRelated(origin.field)) {
            return 'auth_token'
        }

        // Check for cookies
        if (requestValue.field.startsWith('cookie:') || origin.field.startsWith('set-cookie:')) {
            return 'cookie'
        }

        // Check for CSRF tokens
        if (this.isCsrfRelated(requestValue.field) || this.isCsrfRelated(origin.field)) {
            return 'csrf'
        }

        // Check for referrer patterns
        if (requestValue.location === 'header' && 
            (requestValue.field.toLowerCase() === 'referer' || requestValue.field.toLowerCase() === 'referrer')) {
            return 'referrer'
        }

        // Default to general data flow
        return 'data_flow'
    }

    private calculateConfidence(
        requestValue: ExtractedRequestValue,
        origin: ResponseDataEntry
    ): number {
        let confidence = 0.5

        // Higher confidence for exact field name matches
        if (this.fieldNamesMatch(requestValue.field, origin.field)) {
            confidence += 0.3
        }

        // Higher confidence for tokens vs simple values
        if (this.looksLikeToken(requestValue.value)) {
            confidence += 0.2
        }

        // Higher confidence for auth/session related fields
        if (this.isAuthRelated(requestValue.field) || this.isAuthRelated(origin.field)) {
            confidence += 0.2
        }

        // Higher confidence for cookie relationships
        if (requestValue.field.startsWith('cookie:') && origin.field.startsWith('set-cookie:')) {
            const cookieName = requestValue.field.replace('cookie:', '')
            const setCookieName = origin.field.replace('set-cookie:', '')
            if (cookieName === setCookieName) {
                confidence += 0.4
            }
        }

        // Lower confidence for very common values
        if (this.isCommonValue(requestValue.value)) {
            confidence -= 0.3
        }

        // Lower confidence for very short values
        if (requestValue.value.length < 8) {
            confidence -= 0.1
        }

        // Higher confidence for longer, more unique values
        if (requestValue.value.length > 32) {
            confidence += 0.1
        }

        return Math.min(Math.max(confidence, 0.1), 1.0)
    }

    private fieldNamesMatch(field1: string, field2: string): boolean {
        const normalize = (field: string) => field.toLowerCase()
            .replace(/[_-]/g, '')
            .replace(/cookie:|set-cookie:/, '')

        return normalize(field1) === normalize(field2)
    }

    private isAuthRelated(field: string): boolean {
        const authFields = [
            'authorization', 'auth', 'token', 'bearer', 'jwt',
            'session', 'sessionid', 'sid', 'access_token', 'api_key'
        ]
        const fieldLower = field.toLowerCase()
        return authFields.some(authField => fieldLower.includes(authField))
    }

    private isCsrfRelated(field: string): boolean {
        const csrfFields = ['csrf', 'xsrf', '_token', 'authenticity_token']
        const fieldLower = field.toLowerCase()
        return csrfFields.some(csrfField => fieldLower.includes(csrfField))
    }

    private isCommonValue(value: string): boolean {
        const commonValues = new Set([
            'true', 'false', 'null', 'undefined', '0', '1', 'yes', 'no',
            'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
        ])
        return commonValues.has(value) || /^\d{1,3}$/.test(value) // short numbers
    }

    private looksLikeToken(value: string): boolean {
        // JWT pattern
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value)) return true
        
        // Long base64-like string
        if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 20) return true
        
        // Long hex string
        if (/^[a-fA-F0-9]{32,}$/.test(value)) return true
        
        // UUID
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true
        
        return false
    }
}
