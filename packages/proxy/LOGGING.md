# Proxy Logging

The `@arachne/proxy` package now includes structured logging capabilities for better debugging and tracing of proxy operations.

## Features

- **Structured JSON logging** with contextual information
- **File-based logging** with automatic rotation (10MB files, 5 files retained)
- **Console output** with colored, human-readable format
- **Dedicated error logs** for easier troubleshooting
- **Request/response correlation** via unique request IDs
- **Component-based logging** for easy filtering

## Log Files

Logs are written to `packages/proxy/logs/` by default:

- `proxy.log` - All log entries
- `proxy-error.log` - Error-level entries only

Note: If the proxy package directory is not writable, logs will fall back to the system temp directory.

## Log Levels

- `error` - Critical errors that affect proxy functionality
- `warn` - Warnings about non-critical issues
- `info` - General operational information (default level)
- `debug` - Detailed debugging information

## Usage

### Basic Usage

The logger is automatically integrated throughout the proxy components. Simply use the proxy as normal:

```typescript
import { MitmProxyServer } from '@arachne/proxy'

const proxy = new MitmProxyServer({
  host: '127.0.0.1',
  port: 8899
})

await proxy.start() // Logs: "Proxy server started"
```

### Accessing the Logger

You can access the logger directly for custom logging:

```typescript
import { logger } from '@arachne/proxy'

// Log with context
logger.info('Custom operation completed', {
  component: 'my-component',
  requestId: 'req-123',
  duration: 250
})

// Log errors with stack traces
logger.error('Operation failed', error, {
  component: 'my-component',
  requestId: 'req-123'
})
```

### Adjusting Log Level

```typescript
import { logger } from '@arachne/proxy'

// Enable debug logging
logger.setLevel('debug')

// Disable most logging (errors only)
logger.setLevel('error')
```

## Log Structure

Each log entry includes:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "Request received",
  "service": "arachne-proxy",
  "component": "http-handler",
  "requestId": "req-abc123",
  "method": "GET",
  "url": "https://example.com/api/data",
  "hostname": "example.com",
  "port": 443
}
```

## Common Log Messages

### Request Flow
- `Request received` - HTTP request started processing
- `Response sent` - HTTP response completed
- `CONNECT tunnel established` - HTTPS tunnel created successfully
- `Direct tunnel connection established` - Direct tunnel (ignored hosts) connected
- `Starting bidirectional data piping` - Data flow initiated between client and upstream

### Errors with Detailed Context
- `Proxy error occurred` - General proxy errors with socket state information
- `HTTP request handling failed` - Request processing errors with response state
- `Upstream request failed` - Errors connecting to target servers with connection details
- `TLS server error` - Certificate or TLS-related errors with socket information
- `Client socket error` - Client connection errors with detailed socket state
- `Direct tunnel connection failed` - Direct tunnel errors with connection context

### Socket Error Handling
- `Sending 400/500/502 response` - Error response being sent to client
- `Cannot send response - headers already sent` - Response state conflicts
- `Failed to write error response` - Socket write failures during error handling
- `Client socket already destroyed` - Connection state when attempting to write

### Connection Lifecycle
- `Direct tunnel HTTP response received` - Upstream response in direct tunnel
- `Direct tunnel HTTP request sent` - Request forwarded to upstream
- `Cleaning up direct tunnel connection` - Connection teardown with reason
- `Upstream socket closed` - Upstream connection terminated

### System Integration
- `Proxy server started` - Server successfully bound to port
- `Proxy server stopped` - Server shutdown completed
- `System proxy enabled/disabled` - OS proxy settings changed

## Enhanced Error Context

The proxy now provides extensive context for all error conditions:

### Socket State Information
- `socketInfo.destroyed` - Whether the socket has been destroyed
- `socketInfo.readable/writable` - Socket read/write capabilities  
- `socketInfo.remoteAddress/remotePort` - Client connection details
- `socketInfo.localAddress/localPort` - Server binding information

### Response State Tracking
- `responseInfo.headersSent` - Whether HTTP headers have been sent
- `responseInfo.finished` - Whether the response has been completed
- `responseInfo.destroyed` - Whether the response stream is destroyed
- `responseInfo.writable` - Whether the response can be written to

### Error Codes and Details
- `errorCode` - System error codes (ECONNREFUSED, ETIMEDOUT, etc.)
- `errorErrno` - Numeric error codes
- `originalError` - Original error message when handling fails
- `stack` - Full error stack traces

## Troubleshooting

1. **Check log files** in `packages/proxy/logs/` for detailed error information
2. **Enable debug logging** with `logger.setLevel('debug')` for verbose output
3. **Search by request ID** to trace specific request flows
4. **Filter by component** to focus on specific proxy subsystems
5. **Look for socket state info** in error logs to understand connection issues
6. **Check response state** to debug header/body sending problems

## Log Rotation

- Log files are automatically rotated when they exceed 10MB
- Up to 5 historical log files are retained
- Older log files are automatically deleted
