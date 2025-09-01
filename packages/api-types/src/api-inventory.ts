// API Inventory Types
// These types define schemas for creating an API inventory from HTTP transactions
// allowing us to catalog and understand all APIs that pass through the proxy

import type { AuthMethodConfig } from './auth-profile'

/**
 * Represents an API endpoint discovered from transactions
 */
export interface ApiEndpoint {
    /** Unique identifier for this endpoint */
    id: string
    /** HTTP method (GET, POST, PUT, DELETE, etc.) */
    method: string
    /** Base host/domain */
    host: string
    /** URL path pattern (with parameterized segments) */
    pathPattern: string
    /** Original raw paths that contributed to this pattern */
    rawPaths: string[]
    /** Query parameters discovered across transactions */
    queryParams: ApiQueryParameter[]
    /** Request headers patterns */
    requestHeaders: ApiHeader[]
    /** Response headers patterns */
    responseHeaders: ApiHeader[]
    /** Request body schemas */
    requestBodySchemas: ApiBodySchema[]
    /** Response body schemas */
    responseBodySchemas: ApiBodySchema[]
    /** Authentication methods detected */
    authMethods: DetectedAuthMethod[]
    /** Content types for requests */
    requestContentTypes: string[]
    /** Content types for responses */
    responseContentTypes: string[]
    /** HTTP status codes seen */
    statusCodes: number[]
    /** Usage statistics */
    stats: ApiEndpointStats
    /** First time this endpoint was seen */
    firstSeen: string
    /** Last time this endpoint was seen */
    lastSeen: string
    /** Tags for categorization */
    tags: string[]
}

/**
 * Query parameter discovered in an API endpoint
 */
export interface ApiQueryParameter {
    /** Parameter name */
    name: string
    /** Whether this parameter is required (appeared in all requests) */
    required: boolean
    /** Data type inferred from values */
    type: ApiDataType
    /** Example values seen */
    examples: string[]
    /** Description inferred from patterns */
    description?: string
    /** Validation patterns detected */
    pattern?: string
}

/**
 * Header pattern discovered in API calls
 */
export interface ApiHeader {
    /** Header name */
    name: string
    /** Whether this header is required */
    required: boolean
    /** Data type of the header value */
    type: ApiDataType
    /** Example values (sanitized for sensitive headers) */
    examples: string[]
    /** Whether this header contains sensitive data */
    sensitive: boolean
    /** Pattern detected in values */
    pattern?: string
}

/**
 * Body schema inferred from request/response bodies
 */
export interface ApiBodySchema {
    /** Content type this schema applies to */
    contentType: string
    /** Data format detected */
    format: 'json' | 'xml' | 'form' | 'text' | 'binary' | 'multipart'
    /** Schema definition */
    schema: ApiSchema
    /** Example payloads */
    examples: string[]
    /** How many times this schema was seen */
    frequency: number
}

/**
 * Recursive schema definition for API data structures
 */
export interface ApiSchema {
    /** Data type */
    type: ApiDataType
    /** For object types, the properties */
    properties?: Record<string, ApiSchema>
    /** For array types, the item schema */
    items?: ApiSchema
    /** For union types, the possible schemas */
    oneOf?: ApiSchema[]
    /** Whether this field is required */
    required?: boolean
    /** Example values */
    examples?: any[]
    /** Pattern for string validation */
    pattern?: string
    /** Description inferred from context */
    description?: string
    /** Minimum value for numbers */
    minimum?: number
    /** Maximum value for numbers */
    maximum?: number
    /** Minimum length for strings/arrays */
    minLength?: number
    /** Maximum length for strings/arrays */
    maxLength?: number
    /** Enum values if detected */
    enum?: any[]
}

/**
 * Data types that can be inferred from API data
 */
export type ApiDataType =
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'object'
    | 'array'
    | 'null'
    | 'unknown'

/**
 * Authentication method detected in API calls
 */
export interface DetectedAuthMethod {
    /** Type of authentication */
    method:
        | 'bearer'
        | 'api-key'
        | 'basic'
        | 'jwt'
        | 'oauth2'
        | 'custom-header'
        | 'session'
        | 'unknown'
    /** Location where auth is found */
    placement: 'header' | 'query' | 'cookie' | 'body'
    /** Field name (header name, query param, etc.) */
    fieldName: string
    /** Pattern detected in auth values */
    valuePattern?: string
    /** Confidence level (0-1) */
    confidence: number
    /** Example value (sanitized) */
    exampleValue?: string
    /** Full auth config if extracted */
    config?: AuthMethodConfig
}

/**
 * Usage statistics for an API endpoint
 */
export interface ApiEndpointStats {
    /** Total number of calls */
    totalCalls: number
    /** Number of successful calls (2xx status) */
    successfulCalls: number
    /** Number of failed calls (4xx, 5xx status) */
    failedCalls: number
    /** Average response time in milliseconds */
    avgResponseTime: number
    /** Average request size in bytes */
    avgRequestSize: number
    /** Average response size in bytes */
    avgResponseSize: number
    /** Calls per day over time */
    callsPerDay: Record<string, number>
    /** Error rates per day */
    errorRatesPerDay: Record<string, number>
}

/**
 * API service representing a collection of related endpoints
 */
export interface ApiService {
    /** Unique identifier */
    id: string
    /** Service name (usually derived from host) */
    name: string
    /** Base URL/host */
    baseUrl: string
    /** Description inferred from patterns */
    description?: string
    /** All endpoints in this service */
    endpoints: ApiEndpoint[]
    /** Global authentication methods for this service */
    authMethods: DetectedAuthMethod[]
    /** Service-level tags */
    tags: string[]
    /** When this service was first discovered */
    firstSeen: string
    /** When this service was last seen */
    lastSeen: string
    /** API versioning info if detected */
    versioning?: ApiVersioning
    /** Rate limiting patterns detected */
    rateLimiting?: ApiRateLimiting
}

/**
 * API versioning information
 */
export interface ApiVersioning {
    /** Versioning strategy detected */
    strategy: 'path' | 'header' | 'query' | 'subdomain' | 'none'
    /** Versions discovered */
    versions: string[]
    /** Pattern for version identification */
    pattern?: string
    /** Current/latest version */
    currentVersion?: string
}

/**
 * Rate limiting patterns detected
 */
export interface ApiRateLimiting {
    /** Rate limit headers detected */
    headers: string[]
    /** Rate limit values seen */
    limits: ApiRateLimit[]
    /** Window type (fixed, sliding, etc.) */
    windowType?: 'fixed' | 'sliding' | 'unknown'
}

/**
 * Rate limit configuration detected
 */
export interface ApiRateLimit {
    /** Limit value */
    limit: number
    /** Window duration in seconds */
    windowSeconds: number
    /** Scope (per user, per IP, global) */
    scope: 'user' | 'ip' | 'global' | 'unknown'
    /** Header that indicated this limit */
    sourceHeader: string
}

/**
 * Complete API inventory for a project
 */
export interface ApiInventory {
    /** Project ID this inventory belongs to */
    projectId: string
    /** When this inventory was generated */
    generatedAt: string
    /** Version of inventory schema */
    version: string
    /** All services discovered */
    services: ApiService[]
    /** Global statistics */
    globalStats: ApiInventoryStats
    /** Configuration used for generation */
    config: ApiInventoryConfig
}

/**
 * Global statistics across all APIs
 */
export interface ApiInventoryStats {
    /** Total number of services */
    totalServices: number
    /** Total number of endpoints */
    totalEndpoints: number
    /** Total transactions analyzed */
    totalTransactions: number
    /** Date range of analyzed data */
    dateRange: {
        start: string
        end: string
    }
    /** Most common HTTP methods */
    httpMethods: Record<string, number>
    /** Most common status codes */
    statusCodes: Record<string, number>
    /** Most common content types */
    contentTypes: Record<string, number>
    /** Authentication method distribution */
    authMethods: Record<string, number>
}

/**
 * Configuration for generating API inventory
 */
export interface ApiInventoryConfig {
    /** Minimum number of calls to include an endpoint */
    minCallsThreshold: number
    /** Whether to include sensitive headers in examples */
    includeSensitiveData: boolean
    /** Maximum number of examples to store per schema */
    maxExamples: number
    /** Path similarity threshold for grouping (0-1) */
    pathSimilarityThreshold: number
    /** Whether to infer authentication automatically */
    autoDetectAuth: boolean
    /** Headers to consider sensitive */
    sensitiveHeaders: string[]
    /** Whether to generate OpenAPI specs */
    generateOpenApi: boolean
}

/**
 * OpenAPI specification generated from inventory
 */
export interface ApiOpenApiSpec {
    /** Service this spec is for */
    serviceId: string
    /** OpenAPI version */
    openapi: string
    /** API info */
    info: {
        title: string
        version: string
        description?: string
    }
    /** Servers */
    servers: Array<{
        url: string
        description?: string
    }>
    /** Paths */
    paths: Record<string, any>
    /** Components */
    components?: {
        schemas?: Record<string, any>
        securitySchemes?: Record<string, any>
    }
    /** Security requirements */
    security?: Array<Record<string, any>>
}

/**
 * Events emitted during inventory generation
 */
export interface ApiInventoryEvent {
    type:
        | 'endpoint_discovered'
        | 'service_updated'
        | 'auth_detected'
        | 'schema_inferred'
    timestamp: string
    data: any
}

/**
 * Serialization result from transactions to inventory
 */
export interface TransactionSerializationResult {
    /** Endpoints extracted */
    endpoints: ApiEndpoint[]
    /** Services identified */
    services: ApiService[]
    /** Errors encountered during serialization */
    errors: Array<{
        transactionId: string
        error: string
        details?: any
    }>
    /** Statistics about the serialization process */
    stats: {
        totalTransactions: number
        processedTransactions: number
        skippedTransactions: number
        newEndpoints: number
        updatedEndpoints: number
    }
}
