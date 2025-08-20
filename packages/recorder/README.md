# @arachne/recorder

A lightweight recorder that runs a local MITM proxy and writes observed HTTP/HTTPS traffic to a raw NDJSON file. Designed to be privacy-conscious by default and easy to ingest later (e.g., by `@arachne/spec`).

- Records connect, request, response, and (optionally) body events.
- Redacts sensitive headers by default (Authorization, Cookie, Set-Cookie).
- Stores bodies as base64, truncated to a configurable limit.
- Usable via CLI or programmatically.

## Install

From the monorepo root:

```bash
# install deps (required for the CLI)
npm install -w @arachne/recorder

# build once (optional if running programmatically with tsx)
npm run build -w @arachne/recorder
```

## CLI

The CLI starts a proxy that records traffic to NDJSON.

```bash
# Start the recorder proxy on 127.0.0.1:8899
npx arachne-recorder start \
  --out ~/.arachne/recorder/traffic.ndjson \
  --hosts api.example.com,example.org \
  --sample-bodies \
  --max-body-bytes 524288
```

- Ensure your browser/system is configured to use this HTTP proxy (127.0.0.1:8899 by default).
- The first run will create or load the Arachne Root CA (for HTTPS interception). On macOS, you can optionally auto-install it into the OS trust store with `--install-trust`.

### CLI options

- `--host <host>`: Bind host (default `127.0.0.1`).
- `-p, --port <port>`: Bind port (default `8899`).
- `--out <file>`: NDJSON output path (default `~/.arachne/recorder/traffic.ndjson`).
- `--hosts <csv>`: Comma-separated host allowlist (record only these hosts).
- `--sample-bodies`: Record request/response bodies (base64, truncated).
- `--max-body-bytes <n>`: Max bytes to capture per body (default `524288`).
- `--no-ensure-ca`: Skip auto-create/load of the Arachne Root CA.
- `--install-trust`: Attempt to install the Root CA into the OS trust store (macOS auto).

## Programmatic usage

```ts
import { startRecorderProxy } from '@arachne/recorder'

const { host, port, close } = await startRecorderProxy({
  host: '127.0.0.1',
  port: 8899,
  ensureCA: true,
  installTrust: false,
  recorder: {
    outFile: process.env.REC_OUT || '~/.arachne/recorder/traffic.ndjson',
    hosts: ['api.example.com'],
    sampleBodies: true,
    maxBodyBytes: 512 * 1024,
  },
})

console.log(`Recorder proxy listening on ${host}:${port}`)

// On shutdown
await close()
```

If you prefer to attach the recorder plugin to your own proxy instance:

```ts
import { MitmProxyServer, CertificateAuthority } from '@arachne/proxy'
import { createTrafficRecorder } from '@arachne/recorder'

const ca = new CertificateAuthority()
await ca.ensureRootCA()
const rec = createTrafficRecorder({ outFile: '/tmp/traffic.ndjson' })
const proxy = new MitmProxyServer({ port: 8899, host: '127.0.0.1', ca, plugins: [rec.plugin] })
await proxy.start()
// ... later
await proxy.stop()
await rec.close()
```

## Output format (NDJSON)

Each line is a JSON object representing one event. Timestamps are milliseconds since epoch (`ts`). Bodies are base64-encoded.

```jsonc
// connect
{"ts": 1712345678901, "type": "connect", "id": "conn_x", "hostname": "api.example.com", "port": 443, "clientIp": "127.0.0.1:55555"}

// request
{"ts": 1712345678910, "type": "request", "id": "req_x", "isHttps": true, "url": "https://api.example.com/v1/users/42?lang=en", "method": "GET", "headers": {"accept": "*/*"}}

// response
{"ts": 1712345678920, "type": "response", "id": "req_x", "url": "https://api.example.com/v1/users/42?lang=en", "method": "GET", "statusCode": 200, "headers": {"content-type": "application/json"}}

// requestBody (only with --sample-bodies)
{"ts": 1712345678930, "type": "requestBody", "id": "req_y", "url": "https://api.example.com/v1/users", "method": "POST", "contentType": "application/json", "contentEncoding": "identity", "bodyB64": "eyJuYW1lIjoiQm9iIn0=", "truncated": false}

// responseBody (only with --sample-bodies)
{"ts": 1712345678940, "type": "responseBody", "id": "req_y", "url": "https://api.example.com/v1/users", "method": "POST", "statusCode": 201, "contentType": "application/json", "contentEncoding": "identity", "bodyB64": "eyJpZCI6NDJ9", "truncated": false}

// error
{"ts": 1712345678950, "type": "error", "id": "req_z", "message": "ECONNRESET"}
```

## Privacy & redaction

- Default redactions: `authorization`, `cookie`, `set-cookie` headers.
- Body capture is disabled by default; enable via `--sample-bodies`.
- Bodies are truncated to `maxBodyBytes`.

## Notes

- The proxy operates in HTTP/1.1 for browser compatibility and issues per-host certificates on the fly using the Arachne Root CA.
- On macOS, Root CA installation can be automated (`--install-trust`). On other OSes, manual installation may be required.

## Troubleshooting

- No traffic recorded? Ensure your system/browser HTTP proxy is set to the recorder's host/port.
- HTTPS errors? Confirm the Arachne Root CA is installed and trusted.
- Large body capture? Increase `--max-body-bytes` (be mindful of disk usage and privacy).
