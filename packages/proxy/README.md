# @arachne/proxy

A fully-fledged HTTP/HTTPS MITM proxy with a plugin system. Generates its own root CA via node-forge, issues per-host certificates on the fly, and can automatically install trust on macOS. Designed to intercept Chrome traffic (HTTP CONNECT with SNI) and force HTTP/1.1 to keep things simple and compatible.

## Features

- Root CA generation and per-host certificate issuance (node-forge)
- macOS automatic trust install (security add-trusted-cert), Linux/Windows instructions
- HTTP and HTTPS interception (CONNECT) with dynamic SNI certs
- Pluggable hooks: onConnect, onRequest, onResponse, onError
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
}
```

## Notes

- The proxy forces ALPN to HTTP/1.1 for better compatibility and simpler interception.
- Body rewriting is not implemented yet; hooks operate on metadata and headers. This can be extended later.
- CA and issued certs are stored under `~/.arachne/proxy/ca`.
