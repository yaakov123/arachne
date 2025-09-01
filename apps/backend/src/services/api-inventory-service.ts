import type {
    TransactionData,
    ApiEndpoint,
    ApiService,
    ApiInventory,
    ApiInventoryConfig,
    TransactionSerializationResult,
    ApiSchema,
    ApiDataType,
    DetectedAuthMethod,
    ApiQueryParameter,
    ApiHeader,
    ApiBodySchema,
    ApiEndpointStats,
    ApiInventoryStats,
} from '@arachne/api-types'
import { TransactionRepository } from '@arachne/database'
import { AuthDetectionService } from './auth-detection-service'

/**
 * Service for converting HTTP transactions into structured API inventory
 */
export class ApiInventoryService {
    private readonly defaultConfig: ApiInventoryConfig = {
        minCallsThreshold: 1,
        includeSensitiveData: false,
        maxExamples: 5,
        pathSimilarityThreshold: 0.8,
        autoDetectAuth: true,
        sensitiveHeaders: [
            'authorization',
            'x-api-key',
            'cookie',
            'set-cookie',
            'x-auth-token',
            'x-access-token',
            'x-csrf-token',
        ],
        generateOpenApi: false,
    }

    private readonly config: ApiInventoryConfig
    private readonly transactionRepository: TransactionRepository
    private readonly authDetectionService: AuthDetectionService

    constructor(
        config: Partial<ApiInventoryConfig> = {},
        transactionRepository?: TransactionRepository
    ) {
        this.config = { ...this.defaultConfig, ...config }
        this.transactionRepository =
            transactionRepository || new TransactionRepository()
        this.authDetectionService = new AuthDetectionService()
    }

    /**
     * Generate complete API inventory for a project from database
     */
    async generateApiInventory(projectId: string): Promise<ApiInventory> {
        // Fetch all transactions with related data
        const dbTransactions =
            await this.transactionRepository.findByProjectWithAllRelatedData(
                projectId
            )

        // Convert database transactions to TransactionData format
        const transactions = dbTransactions.map((dbTx) => ({
            id: dbTx.id,
            transaction: this.convertDbTransactionToTransactionData(dbTx),
        }))

        // Serialize transactions
        const result = this.serializeTransactions(transactions)

        // Generate global stats
        const globalStats = this.generateGlobalStats(result, dbTransactions)

        return {
            projectId,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
            services: result.services,
            globalStats,
            config: this.config,
        }
    }

    /**
     * Serialize multiple transactions into API inventory data
     */
    serializeTransactions(
        transactions: Array<{ id: string; transaction: TransactionData }>
    ): TransactionSerializationResult {
        const result: TransactionSerializationResult = {
            endpoints: [],
            services: [],
            errors: [],
            stats: {
                totalTransactions: transactions.length,
                processedTransactions: 0,
                skippedTransactions: 0,
                newEndpoints: 0,
                updatedEndpoints: 0,
            },
        }

        const endpointMap = new Map<string, ApiEndpoint>()
        const serviceMap = new Map<string, ApiService>()

        for (const { id, transaction } of transactions) {
            try {
                const endpoint = this.extractEndpointFromTransaction(
                    id,
                    transaction
                )
                if (endpoint) {
                    const existingEndpoint = endpointMap.get(endpoint.id)
                    if (existingEndpoint) {
                        this.mergeEndpoint(existingEndpoint, endpoint)
                        result.stats.updatedEndpoints++
                    } else {
                        endpointMap.set(endpoint.id, endpoint)
                        result.stats.newEndpoints++
                    }
                    result.stats.processedTransactions++
                } else {
                    result.stats.skippedTransactions++
                }
            } catch (error) {
                result.errors.push({
                    transactionId: id,
                    error:
                        error instanceof Error ? error.message : String(error),
                    details: error,
                })
                result.stats.skippedTransactions++
            }
        }

        // Group endpoints into services
        for (const endpoint of endpointMap.values()) {
            const serviceId = this.getServiceId(endpoint.host)
            let service = serviceMap.get(serviceId)
            if (!service) {
                service = this.createServiceFromEndpoint(endpoint)
                serviceMap.set(serviceId, service)
            } else {
                this.addEndpointToService(service, endpoint)
            }
        }

        result.endpoints = Array.from(endpointMap.values())
        result.services = Array.from(serviceMap.values())

        return result
    }

    /**
     * Extract API endpoint data from a single transaction
     */
    private extractEndpointFromTransaction(
        _transactionId: string,
        transaction: TransactionData
    ): ApiEndpoint | null {
        const { request, response, timing, summary } = transaction

        if (!request.url) {
            return null
        }

        const pathPattern = this.extractPathPattern(request.url.path)
        const endpointId = this.generateEndpointId(
            request.method,
            request.url.host,
            pathPattern
        )

        const endpoint: ApiEndpoint = {
            id: endpointId,
            method: request.method.toUpperCase(),
            host: request.url.host,
            pathPattern,
            rawPaths: [request.url.path],
            queryParams: this.extractQueryParameters(request.url.query),
            requestHeaders: this.extractHeaders(request.headers, 'request'),
            responseHeaders: response
                ? this.extractHeaders(response.headers, 'response')
                : [],
            requestBodySchemas: request.body
                ? [this.extractBodySchema(request.body)]
                : [],
            responseBodySchemas: response?.body
                ? [this.extractBodySchema(response.body)]
                : [],
            authMethods: this.detectAuthMethods(request),
            requestContentTypes: request.body?.content.contentType
                ? [request.body.content.contentType]
                : [],
            responseContentTypes: response?.body?.content.contentType
                ? [response.body.content.contentType]
                : [],
            statusCodes: response ? [response.statusCode] : [],
            stats: this.createInitialStats(timing, summary),
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            tags: this.generateTags(request, response),
        }

        return endpoint
    }

    /**
     * Extract path pattern by parameterizing dynamic segments
     */
    private extractPathPattern(path: string): string {
        // Simple parameterization - replace UUIDs, numbers, and other dynamic segments
        return path
            .replace(
                /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
                '/{id}'
            )
            .replace(/\/\d+/g, '/{id}')
            .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/{token}')
    }

    /**
     * Generate unique endpoint ID
     */
    private generateEndpointId(
        method: string,
        host: string,
        pathPattern: string
    ): string {
        return `${method}:${host}${pathPattern}`
    }

    /**
     * Extract query parameters with type inference
     */
    private extractQueryParameters(queryString?: string): ApiQueryParameter[] {
        if (!queryString) return []

        const params: ApiQueryParameter[] = []
        const urlParams = new URLSearchParams(queryString)

        for (const [name, value] of urlParams.entries()) {
            params.push({
                name,
                required: false, // Will be determined when merging multiple transactions
                type: this.inferDataType(value),
                examples: [value],
                pattern: this.extractPattern(value),
            })
        }

        return params
    }

    /**
     * Extract headers with sensitivity detection
     */
    private extractHeaders(
        headers: Array<{ name: string; value: string }>,
        _type: 'request' | 'response'
    ): ApiHeader[] {
        return headers.map((header) => ({
            name: header.name.toLowerCase(),
            required: false, // Will be determined when merging
            type: this.inferDataType(header.value),
            examples: this.isSensitiveHeader(header.name)
                ? ['[REDACTED]']
                : [header.value],
            sensitive: this.isSensitiveHeader(header.name),
            pattern: this.isSensitiveHeader(header.name)
                ? undefined
                : this.extractPattern(header.value),
        }))
    }

    /**
     * Extract body schema from transaction body
     */
    private extractBodySchema(body: {
        content: any
        sample: string
    }): ApiBodySchema {
        const schema = this.inferSchemaFromSample(
            body.sample,
            body.content.detectedFormat
        )

        return {
            contentType: body.content.contentType || 'application/octet-stream',
            format: body.content.detectedFormat || 'binary',
            schema,
            examples: [this.sanitizeSample(body.sample)],
            frequency: 1,
        }
    }

    /**
     * Infer schema from sample data
     */
    private inferSchemaFromSample(sample: string, format?: string): ApiSchema {
        if (format === 'json') {
            try {
                const parsed = JSON.parse(sample)
                return this.inferSchemaFromValue(parsed)
            } catch {
                return { type: 'string' }
            }
        }

        if (format === 'xml') {
            return { type: 'string', description: 'XML content' }
        }

        if (format === 'form') {
            const formData = new URLSearchParams(sample)
            const properties: Record<string, ApiSchema> = {}
            for (const [key, value] of formData.entries()) {
                properties[key] = this.inferSchemaFromValue(value)
            }
            return { type: 'object', properties }
        }

        return { type: 'string' }
    }

    /**
     * Recursively infer schema from a value
     */
    private inferSchemaFromValue(value: any): ApiSchema {
        if (value === null) {
            return { type: 'null' }
        }

        if (Array.isArray(value)) {
            return {
                type: 'array',
                items:
                    value.length > 0
                        ? this.inferSchemaFromValue(value[0])
                        : { type: 'unknown' },
            }
        }

        if (typeof value === 'object') {
            const properties: Record<string, ApiSchema> = {}
            for (const [key, val] of Object.entries(value)) {
                properties[key] = this.inferSchemaFromValue(val)
            }
            return { type: 'object', properties }
        }

        return { type: this.inferDataType(value) }
    }

    /**
     * Infer data type from value
     */
    private inferDataType(value: any): ApiDataType {
        if (value === null) return 'null'
        if (typeof value === 'boolean') return 'boolean'
        if (typeof value === 'number')
            return Number.isInteger(value) ? 'integer' : 'number'
        if (typeof value === 'string') {
            // Try to detect if it's actually a number
            if (/^\d+$/.test(value)) return 'integer'
            if (/^\d*\.\d+$/.test(value)) return 'number'
            if (value === 'true' || value === 'false') return 'boolean'
            return 'string'
        }
        if (Array.isArray(value)) return 'array'
        if (typeof value === 'object') return 'object'
        return 'unknown'
    }

    /**
     * Detect authentication methods from request using shared service
     */
    private detectAuthMethods(request: any): DetectedAuthMethod[] {
        // Create a URL object for the auth detection service
        const url = new URL(
            `${request.url.protocol}//${request.url.host}${request.url.path}`
        )
        if (request.url.query) {
            url.search = `?${request.url.query}`
        }

        return this.authDetectionService.detectAuthMethods({
            headers: request.rawHeaders,
            url,
            displayHeaders: request.headers,
            queryString: request.url.query,
        })
    }

    /**
     * Check if header is sensitive
     */
    private isSensitiveHeader(name: string): boolean {
        return this.config.sensitiveHeaders.includes(name.toLowerCase())
    }

    /**
     * Extract pattern from value
     */
    private extractPattern(value: string): string | undefined {
        // Extract common patterns
        if (
            /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
                value
            )
        ) {
            return 'uuid'
        }
        if (/^\d+$/.test(value)) {
            return 'integer'
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
            return 'date'
        }
        return undefined
    }

    /**
     * Sanitize sample for storage
     */
    private sanitizeSample(sample: string): string {
        // Remove potential sensitive data
        const maxLength = 1000
        if (sample.length > maxLength) {
            return sample.substring(0, maxLength) + '...'
        }
        return sample
    }

    /**
     * Create initial endpoint statistics
     */
    private createInitialStats(timing: any, summary: any): ApiEndpointStats {
        return {
            totalCalls: 1,
            successfulCalls: 0, // Will be determined from status code
            failedCalls: 0,
            avgResponseTime: timing.duration || 0,
            avgRequestSize: summary.requestSize || 0,
            avgResponseSize: summary.responseSize || 0,
            callsPerDay: {},
            errorRatesPerDay: {},
        }
    }

    /**
     * Generate tags for endpoint
     */
    private generateTags(request: any, response?: any): string[] {
        const tags: string[] = []

        // Add method tag
        tags.push(`method:${request.method.toLowerCase()}`)

        // Add host tag
        tags.push(`host:${request.url.host}`)

        // Add content type tags
        if (request.body?.content.contentType) {
            tags.push(`request-type:${request.body.content.detectedFormat}`)
        }
        if (response?.body?.content.contentType) {
            tags.push(`response-type:${response.body.content.detectedFormat}`)
        }

        return tags
    }

    /**
     * Merge two endpoints
     */
    private mergeEndpoint(existing: ApiEndpoint, incoming: ApiEndpoint): void {
        // Merge raw paths
        if (!existing.rawPaths.includes(incoming.rawPaths[0])) {
            existing.rawPaths.push(incoming.rawPaths[0])
        }

        // Merge query parameters
        this.mergeQueryParameters(existing.queryParams, incoming.queryParams)

        // Merge headers
        this.mergeHeaders(existing.requestHeaders, incoming.requestHeaders)
        this.mergeHeaders(existing.responseHeaders, incoming.responseHeaders)

        // Merge body schemas
        this.mergeBodySchemas(
            existing.requestBodySchemas,
            incoming.requestBodySchemas
        )
        this.mergeBodySchemas(
            existing.responseBodySchemas,
            incoming.responseBodySchemas
        )

        // Merge content types
        this.mergeArrays(
            existing.requestContentTypes,
            incoming.requestContentTypes
        )
        this.mergeArrays(
            existing.responseContentTypes,
            incoming.responseContentTypes
        )

        // Merge status codes
        this.mergeArrays(existing.statusCodes, incoming.statusCodes)

        // Update stats
        this.updateStats(existing.stats, incoming.stats)

        // Update timestamps
        existing.lastSeen = new Date().toISOString()

        // Merge tags
        this.mergeArrays(existing.tags, incoming.tags)
    }

    /**
     * Merge query parameters
     */
    private mergeQueryParameters(
        existing: ApiQueryParameter[],
        incoming: ApiQueryParameter[]
    ): void {
        for (const incomingParam of incoming) {
            const existingParam = existing.find(
                (p) => p.name === incomingParam.name
            )
            if (existingParam) {
                this.mergeArrays(existingParam.examples, incomingParam.examples)
            } else {
                existing.push(incomingParam)
            }
        }
    }

    /**
     * Merge headers
     */
    private mergeHeaders(existing: ApiHeader[], incoming: ApiHeader[]): void {
        for (const incomingHeader of incoming) {
            const existingHeader = existing.find(
                (h) => h.name === incomingHeader.name
            )
            if (existingHeader) {
                this.mergeArrays(
                    existingHeader.examples,
                    incomingHeader.examples
                )
            } else {
                existing.push(incomingHeader)
            }
        }
    }

    /**
     * Merge body schemas
     */
    private mergeBodySchemas(
        existing: ApiBodySchema[],
        incoming: ApiBodySchema[]
    ): void {
        for (const incomingSchema of incoming) {
            const existingSchema = existing.find(
                (s) => s.contentType === incomingSchema.contentType
            )
            if (existingSchema) {
                existingSchema.frequency++
                this.mergeArrays(
                    existingSchema.examples,
                    incomingSchema.examples
                )
            } else {
                existing.push(incomingSchema)
            }
        }
    }

    /**
     * Merge arrays without duplicates
     */
    private mergeArrays<T>(existing: T[], incoming: T[]): void {
        for (const item of incoming) {
            if (!existing.includes(item)) {
                existing.push(item)
            }
        }
    }

    /**
     * Update endpoint statistics
     */
    private updateStats(
        existing: ApiEndpointStats,
        incoming: ApiEndpointStats
    ): void {
        existing.totalCalls += incoming.totalCalls
        existing.successfulCalls += incoming.successfulCalls
        existing.failedCalls += incoming.failedCalls

        // Update averages
        existing.avgResponseTime =
            (existing.avgResponseTime + incoming.avgResponseTime) / 2
        existing.avgRequestSize =
            (existing.avgRequestSize + incoming.avgRequestSize) / 2
        existing.avgResponseSize =
            (existing.avgResponseSize + incoming.avgResponseSize) / 2
    }

    /**
     * Get service ID from host
     */
    private getServiceId(host: string): string {
        return host.replace(/^www\./, '')
    }

    /**
     * Create new service from endpoint
     */
    private createServiceFromEndpoint(endpoint: ApiEndpoint): ApiService {
        return {
            id: this.getServiceId(endpoint.host),
            name: endpoint.host,
            baseUrl: `https://${endpoint.host}`,
            endpoints: [endpoint],
            authMethods: endpoint.authMethods,
            tags: [`host:${endpoint.host}`],
            firstSeen: endpoint.firstSeen,
            lastSeen: endpoint.lastSeen,
        }
    }

    /**
     * Add endpoint to existing service
     */
    private addEndpointToService(
        service: ApiService,
        endpoint: ApiEndpoint
    ): void {
        service.endpoints.push(endpoint)
        service.lastSeen = endpoint.lastSeen

        // Merge auth methods
        for (const authMethod of endpoint.authMethods) {
            if (
                !service.authMethods.some(
                    (existing) =>
                        existing.method === authMethod.method &&
                        existing.fieldName === authMethod.fieldName
                )
            ) {
                service.authMethods.push(authMethod)
            }
        }
    }

    /**
     * Convert database transaction to TransactionData format
     */
    private convertDbTransactionToTransactionData(dbTx: any): TransactionData {
        // Convert headers from database format to display format
        const requestHeaders = (dbTx.requestHeaders || []).map((h: any) => ({
            name: h.name,
            value: h.value,
        }))

        const responseHeaders = (dbTx.responseHeaders || []).map((h: any) => ({
            name: h.name,
            value: h.value,
        }))

        return {
            request: {
                method: dbTx.method,
                url: {
                    full: dbTx.urlFull,
                    protocol: dbTx.urlProtocol,
                    host: dbTx.urlHost,
                    port: dbTx.urlPort,
                    path: dbTx.urlPath,
                    query: dbTx.urlQuery,
                    fragment: dbTx.urlFragment,
                },
                headers: requestHeaders,
                rawHeaders: this.headersArrayToRecord(requestHeaders),
                clientIp: dbTx.clientIp,
                body: dbTx.requestBody
                    ? {
                          content: {
                              contentType: dbTx.requestBody.contentType,
                              contentEncoding: dbTx.requestBody.contentEncoding,
                              size: dbTx.requestBody.size,
                              sampleSize: dbTx.requestBody.sampleSize,
                              truncated: dbTx.requestBody.truncated,
                              detectedFormat: dbTx.requestBody.detectedFormat,
                              encoding: dbTx.requestBody.encoding,
                              isCompressed: dbTx.requestBody.isCompressed,
                          },
                          sample: dbTx.requestBody.sample,
                      }
                    : undefined,
            },
            response: dbTx.statusCode
                ? {
                      statusCode: dbTx.statusCode,
                      statusMessage: dbTx.statusMessage,
                      headers: responseHeaders,
                      rawHeaders: this.headersArrayToRecord(responseHeaders),
                      body: dbTx.responseBody
                          ? {
                                content: {
                                    contentType: dbTx.responseBody.contentType,
                                    contentEncoding:
                                        dbTx.responseBody.contentEncoding,
                                    size: dbTx.responseBody.size,
                                    sampleSize: dbTx.responseBody.sampleSize,
                                    truncated: dbTx.responseBody.truncated,
                                    detectedFormat:
                                        dbTx.responseBody.detectedFormat,
                                    encoding: dbTx.responseBody.encoding,
                                    isCompressed:
                                        dbTx.responseBody.isCompressed,
                                },
                                sample: dbTx.responseBody.sample,
                            }
                          : undefined,
                  }
                : undefined,
            timing: {
                duration: dbTx.duration || 0,
            },
            summary: {
                hasRequestBody: dbTx.hasRequestBody,
                hasResponseBody: dbTx.hasResponseBody,
                requestSize: dbTx.requestSize,
                responseSize: dbTx.responseSize,
            },
        }
    }

    /**
     * Convert headers array to record format
     */
    private headersArrayToRecord(
        headers: Array<{ name: string; value: string }>
    ): Record<string, string> {
        const record: Record<string, string> = {}
        for (const header of headers) {
            record[header.name] = header.value
        }
        return record
    }

    /**
     * Generate global statistics for the inventory
     */
    private generateGlobalStats(
        result: TransactionSerializationResult,
        dbTransactions: any[]
    ): ApiInventoryStats {
        const httpMethods: Record<string, number> = {}
        const statusCodes: Record<string, number> = {}
        const contentTypes: Record<string, number> = {}
        const authMethods: Record<string, number> = {}

        let earliest = new Date()
        let latest = new Date(0)

        // Analyze database transactions for stats
        for (const tx of dbTransactions) {
            // Track HTTP methods
            httpMethods[tx.method] = (httpMethods[tx.method] || 0) + 1

            // Track status codes
            if (tx.statusCode) {
                const code = tx.statusCode.toString()
                statusCodes[code] = (statusCodes[code] || 0) + 1
            }

            // Track timestamps
            const timestamp = new Date(tx.timestamp)
            if (timestamp < earliest) earliest = timestamp
            if (timestamp > latest) latest = timestamp

            // Track content types from bodies
            if (tx.requestBody?.contentType) {
                const ct = tx.requestBody.contentType
                contentTypes[ct] = (contentTypes[ct] || 0) + 1
            }
            if (tx.responseBody?.contentType) {
                const ct = tx.responseBody.contentType
                contentTypes[ct] = (contentTypes[ct] || 0) + 1
            }
        }

        // Count auth methods from discovered endpoints
        for (const endpoint of result.endpoints) {
            for (const auth of endpoint.authMethods) {
                authMethods[auth.method] = (authMethods[auth.method] || 0) + 1
            }
        }

        return {
            totalServices: result.services.length,
            totalEndpoints: result.endpoints.length,
            totalTransactions: dbTransactions.length,
            dateRange: {
                start: earliest.toISOString(),
                end: latest.toISOString(),
            },
            httpMethods,
            statusCodes,
            contentTypes,
            authMethods,
        }
    }
}
