# @arachne/backend - Agent Rules

## Overview
The backend application is a Fastify-based server that integrates the MITM proxy with real-time WebSocket broadcasting and HTTP API endpoints. It serves as the central hub for traffic collection, analysis, and distribution to connected clients.

## Architecture

### Core Components
- **Fastify Server** - HTTP/WebSocket server with CORS and auth middleware
- **MitmProxyServer** - Embedded proxy server with plugins
- **WsHub** - WebSocket connection manager with broadcasting capabilities
- **BroadcastPlugin** - Proxy plugin that sends real-time traffic to WebSocket clients
- **RecorderPlugin** - Proxy plugin that persists traffic to storage
- **HTTP API** - RESTful endpoints for accessing recorded traffic and proxy configuration

### Plugin Integration Pattern
```
HTTP Traffic → MITM Proxy → [BroadcastPlugin, RecorderPlugin] → [WebSockets, Storage]
```

## Development Rules

### Server Configuration
- **Environment Variables**: Use `envStr()` and `envNum()` helpers for consistent configuration
- **CORS Configuration**: Support both wildcard and explicit origins
- **Authentication**: Use Bearer token authentication for API routes
- **Graceful Shutdown**: Handle SIGINT/SIGTERM with proper cleanup order

```typescript
// Good: Configuration pattern
const BACKEND_HOST = envStr('BACKEND_HOST', '127.0.0.1')
const BACKEND_PORT = envNum('BACKEND_PORT', 8080)
const BACKEND_TOKEN = process.env['BACKEND_TOKEN']
```

### WebSocket Hub Management
- **Connection Lifecycle**: Handle connect, message, ping/pong, disconnect events
- **Client Tracking**: Assign unique IDs to clients and track connection health
- **Broadcast Efficiency**: Serialize events once, send to multiple clients
- **Buffer Management**: Close connections with excessive buffered data
- **Heartbeat System**: Use ping/pong to detect dead connections

```typescript
// Good: Robust broadcast implementation
broadcast(ev: BackendEvent) {
    const asJson = JSON.stringify(ev)
    for (const client of this.clients.values()) {
        if (client.socket.readyState !== 1) continue
        if (client.socket.bufferedAmount > this.maxBufferedBytes) {
            client.socket.close(1009, 'Too much buffered data')
            continue
        }
        try {
            client.socket.send(asJson)
        } catch {
            // Handle send errors gracefully
        }
    }
}
```

### Plugin Development Pattern
- **Plugin Order**: Broadcast plugin should come before recorder plugin to catch interceptions
- **Transaction Tracking**: Maintain request-response state for completion events
- **Content Analysis**: Detect content types and formats for better UI display
- **Header Sensitivity**: Mark sensitive headers for special UI treatment
- **Error Handling**: Always handle errors gracefully without crashing proxy

```typescript
// Good: Transaction state management
interface TransactionState {
    requestStartTime: number
    responseStartTime?: number
    method: string
    url: RequestURL
    // ... other fields
}

const transactions = new Map<string, TransactionState>()
```

### Content Processing Rules
- **Body Sampling**: Respect size limits to prevent memory exhaustion
- **Encoding Detection**: Use content-type to determine text vs binary encoding
- **Format Detection**: Automatically detect JSON, XML, HTML, etc. from content
- **Compression Handling**: Track whether content was originally compressed
- **Security**: Mark sensitive headers and consider body content privacy

```typescript
// Good: Content type detection
function detectContentFormat(contentType?: string, sample?: string): ContentFormat {
    const ct = (contentType || '').toLowerCase()
    
    if (ct.includes('application/json')) return 'json'
    if (ct.includes('text/html')) return 'html'
    if (ct.startsWith('text/')) return 'text'
    
    // Fallback to sample-based detection
    if (sample?.trim().startsWith('{')) return 'json'
    if (sample?.trim().startsWith('<')) return 'xml'
    
    return 'binary'
}
```

### HTTP API Design
- **RESTful Routes**: Use consistent REST patterns for resource access
- **Authentication**: Implement optional Bearer token auth with preHandler hooks
- **Error Responses**: Return consistent error shapes with appropriate HTTP codes
- **Type Safety**: Use shared types from `@arachne/api-types`

```typescript
// Good: API endpoint pattern
app.get(`${prefix}/hosts/:host`, { preHandler: auth }, async (req, rep) => {
    const inventory = storage.snapshot() as InventoryTree
    const host = (req.params as any).host as string
    const data = inventory.hosts[host]
    
    if (!data) {
        return rep.code(404).send({ error: 'Host not found' })
    }
    
    rep.send(data)
})
```

### Real-time Event Broadcasting
- **Event Types**: Use discriminated unions for type-safe event handling
- **Timing Data**: Include request/response timing for performance analysis
- **Content Metadata**: Provide rich content information for UI display
- **Transaction Completion**: Send consolidated transaction data when responses complete

### Error Handling Patterns
- **Plugin Errors**: Log errors but don't crash the proxy
- **WebSocket Errors**: Handle send failures gracefully
- **Storage Errors**: Continue operation even if persistence fails
- **Shutdown Errors**: Log but don't prevent graceful shutdown

```typescript
// Good: Error handling in plugins
onError(err: unknown, ctx: Partial<RequestContext>) {
    try {
        const errorEvent = {
            type: 'error',
            id: ctx?.id || genId('err'),
            ts: nowIso(),
            message: err instanceof Error ? err.message : String(err)
        }
        hub.broadcast(errorEvent)
        
        // Clean up transaction state if possible
        if (ctx?.id) completeTransaction(ctx.id)
    } catch {
        // Even error handling can fail - don't crash
    }
}
```

### Performance Considerations
- **Event Serialization**: Serialize events once for all WebSocket clients
- **Memory Management**: Clean up transaction state after completion
- **Connection Limits**: Consider limiting concurrent WebSocket connections
- **Buffer Management**: Monitor and limit per-connection buffer sizes

### Development Workflow
- **Hot Reload**: Use `tsx watch` for development with automatic restarts
- **Testing**: Test proxy plugins, WebSocket connections, and HTTP endpoints separately
- **Logging**: Use Fastify's structured logging for better observability
- **Health Checks**: Implement health endpoints for monitoring

### Security Considerations
- **Header Redaction**: Mark sensitive headers in broadcast events
- **Token Authentication**: Use Bearer tokens for API access
- **CORS Policy**: Configure appropriate CORS origins for production
- **WebSocket Auth**: Consider adding WebSocket authentication for sensitive environments

### File Organization
```
src/
├── index.ts           # Main server entry point and configuration
├── api.ts             # HTTP API route definitions
├── broadcast-plugin.ts # Real-time WebSocket broadcasting plugin
├── ws-hub.ts          # WebSocket connection management
├── types.ts           # Backend-specific type definitions
├── cleanup.ts         # Development utility for cleaning up processes
└── tests/             # Unit tests for plugins and components
```

## Common Patterns

### Server Initialization
```typescript
async function main() {
    // Configuration
    const BACKEND_PORT = envNum('BACKEND_PORT', 8080)
    const PROXY_PORT = envNum('ARACHNE_PROXY_PORT', 8899)
    
    // Components
    const app = fastify({ logger: true })
    const hub = new WsHub()
    const storage = new FileStorageAdapter({ outDir: REC_OUT_DIR })
    const ca = new CertificateAuthority({ store })
    
    // Setup
    await app.register(cors, { origin: true })
    await app.register(websocket)
    await registerApi(app, { prefix: '/api', storage, ca })
    
    // Plugins
    const broadcastPlugin = createBroadcastPlugin({ hub })
    const { plugin: recorderPlugin } = createRecorderPlugin({ storage })
    
    // Start
    await app.listen({ port: BACKEND_PORT })
    const proxy = new MitmProxyServer({ 
        port: PROXY_PORT, 
        ca, 
        plugins: [broadcastPlugin, recorderPlugin] 
    })
    await proxy.start()
}
```

### WebSocket Event Broadcasting
```typescript
// Broadcast transaction completion
const transactionEvent: TransactionCompleteEvent = {
    type: 'transactionComplete',
    id: ctx.id,
    ts: nowIso(),
    transaction: {
        request: { method, url, headers, body },
        response: { statusCode, headers, body },
        timing: { startTime, responseTime, duration },
        summary: { requestSize, responseSize, hasBody }
    }
}
hub.broadcast(transactionEvent)
```

### API Authentication
```typescript
const auth = async (req: FastifyRequest, rep: FastifyReply) => {
    if (!token) return
    const authHeader = req.headers['authorization']
    const match = /^Bearer\s+(.+)$/i.exec(authHeader || '')
    if (!match || match[1] !== token) {
        return rep.code(401).send({ error: 'Unauthorized' })
    }
}
```