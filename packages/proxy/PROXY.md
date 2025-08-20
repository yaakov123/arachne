# HTTP/HTTPS Proxying in `server.ts`

This document explains exactly how `packages/proxy/src/proxy/server.ts` implements HTTP and HTTPS proxying, including MITM interception, request/response handling, header/body processing, hooks, and lifecycle.

Key classes and functions referenced below:
- `MitmProxyServer` (class)
- `handleHttpRequest()`
- `handleConnect()`
- `runHook()`
- `readStreamToBuffer()` / `decodeBody()`
- `getNumericHeader()` / `headerToString()`
- `sanitizeHeaders()` (from `./utils.js`)
- `parseHostPort()` (from `./utils.js`)
- `CertificateAuthority` (dynamic per-host cert issuance)

Constants of note:
- `MAX_BODY_SIZE = 2 * 1024 * 1024` (2MB safety limit for buffering bodies)

## Overview

`MitmProxyServer` runs an HTTP/1.1 server that:
- Handles plain HTTP requests directly.
- Handles HTTPS by intercepting `CONNECT` and performing a TLS MITM using a dynamically issued certificate (via `CertificateAuthority`).
- For decrypted HTTPS traffic, it processes requests the same way as HTTP but marks context with `isHttps = true` and forwards to the real upstream using Node's `https` module.
- Exposes plugin hooks to observe/mutate requests, responses, and bodies.

## Server startup/shutdown

- `start()`
  - Listens on `host` (default `127.0.0.1`) and `port` (default `8899`).
  - Attempts to enable the system proxy via `enableSystemProxy(host, port)` so OS traffic can be routed through this proxy.

- `stop()`
  - Calls `closeIdleConnections`/`closeAllConnections` if available, then `.close()`.
  - Tries to disable the system proxy via `disableSystemProxy()`.

## HTTP flow (no CONNECT)

Entry point: `http.createServer((req, res) => handleHttpRequest(req, res, false))`

1. Build the full URL (`fullUrl`):
   - If `clientReq.url` is absolute (`^https?://`), use it directly.
   - Else, require `Host` header. Use `parseHostPort(hostHeader)` and `isHttps` flag to construct: `protocol + '//' + hostname + optionalPort + clientReq.url`.

2. Prepare upstream `RequestOptions`:
   - `protocol`, `hostname`, `port`, `method`, `path` (pathname + search), `headers` (via `sanitizeHeaders`).

3. Create a `RequestContext` (`reqCtx`) and run `onRequest` hooks via `runHook('onRequest', reqCtx)`.

4. Decide whether to buffer the request body (for plugins):
   - Conditions: a plugin implements `onRequestBody`, method has a body (non-GET/HEAD), `Content-Length` is present, > 0 and ≤ `MAX_BODY_SIZE`.
   - If buffering:
     - Read the client body with `readStreamToBuffer()`.
     - Decode using `decodeBody()` if `Content-Encoding` is gzip/deflate/br; result is uncompressed.
     - Expose to plugins via `onRequestBody` with `setBody()` to allow mutation.
     - If body changed (or preserved), update headers:
       - Set `content-length` to the new byte length.
       - Remove `transfer-encoding`.
       - If original had `content-encoding`, remove it (we send uncompressed if we modified).
   - If not buffering: stream client body to upstream.

5. If any plugin implements `onResponseBody`, set `accept-encoding: identity` on the upstream request to prefer uncompressed upstream responses for easier inspection/mutation.

6. Choose upstream agent based on `fullUrl.protocol`:
   - `http` for `http:`
   - `https` for `https:`

7. Send upstream request and handle upstream response:
   - Build `ResponseContext` (`resCtx`) and run `onResponse` hooks.
   - Check if the response is bodyless (HEAD, 101/204/304, or `Content-Length: 0`).
   - Decide whether to buffer the response body (for plugins):
     - Conditions: a plugin implements `onResponseBody`, response is not bodyless, and either `Content-Length` ≤ `MAX_BODY_SIZE` or `Content-Length` is absent.
     - If buffering:
       - Read upstream body with `readStreamToBuffer()` (capped at `MAX_BODY_SIZE + 1`).
       - Decode with `decodeBody()` if `content-encoding` is gzip/deflate/br; result is uncompressed.
       - Expose to plugins via `onResponseBody` with `setBody()` to allow mutation.
       - Sanitize headers, remove `content-encoding`, and set `content-length` to new uncompressed length.
       - `clientRes.writeHead(statusCode, statusMessage, headersOut)` and `clientRes.end(bodyBuf)`.
     - If not buffering: stream `upRes` directly to `clientRes` after `writeHead()` with sanitized headers.

8. Errors on the upstream request cause a `502 Bad Gateway` to be sent if headers not yet sent.

## HTTPS flow (CONNECT + MITM)

Entry point: `httpServer.on('connect', (req, clientSocket, head) => handleConnect(...))`

1. Parse target from `req.url` using `parseHostPort()`; default port to 443.
2. Create `ConnectContext` and run `onConnect` hook.
3. Respond to client with `HTTP/1.1 200 Connection Established` to signal the tunnel is ready.
4. If `head` has data, `unshift` it back onto the socket.
5. Create an internal HTTP server `httpOverTls` whose connection handler calls `handleHttpRequest(req2, res2, true)`.
6. Issue or retrieve a per-host certificate via `CertificateAuthority.issueHostCert(hostname)` and set up a TLS server:
   - `ALPNProtocols: ['http/1.1']` to force HTTP/1.1.
   - `SNICallback`: asynchronously provides a secure context per SNI using `ca.getSecureContextForHost(servername)`.
   - Fallback cert/key set from the issued host cert.
7. Wire TLS to HTTP:
   - On `tlsServer` `secureConnection`, emit the TLS socket into `httpOverTls` as a new HTTP connection.
   - Also immediately `tlsServer.emit('connection', clientSocket)` to hand off the existing TCP socket to TLS.
8. Cleanup: when the client socket closes/ends, close `tlsServer` and `httpOverTls`.

After this point, decrypted HTTPS requests are processed exactly like HTTP requests by `handleHttpRequest(..., isHttps = true)`. When the upstream request is created, because `fullUrl.protocol` will be `https:`, the proxy initiates a separate TLS connection to the real origin using Node's `https` module. Thus, the proxy terminates TLS from the client and re-terminates TLS to the server (classic MITM).

## Header handling

- Incoming request headers are sanitized with `sanitizeHeaders()` before forwarding upstream.
- When modifying bodies:
  - Request: update `content-length`, delete `transfer-encoding`, and delete `content-encoding` if we decoded.
  - Response: delete `content-encoding` and set `content-length` to the new uncompressed body size.
- `Host` is used to build `fullUrl` for relative-form requests.

## Body handling and decoding

- Buffering is opt-in based on plugin presence and size constraints (`MAX_BODY_SIZE = 2MB`).
- `decodeBody()` supports `gzip`, `deflate`, and `br` via Node `zlib`. Unknown encodings are passed through unchanged.
- If buffering fails for any reason, the proxy falls back to streaming to preserve functionality.

## Error handling

- Server-level `clientError` returns `HTTP/1.1 400 Bad Request` to the client and notifies plugins via `onError`.
- All hook invocations are wrapped; exceptions are routed to `handleError()` which calls `p.onError?.(err, ctx)` on each plugin.
- Upstream errors cause a `502 Bad Gateway` with body `Upstream error` unless headers were already sent.

## Plugins

Supported hooks (see `packages/proxy/src/plugins/types.ts`):
- `onConnect(ctx: ConnectContext)` — inspect/allow CONNECT destinations.
- `onRequest(ctx: RequestContext)` — mutate `requestOptions` before sending upstream.
- `onRequestBody(ctx: RequestBodyContext)` — read/replace buffered request body via `setBody()`.
- `onResponse(ctx: ResponseContext)` — inspect status/headers/URL.
- `onResponseBody(ctx: ResponseBodyContext)` — read/replace buffered response body via `setBody()`.
- `onError(err, ctx)` — observe errors.

Note: Presence of `onRequestBody`/`onResponseBody` controls whether bodies are buffered (subject to limits and method/length checks).

## TLS and certificates

- A root CA is managed by `CertificateAuthority` and per-host certs are issued on the fly.
- SNI is supported via `SNICallback` so each target host receives a matching leaf certificate.
- ALPN is forced to HTTP/1.1 to simplify interception and maintain Chrome compatibility.

## Sequence summary

HTTP (no CONNECT):
1) Client -> Proxy: HTTP/1.1 request
2) Proxy (optional) buffers/decodes request body for plugins
3) Proxy -> Upstream (http or https): forwards request
4) Proxy receives upstream response
5) Proxy (optional) buffers/decodes response body for plugins
6) Proxy -> Client: writes headers and body (possibly modified)

HTTPS (CONNECT):
1) Client -> Proxy: `CONNECT host:port`
2) Proxy: `200 Connection Established`
3) Client <TLS> Proxy (fake per-host cert); ALPN http/1.1
4) Decrypted HTTP requests handled as above (`isHttps = true`)
5) Proxy -> Upstream using `https:`

## Notes and limitations

- Body buffering capped at 2MB to avoid memory pressure. Larger bodies are streamed.
- If `Content-Length` is absent on request, request bodies are streamed (no buffering) to avoid indefinite reads.
- When response bodies are buffered and modified, they are sent uncompressed with a recalculated `Content-Length`.
- The proxy does not currently manipulate HTTP/2; ALPN is pinned to HTTP/1.1.
