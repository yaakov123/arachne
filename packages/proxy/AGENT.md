# @arachne/proxy - Agent Rules

## Overview
The proxy package is the core MITM (Man-In-The-Middle) proxy server that intercepts HTTP/HTTPS traffic. It handles certificate generation, TLS termination, plugin orchestration, and traffic forwarding.

## Architecture

### Core Classes
- **`MitmProxyServer`** - Main server class that orchestrates all components
- **`CertificateAuthority`** - Manages root CA and per-host certificate generation
- **`PluginManager`** - Executes plugins in sequence for traffic events
- **`TlsManager`** - Handles HTTPS connections and certificate provisioning
- **`HttpHandler`** - Processes HTTP requests/responses and plugin hooks

### Plugin System
The proxy uses a flexible plugin architecture with these hooks:
- `onConnect(ctx: ConnectContext)` - Called when client connects to proxy
- `onRequest(ctx: RequestContext)` - Called before forwarding request upstream
- `onResponse(ctx: ResponseContext)` - Called after receiving upstream response
- `onRequestBody(ctx: RequestBodyContext)` - Called with decoded request body
- `onResponseBody(ctx: ResponseBodyContext)` - Called with decoded response body
- `onResponseComplete(ctx: ResponseContext)` - Called when response is fully sent
- `onError(err, ctx)` - Called when errors occur

## Development Rules

### Plugin Development
- **Plugin Naming**: Use descriptive names like `traffic-recorder` or `request-logger`
- **Hook Sequencing**: Plugins execute in registration order. Order matters for transformation plugins
- **Error Handling**: Always implement `onError` hook. Never let plugin errors crash the proxy
- **Body Modification**: Use `setBody()` in body contexts to modify request/response content
- **Async Operations**: All plugin hooks can return promises. Proxy waits for completion

### Certificate Management
- **Root CA Security**: The root CA private key is sensitive. Store securely and never commit
- **Host Certificate Caching**: Per-host certificates are cached in memory for performance
- **Certificate Validation**: Always validate certificate expiration and revocation
- **Trust Store**: Use `installRootCATrust()` to install CA in system trust store on macOS

### Request/Response Handling
- **Context Immutability**: Never modify context objects directly. Use provided methods
- **URL Processing**: Always use the `requestOptions` object to modify upstream requests
- **Header Handling**: Headers are case-insensitive. Use consistent casing
- **Body Streaming**: Large bodies are streamed. Body hooks only fire for bodies under size limits

### Error Handling Patterns
```typescript
// Good: Graceful error handling in plugins
export const myPlugin: ProxyPlugin = {
    name: 'my-plugin',
    async onRequest(ctx) {
        try {
            // Plugin logic here
        } catch (err) {
            console.error(`Plugin ${this.name} error:`, err)
            // Don't re-throw unless critical
        }
    },
    onError(err, ctx) {
        console.error(`Error in context ${ctx.id}:`, err)
    }
}
```

### Performance Considerations
- **Certificate Caching**: SecureContext objects are cached per hostname
- **Plugin Efficiency**: Minimize work in hot paths (onRequest/onResponse)
- **Memory Management**: Clean up resources in plugin destructors
- **Connection Pooling**: Reuse upstream connections where possible

### Security Rules
- **CA Key Protection**: Never expose root CA private key via API or logs
- **Header Sanitization**: Sanitize sensitive headers (Authorization, Cookie) in logs
- **Certificate Validation**: Validate upstream certificates unless explicitly bypassed
- **Client IP Tracking**: Use `clientIp` for rate limiting and audit logs

### Configuration Patterns
```typescript
// Good: Flexible configuration with defaults
interface MyPluginOptions {
    enabled?: boolean
    maxSize?: number
    outputDir?: string
}

export function createMyPlugin(opts: MyPluginOptions = {}): ProxyPlugin {
    const {
        enabled = true,
        maxSize = 1024 * 1024,
        outputDir = './output'
    } = opts
    
    return {
        name: 'my-plugin',
        // Implementation...
    }
}
```

### Testing Guidelines
- **Use Test Certificates**: Generate ephemeral CAs for tests, never use production certs
- **Mock Upstream Servers**: Use local test servers for integration tests
- **Plugin Isolation**: Test plugins independently with mock contexts
- **Error Scenarios**: Test network failures, certificate errors, and malformed requests

### CLI Integration
- **Command Structure**: Follow pattern `arachne-proxy <command> [options]`
- **CA Management**: Provide `init-ca`, `install-ca`, `uninstall-ca` commands
- **Proxy Control**: Provide `start`, `stop`, `status` commands
- **Configuration**: Support both CLI flags and environment variables

### File Organization
```
src/
├── proxy/          # Core proxy logic
├── certs/          # Certificate authority and management
├── plugins/        # Built-in plugins
├── os/             # OS-specific functionality (system proxy)
├── cli.ts          # Command-line interface
└── index.ts        # Public API exports
```

## Common Patterns

### Plugin Registration
```typescript
const proxy = new MitmProxyServer({
    plugins: [
        createLoggerPlugin({ level: 'info' }),
    ]
})
```

### Certificate Authority Setup
```typescript
const ca = new CertificateAuthority({
    store: { baseDir: '/custom/ca/path' },
    validityYears: 5
})
await ca.ensureRootCA()
```

### Context Usage
```typescript
const plugin: ProxyPlugin = {
    name: 'url-modifier',
    onRequest(ctx) {
        // Modify upstream request
        ctx.requestOptions.hostname = 'api.example.com'
        ctx.requestOptions.headers['X-Forwarded-For'] = ctx.clientIp
    }
}
```