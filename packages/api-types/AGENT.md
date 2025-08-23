# @arachne/api-types - Agent Rules

## Overview
The api-types package provides shared TypeScript interfaces and type definitions for communication between the backend and frontend. It ensures type safety across HTTP APIs and WebSocket messaging.

## Architecture

### Core Components
- **HTTP Types** (`http.ts`) - REST API request/response interfaces
- **WebSocket Types** (`ws.ts`) - Real-time messaging event interfaces  
- **Route Constants** - Centralized API endpoint definitions

### Type Categories
1. **Data Models** - Core domain types (InventoryTree, HostRecord, etc.)
2. **API Contracts** - HTTP request/response shapes
3. **WebSocket Events** - Real-time event message formats
4. **Display Helpers** - UI-friendly data structures

## Development Rules

### Type Definition Principles
- **Immutability**: Prefer `readonly` arrays and properties where applicable
- **Strict Typing**: Avoid `any` type. Use union types and generics instead
- **Consistent Naming**: Use PascalCase for interfaces, camelCase for properties
- **Documentation**: Include JSDoc comments for complex types and business logic

### HTTP API Patterns
```typescript
// Good: Clear request/response pairs
export interface CreateUserRequest {
    name: string
    email: string
}

export interface CreateUserResponse {
    id: string
    name: string  
    email: string
    createdAt: string // ISO timestamp
}

// Good: Consistent error response shape
export interface ErrorResponse {
    error: {
        code: string
        message: string
        details?: Record<string, unknown>
    }
}
```

### WebSocket Event Design
- **Event Types**: Use discriminated unions with `type` field
- **Base Interface**: Extend common `BaseEvent` for shared properties  
- **Payload Structure**: Keep event payloads flat and serializable
- **Versioning**: Include version field for future compatibility

```typescript
// Good: Discriminated union pattern
export type BackendEvent = 
    | RequestEvent 
    | ResponseHeadEvent 
    | ErrorEvent

export interface BaseEvent {
    type: string
    id: string
    ts: string // ISO timestamp
}

export interface RequestEvent extends BaseEvent {
    type: 'request'
    method: string
    url: RequestURL
    headers: DisplayHeader[]
}
```

### Data Transformation Types
- **Display Types**: Create UI-friendly versions of internal types
- **Serialization**: Ensure all types are JSON-serializable
- **Normalization**: Provide consistent data shapes across different sources

```typescript
// Good: UI-specific data transformation
export interface DisplayHeader {
    name: string
    value: string
    sensitive?: boolean // for UI styling
}

// Transform from raw headers
export function toDisplayHeaders(
    headers: Record<string, string | string[]>
): DisplayHeader[] {
    return Object.entries(headers).map(([name, value]) => ({
        name: name.toLowerCase(),
        value: Array.isArray(value) ? value.join(', ') : value,
        sensitive: ['authorization', 'cookie'].includes(name.toLowerCase())
    }))
}
```

### Route Management
- **Constants**: Define all API routes as constants to prevent typos
- **Parameterization**: Use functions for dynamic routes
- **Consistency**: Match backend route definitions exactly

```typescript
// Good: Centralized route definitions
export const HttpRoutes = {
    health: '/health',
    inventory: `${API_PREFIX}/inventory`,
    host: (host: string) => `${API_PREFIX}/hosts/${encodeURIComponent(host)}`,
} as const
```

### Content Handling Types
```typescript
// Good: Rich content metadata for different content types
export interface ContentInfo {
    contentType?: string
    contentEncoding?: string
    size: number
    sampleSize: number
    truncated: boolean
    detectedFormat?: 'json' | 'xml' | 'html' | 'text' | 'binary'
    encoding: 'utf8' | 'base64'
    isCompressed?: boolean
}
```

### Validation and Guards
```typescript
// Good: Type guards for runtime validation
export function isRequestEvent(event: BackendEvent): event is RequestEvent {
    return event.type === 'request'
}

export function hasRequestBody(event: BackendEvent): boolean {
    return event.type === 'requestBody'
}

// Good: Validation helpers
export function validateInventoryTree(obj: unknown): obj is InventoryTree {
    return typeof obj === 'object' &&
           obj !== null &&
           'hosts' in obj &&
           typeof (obj as any).hosts === 'object'
}
```

### Performance Considerations
- **Optional Properties**: Use optional properties to reduce payload size
- **Chunked Data**: Design types for streaming/pagination when appropriate
- **Minimal Payloads**: Only include necessary data in events

### Testing Patterns
```typescript
// Good: Factory functions for test data
export function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
        type: 'request',
        id: 'test-id',
        ts: new Date().toISOString(),
        method: 'GET',
        url: createMockRequestURL(),
        headers: [],
        rawHeaders: {},
        timestamp: Date.now(),
        ...overrides
    }
}
```

### Backwards Compatibility
- **Versioning Strategy**: Add version fields to major interfaces
- **Deprecation**: Mark deprecated fields with JSDoc `@deprecated`
- **Migration**: Provide utilities for converting between versions

```typescript
// Good: Versioned API response
export interface ApiResponse<T = unknown> {
    version: string
    data: T
    meta?: {
        timestamp: string
        requestId: string
    }
}

// Good: Backward compatibility
export interface LegacyResponse {
    /** @deprecated Use ApiResponse wrapper instead */
    result: unknown
}
```

### Documentation Standards
```typescript
/**
 * Represents a complete HTTP transaction from request to response.
 * Used for displaying complete interactions in the UI.
 * 
 * @example
 * ```typescript
 * const transaction: TransactionData = {
 *   request: { method: 'GET', url: '/', headers: [] },
 *   response: { statusCode: 200, headers: [] },
 *   timing: { startTime: Date.now() }
 * }
 * ```
 */
export interface TransactionData {
    request: {
        method: string
        url: RequestURL
        // ... other fields
    }
    // ... rest of interface
}
```

## File Organization
```
src/
├── http.ts           # HTTP API contracts and routes
├── ws.ts            # WebSocket event definitions  
├── index.ts         # Re-exports all public types
└── utils.ts         # Type utilities and guards (optional)
```

## Common Patterns

### Event Handling
```typescript
// Frontend event handler
function handleBackendEvent(event: BackendEvent) {
    switch (event.type) {
        case 'request':
            handleRequestEvent(event) // TypeScript knows this is RequestEvent
            break
        case 'responseHead':
            handleResponseEvent(event) // TypeScript knows this is ResponseHeadEvent
            break
        default:
            // TypeScript ensures exhaustive handling
            const _exhaustive: never = event
            break
    }
}
```

### API Client Integration
```typescript
// Type-safe HTTP client
class ApiClient {
    async getInventory(): Promise<InventoryTree> {
        const response = await fetch(HttpRoutes.inventory)
        return response.json() as InventoryTree
    }
    
    async getHost(hostname: string): Promise<HostRecord> {
        const response = await fetch(HttpRoutes.host(hostname))
        return response.json() as HostRecord
    }
}
```

### State Management
```typescript
// Pinia/Vuex store with typed state
interface AppState {
    inventory: InventoryTree | null
    selectedHost: string | null
    recentTransactions: TransactionData[]
}
```