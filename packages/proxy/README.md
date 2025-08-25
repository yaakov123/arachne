# @arachne/proxy

A fully-fledged HTTP/HTTPS MITM proxy with a plugin system. Generates its own root CA via node-forge, issues per-host certificates on the fly, and can automatically install trust on macOS. Designed to intercept Chrome traffic (HTTP CONNECT with SNI) and force HTTP/1.1 to keep things simple and compatible.

## Features

- Root CA generation and per-host certificate issuance (node-forge)
- macOS automatic trust install (security add-trusted-cert), Linux/Windows instructions
- HTTP and HTTPS interception (CONNECT) with dynamic SNI certs
- Pluggable hooks: onConnect, onRequest, onResponse, onResponseStart, onResponseComplete, onError
- Works with Chrome when system proxy and CA trust are configured

## Install & Build (monorepo)

From repo root:

```bash
npm install
npm run build -w @arachne/proxy
```

## Initialize CA and Trust (macOS)

```bash
# Generate root CA under ~/.arachne/proxy/ca
npm exec -w @arachne/proxy arachne-proxy init-ca

# Try to add to System keychain (may require sudo)
sudo npm exec -w @arachne/proxy arachne-proxy install-ca
```

Linux/Windows: follow instructions printed by `install-ca`.

## Rotate the root CA

Rotates (replaces) the existing root CA by:

- Untrusting the old CA from the OS trust store (automated on macOS; guidance on others)
- Deleting the CA directory at `~/.arachne/proxy/ca` (including issued certs)
- Generating a brand new root CA and attempting to trust it

```bash
# May require sudo to modify the System keychain on macOS
sudo npm exec -w @arachne/proxy arachne-proxy rotate
```

Notes:

- On macOS, trusting/untrusting the System keychain typically requires sudo.
- On Linux/Windows, the command will print instructions to manually trust/untrust.
- After rotation, any previously issued per-host certs are removed and will be reissued automatically on first use.

## Start the proxy

```bash
npm exec -w @arachne/proxy arachne-proxy start -- --host 127.0.0.1 --port 8899
```

Note: The extra `--` after `start` ensures CLI options are passed through.

## Configure Chrome to use the proxy

- macOS System Settings -> Network -> Your interface -> Details -> Proxies
    - Enable "Web proxy (HTTP)" and "Secure Web Proxy (HTTPS)"
    - Server: 127.0.0.1, Port: 8899
- Or via terminal:

```bash
networksetup -setwebproxy "Wi-Fi" 127.0.0.1 8899
networksetup -setsecurewebproxy "Wi-Fi" 127.0.0.1 8899
networksetup -setproxybypassdomains "Wi-Fi" localhost 127.0.0.1
```

Restart Chrome if needed.

## Plugin API

```ts
import { MitmProxyServer, createLoggerPlugin } from '@arachne/proxy'

const proxy = new MitmProxyServer({ plugins: [createLoggerPlugin()] })
await proxy.start()
```

Create your own plugin:

```ts
import type { ProxyPlugin } from '@arachne/proxy'

export const myPlugin: ProxyPlugin = {
    name: 'my-plugin',
    async onRequest(ctx) {
        // mutate outgoing upstream request
        ctx.requestOptions.headers['x-my-header'] = '1'
    },
    async onResponse(ctx) {
        // inspect status, headers, url
        if (ctx.statusCode >= 500) {
            console.warn('Server error:', ctx.url.toString())
        }
    },
    async onResponseStart(ctx) {
        // called when response headers are written, before body streaming
        console.log('Response starting:', ctx.statusCode, ctx.url.toString())
    },
    async onResponseComplete(ctx) {
        // called when response is completely finished (after streaming or buffering)
        console.log('Response complete:', ctx.statusCode, ctx.url.toString())
    },
}
```

### Hook Timing Guarantees

The proxy provides the following hook timing guarantees:

- **onRequest**: Called before forwarding the request upstream
- **onResponse**: Called when the upstream response headers are received
- **onResponseStart**: Called when response headers are written to the client (immediately before body transmission)
- **onResponseBody**: Called with buffered/decoded body content (if available and within size limits)
- **onResponseComplete**: Called when the response is completely finished:
  - For buffered responses: after the response body is fully sent
  - For streaming responses: after the stream completes (including any errors)

**Important**: `onResponseComplete` is guaranteed to fire after the response is completely transmitted to the client, making it suitable for cleanup, logging final response state, or measuring total response time.

## Notes

- The proxy forces ALPN to HTTP/1.1 for better compatibility and simpler interception.
- CA and issued certs are stored under `~/.arachne/proxy/ca`.
