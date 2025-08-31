# Proxy Plugin API Migration Guide

This guide helps you migrate from the old proxy plugin API to the new simplified API.

## Overview of Changes

The new API simplifies the plugin interface from 7 hooks to 4 main hooks:

-   `beforeRequest` - Modify outgoing requests
-   `afterRequest` - Access final request data (read-only)
-   `beforeResponse` - Modify incoming responses
-   `afterResponse` - Access complete transaction data (read-only)

## Key Improvements

1. **Progressive Context Accumulation**: Each hook receives all data from previous hooks
2. **Consistent Modification Interface**: Use builder classes for all modifications
3. **Automatic Response Buffering**: Responses are buffered when response hooks are present
4. **Type Safety**: Full TypeScript support with proper typing

## Migration Mapping

### Old API → New API

| Old Hook             | New Hook         | Notes                                          |
| -------------------- | ---------------- | ---------------------------------------------- |
| `onRequest`          | `beforeRequest`  | Use `ctx.request` builder for modifications    |
| `onRequestBody`      | `beforeRequest`  | Body is available in `ctx.body` if present     |
| `onResponse`         | `beforeResponse` | Use `ctx.response` builder for modifications   |
| `onResponseStart`    | `beforeResponse` | Combined into single response hook             |
| `onResponseBody`     | `beforeResponse` | Body is always available in `ctx.responseBody` |
| `onResponseComplete` | `afterResponse`  | Access final transaction data                  |
| `onConnect`          | `onConnect`      | Unchanged                                      |

## Example Migration

### Old Plugin

```typescript
const oldPlugin: ProxyPlugin = {
    name: 'example',

    onRequest(ctx) {
        // Modify headers directly
        ctx.requestOptions.headers['x-custom'] = 'value'
    },

    onRequestBody(ctx) {
        // Modify body
        ctx.setBody(JSON.stringify({ modified: true }))
    },

    onResponse(ctx) {
        console.log('Response received:', ctx.statusCode)
    },

    onResponseBody(ctx) {
        // Modify response body
        const data = JSON.parse(ctx.body.toString())
        data.enhanced = true
        ctx.setBody(JSON.stringify(data))
    },

    onResponseComplete(ctx) {
        console.log('Transaction complete')
    },
}
```

### New Plugin

```typescript
const newPlugin: ProxyPlugin = {
    name: 'example',

    beforeRequest(ctx) {
        // Modify headers and body using builder
        ctx.request.setHeader('x-custom', 'value')

        if (ctx.body) {
            ctx.request.setBody(JSON.stringify({ modified: true }))
        }
    },

    afterRequest(ctx) {
        // Access final request data (read-only)
        console.log('Final URL:', ctx.finalUrl.toString())
    },

    beforeResponse(ctx) {
        console.log('Response received:', ctx.statusCode)

        // Modify response body
        if (ctx.responseBody) {
            const data = JSON.parse(ctx.responseBody.toString())
            data.enhanced = true
            ctx.response.setBody(JSON.stringify(data))
        }
    },

    afterResponse(ctx) {
        console.log('Transaction complete')
        console.log(
            `${ctx.finalMethod} ${ctx.finalUrl} -> ${ctx.finalStatusCode} (${ctx.duration}ms)`
        )
    },
}
```

## Builder API Reference

### RequestBuilder Methods

-   `addHeader(name, value)` - Add header (preserves existing)
-   `setHeader(name, value)` - Set header (replaces existing)
-   `removeHeader(name)` - Remove header
-   `getHeader(name)` - Get header value
-   `setBody(body)` - Set request body
-   `getBody()` - Get current body
-   `setUrl(url)` - Set request URL
-   `setMethod(method)` - Set HTTP method

### ResponseBuilder Methods

-   `addHeader(name, value)` - Add header (preserves existing)
-   `setHeader(name, value)` - Set header (replaces existing)
-   `removeHeader(name)` - Remove header
-   `getHeader(name)` - Get header value
-   `setBody(body)` - Set response body
-   `getBody()` - Get current body
-   `setStatusCode(code)` - Set status code
-   `setStatusMessage(message)` - Set status message

## Context Data Available

### beforeRequest Context

-   Original request data: `url`, `method`, `headers`, `body`
-   Client info: `clientIp`, `isHttps`
-   Modification builder: `request`

### afterRequest Context

-   All original request data
-   Final request data: `finalUrl`, `finalMethod`, `finalHeaders`, `finalBody`

### beforeResponse Context

-   All request data (original + final)
-   Response data: `statusCode`, `statusMessage`, `responseHeaders`, `responseBody`
-   Modification builder: `response`

### afterResponse Context

-   All previous data
-   Final response data: `finalStatusCode`, `finalStatusMessage`, `finalResponseHeaders`, `finalResponseBody`
-   Timing: `duration`

## Breaking Changes

1. **Context Structure**: Context objects have different properties
2. **Modification Methods**: Use builder classes instead of direct property modification
3. **Hook Names**: Several hooks renamed or combined
4. **Body Handling**: Bodies are automatically buffered when response hooks are present
5. **Type Safety**: Stricter TypeScript types may require code updates

## Benefits of Migration

1. **Simpler API**: Fewer hooks to understand and implement
2. **Better Performance**: Automatic response buffering only when needed
3. **Consistent Interface**: Same pattern for all modifications
4. **Full Context**: Access to all transaction data in each hook
5. **Type Safety**: Better IDE support and compile-time error checking
