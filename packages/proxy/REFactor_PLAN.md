## Arachne Proxy: Inconsistencies and Refactor Plan

### Scope
Review of `@arachne/proxy` core modules: `server.ts`, `http-handler.ts`, `tls-manager.ts`, `websocket-handler.ts`, `tunnel-handler.ts`, `upstream-handler.ts`, `utils.ts`, `proxy-utils.ts`, `context-builder.ts`, `request-body-handler.ts`, `response-body-handler.ts`, `url-processor.ts`, `server-lifecycle.ts`, `http-types.ts`, `plugins/types.ts`, `logger.ts`.

### Key Findings
- Hook semantics and timing
  - `onResponseComplete` fires before streaming starts when no buffering occurs. Should fire after downstream response has fully finished for streaming paths.
  - Errors inside hooks are swallowed per plugin; logging is inconsistent.

- Header sanitation inconsistencies
  - `sanitizeHeaders` conditionally keeps hop-by-hop headers for WS; non-WS flows should always drop hop-by-hop headers.
  - Header casing is mixed; normalize to lower-case internally.

- Error response handling
  - Mixed manual socket writes and helper functions (`sendErrorResponse`, `sendHttpErrorResponse`). Unify on helpers and extend them for WS status responses.

- Tunneling API consistency
  - Different completion semantics between WS and HTTP/CONNECT tunnels. Standardize to resolve only when handshake succeeds or error occurs; provide uniform cleanup.
  - Duplicate piping/cleanup logic across WS and CONNECT.

- Logging standardization
  - Inconsistent identifiers (`requestId`, `upgradeId`, `connectId`, `id`). Standardize on `requestId` (+ optional `parentId`).
  - Mix of helper-based and raw logs; add WS-specific helpers and use consistently.
  - Configurable log level missing (currently default `info`).

- Body buffering
  - `MAX_BODY_SIZE` comment mismatch (value 100MB vs comment "2MB"). Make configurable and correct docs.
  - Chunked request bodies bypass `onRequestBody`; consider bounded buffering until threshold.

- WebSocket handling duplication
  - Two instantiations and upgrade paths (HTTP and HTTPS). Prefer one shared instance and common upgrade helper.

- Naming/responsibilities
  - Overlap between `utils.ts` and `proxy-utils.ts`. Split into `headers.ts`, `sockets.ts`, `body.ts` and consolidate.
  - Unused types in `http-types.ts`; unused `UrlProcessor.validateHostHeader`.

- Error and edge cases
  - Empty catches in cleanup; replace with debug logs.
  - Guard/writability checks not uniformly applied when writing responses.

- Magic strings/constants
  - `Proxy-Agent: Arachne-Proxy/0.1` duplicated. Centralize (optionally use package version).

- Type safety
  - Loosely typed `ctx` in error paths; define `ErrorContext` union.
  - Add explicit return types on public APIs.

- Stream/backpressure
  - Manual piping; prefer `stream.pipeline` for sockets and HTTP streams.

- PluginManager behavior
  - Consider strict mode to stop on first plugin error; log plugin name and hook timing.

- System proxy lifecycle
  - Add option to disable auto system proxy toggling on start/stop.

- Package build/export
  - Package exports TS sources; add build step and point exports to `dist` for npm usage.

### Recommended Refactors (phased)
1) Safety and correctness
   - Unify error responses via helpers everywhere (HTTP/WS/CONNECT).
   - Fix `MAX_BODY_SIZE` docs and make limit configurable via `ProxyOptions`.
   - Standardize `requestId` and adopt a correlation helper to attach common fields.
   - Use `stream.pipeline` for WS/CONNECT and HTTP body piping.

2) Hooks and lifecycle
   - Make `onResponseComplete` fire on true completion for streaming; add interim hook if needed.
   - Improve `PluginManager` logging (plugin name, hook name, timing) and optional strict mode.

3) Headers and protocols
   - Split `sanitizeHeaders` for HTTP vs WS upgrade; always drop hop-by-hop in HTTP.
   - Normalize header casing and centralize construction of `RequestOptions.headers`.

4) Structure and reuse
   - Extract shared tunnel piping+cleanup helper used by WS and CONNECT.
   - Consolidate `utils.ts`/`proxy-utils.ts` into `headers.ts`, `sockets.ts`, `body.ts`.
   - Remove unused types and dead code (`http-types.ts` extras, unused URL validator).

5) DX and configuration
   - Add `ProxyOptions` for: body size limit, log level, disableSystemProxy.
   - Centralize constants (Proxy-Agent string, default ports), optionally read from package version.

### Acceptance Criteria
- Streaming responses trigger `onResponseComplete` only after `finish`/`close`.
- No manual HTTP status writes remain outside helpers; WS/CONNECT use unified helpers.
- All logs include `requestId`; WS upgrades also link to parent `connectId` when present.
- Header sanitation strictly RFC-compliant for HTTP; WS upgrade path allows only required headers.
- Shared piping helper replaces duplicate piping/cleanup code.
- `MAX_BODY_SIZE` configurable; default documented accurately.
- No unused types in `http-types.ts`; utilities are split by concern.

### Follow-ups
- Add timeouts and `aborted` handling to upstream requests; propagate cancellation.
- Consider metrics (per-hook duration, error counts) and health logging.


