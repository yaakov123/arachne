# @arachne/recorder - Agent Rules

## Overview
The recorder package provides traffic recording functionality for the Arachne proxy. It implements a storage adapter pattern to persist HTTP/HTTPS traffic data in structured formats for later analysis.

## Architecture

### Core Components
- **`RecorderPlugin`** - Proxy plugin that captures traffic events and forwards to storage
- **`StorageAdapter`** - Interface for different storage backends (file, database, etc.)
- **`FileStorageAdapter`** - Default implementation that writes JSON files per host
- **`InventoryTree`** - Data structure representing captured traffic hierarchy

### Data Model
```
InventoryTree
└── hosts: Record<hostname, HostRecord>
    └── HostRecord
        ├── host: string
        └── endpoints: Record<method_path, EndpointRecord>
            └── EndpointRecord
                ├── method, path, hits, firstSeen, lastSeen
                └── interactions: InteractionRecord[]
                    └── InteractionRecord
                        ├── id, timestamp
                        ├── request: { query, headers, body? }
                        └── response?: { statusCode, headers, body? }
```

## Development Rules

### Storage Adapter Implementation
- **Interface Compliance**: Implement all required methods from `StorageAdapter`
- **Async Safety**: Handle concurrent writes gracefully. Use write queues/chains
- **Memory Management**: Don't accumulate unbounded data in memory
- **Error Handling**: Never let storage errors crash the proxy

### Body Handling
- **Size Limits**: Respect `maxCaptureBytes` to prevent memory exhaustion
- **Content Detection**: Use content-type to determine text vs binary encoding
- **Encoding Strategy**: UTF-8 for text content, base64 for binary with `base64:` prefix
- **Streaming**: Bodies exceeding limits are truncated, not streamed completely

### File Storage Patterns
```typescript
// Good: Atomic writes with error handling
private async enqueueWriteHost(host: string): Promise<void> {
    const prev = this.writeChains.get(host) || Promise.resolve()
    const next = prev
        .then(async () => {
            // Write logic here
            await fs.writeFile(path, data, 'utf8')
        })
        .catch(() => {
            /* swallow to keep chain alive */
        })
    this.writeChains.set(host, next)
    await next
}
```

### Data Normalization
- **Path Normalization**: Remove double slashes, normalize trailing slashes
- **Header Casing**: Convert to lowercase for consistency
- **Query Parameters**: Preserve order and multiple values
- **Method Normalization**: Uppercase HTTP methods
- **OPTIONS Filtering**: Skip OPTIONS requests in recordings by default

### Performance Considerations
- **Write Coalescing**: Batch writes per host to reduce filesystem overhead
- **Memory Efficiency**: Use Maps for O(1) lookups, not arrays
- **Interaction Pruning**: Consider limiting interactions per endpoint
- **Background Writes**: Don't block proxy processing for storage operations

### Security and Privacy
- **Header Redaction**: Redact sensitive headers (Authorization, Cookie, etc.)
- **Body Sanitization**: Consider redacting sensitive request/response bodies
- **File Permissions**: Restrict recorded file access (600 permissions)
- **Path Traversal**: Sanitize hostnames when creating filenames

### Configuration Patterns
```typescript
// Good: Flexible configuration with sensible defaults
export interface RecorderOptions {
    storage?: StorageAdapter
    captureBodies?: boolean
    maxCaptureBytes?: number // default 1MB
    redactHeaders?: string[] // default: ['authorization', 'cookie']
    outputDir?: string // default: ~/.arachne/recorder
}
```

### Custom Storage Adapters
```typescript
// Example: Database storage adapter
export class DatabaseStorageAdapter implements StorageAdapter {
    constructor(private db: Database) {}
    
    recordRequest(ctx: RequestContext): void {
        // Insert request record
        this.db.insert('requests', {
            id: ctx.id,
            hostname: ctx.url.hostname,
            method: ctx.method,
            path: ctx.url.pathname,
            timestamp: new Date(),
            headers: JSON.stringify(ctx.headers)
        })
    }
    
    recordResponse(ctx: ResponseContext): void {
        // Update request record with response data
        this.db.update('requests', 
            { id: ctx.id }, 
            { 
                status_code: ctx.statusCode,
                response_headers: JSON.stringify(ctx.responseHeaders)
            }
        )
    }
    
    snapshot(): InventoryTree {
        // Build tree from database records
        return this.buildTreeFromDb()
    }
}
```

### Testing Guidelines
- **Mock Storage**: Use in-memory storage adapters for tests
- **Concurrent Writes**: Test multiple simultaneous recordings to same host
- **Body Edge Cases**: Test various content-types and sizes
- **Filesystem Scenarios**: Test disk full, permission denied, etc.

### CLI Integration
```typescript
// Good: CLI with flexible storage options
export interface RecorderCLIOptions {
    outputDir?: string
    maxSize?: number
    includeOptions?: boolean
    redactHeaders?: string[]
}

export async function startRecorderProxy(opts: RecorderCLIOptions) {
    const storage = new FileStorageAdapter({ outDir: opts.outputDir })
    const { plugin } = createRecorderPlugin({ 
        storage, 
        maxCaptureBytes: opts.maxSize 
    })
    
    const proxy = new MitmProxyServer({ plugins: [plugin] })
    await proxy.start()
}
```

### File Organization
```
src/
├── plugin.ts          # Main recorder plugin implementation
├── types.ts           # Type definitions and interfaces
├── storage/           # Storage adapter implementations
│   └── file.ts        # Default file-based storage
├── cli.ts             # Command-line interface
└── index.ts           # Public API exports
```

## Common Patterns

### Plugin Creation
```typescript
const storage = new FileStorageAdapter({ outDir: './recordings' })
const { plugin, storage: storageRef } = createRecorderPlugin({
    storage,
    maxCaptureBytes: 2 * 1024 * 1024 // 2MB
})
```

### Data Access
```typescript
// Get recorded data
const inventory = storage.snapshot()
const googleEndpoints = inventory.hosts['www.google.com']?.endpoints

// Reset recordings
storage.reset?.()
```

### Content Type Detection
```typescript
function isTextContent(contentType?: string): boolean {
    if (!contentType) return false
    const ct = contentType.toLowerCase()
    return ct.includes('application/json') ||
           ct.startsWith('text/') ||
           ct.endsWith('+json') ||
           ct.includes('application/xml')
}
```

### Body Sampling
```typescript
function sampleBody(body: Buffer, maxBytes: number): string {
    const sample = body.length > maxBytes ? body.subarray(0, maxBytes) : body
    try {
        return sample.toString('utf8')
    } catch {
        return 'base64:' + sample.toString('base64')
    }
}
```