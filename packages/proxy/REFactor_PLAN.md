## Arachne Proxy: Comprehensive Refactor Plan

### Scope
Complete review and refactoring of `@arachne/proxy` core modules: `server.ts`, `http-handler.ts`, `tls-manager.ts`, `websocket-handler.ts`, `tunnel-handler.ts`, `upstream-handler.ts`, `utils.ts`, `proxy-utils.ts`, `context-builder.ts`, `request-body-handler.ts`, `response-body-handler.ts`, `url-processor.ts`, `server-lifecycle.ts`, `http-types.ts`, `plugins/types.ts`, `logger.ts`.

### Critical Issues (High Priority)

**Hook Semantics & Timing**
- `onResponseComplete` fires before streaming starts when no buffering occurs (http-handler.ts:183-193)
- Should fire after downstream response fully finishes for streaming paths
- Errors inside hooks are swallowed per plugin; logging inconsistent (plugin-manager.ts:25-27)

**Error Response Handling**
- Mixed manual socket writes and helper functions (`sendErrorResponse`, `sendHttpErrorResponse`)
- Manual HTTP/1.1 status lines in websocket-handler.ts:75, tls-manager.ts:78-82, server.ts:150
- No unified error response pattern for WebSocket upgrades

**ID Generation & Correlation**
- Inconsistent ID prefixes: 'req', 'conn', 'ws', 'ws-http', 'http-tunnel', 'connect-tunnel'
- No hierarchical correlation between CONNECT → HTTP → WebSocket flows
- Makes debugging extremely difficult

### Structural Issues (Medium Priority)

**Header Sanitation Inconsistencies**
- `sanitizeHeaders` conditionally keeps hop-by-hop headers for WS (utils.ts:63-79)
- Non-WS flows should always drop hop-by-hop headers
- Header casing mixed; should normalize to lower-case internally

**WebSocket Handler Duplication**
- Two nearly identical tunnel creation methods in websocket-handler.ts
- Duplicate header formatting, piping logic, cleanup handlers
- Two WebSocket handler instantiations (HTTP and HTTPS paths)

**File Organization Issues**
- Overlap between `utils.ts` and `proxy-utils.ts` with unclear separation
- Socket info gathering duplicated across tls-manager.ts, tunnel-handler.ts, utils.ts
- Unused types in `http-types.ts`; unused `UrlProcessor.validateHostHeader`

**Stream & Memory Management**
- Manual `stream.pipe()` calls without proper error handling
- Should use `stream.pipeline()` for better error propagation
- Inconsistent cleanup patterns across tunnel types

### Configuration & Constants Issues

**MAX_BODY_SIZE Documentation Bug**
- Comment says "2MB" but constant is 100MB (proxy-utils.ts:4)
- No configurable body size limits, log levels, timeouts

**Magic String Duplication**
- "Arachne-Proxy/0.1" hardcoded in tunnel-handler.ts:201, tls-manager.ts:80
- Should read from package.json version

**Missing Configuration Options**
- No configurable log level (hardcoded to 'info')
- No option to disable auto system proxy toggling
- No timeout configurations

### Type Safety & Error Handling

**Empty Catch Blocks**
- Silent error swallowing in cleanup (tls-manager.ts:193-196, websocket-handler.ts:326,351,377)
- Replace with debug logs for debugging

**Type Safety Issues**
- Loosely typed `ctx` in error paths; need `ErrorContext` union
- Missing explicit return types on public APIs
- Frequent `(socket as any).remoteAddress` casting

**Plugin System Issues**
- Plugin errors swallowed without plugin name in logs
- No strict mode option to stop on first plugin error
- Hook timing not logged for performance debugging

### Build & Package Issues

**Source Export**
- Package exports TypeScript sources instead of built JavaScript (package.json:6-12)
- Missing build pipeline to generate `dist/` output
- Console.error fallback in logger.ts:93 instead of structured logging

## Step-by-Step Refactoring Plan

### Phase 1: Critical Safety & Correctness (Week 1)

**Step 1.1: Unify Error Response Handling**
- [x] Create `src/proxy/error-responses.ts` with unified helpers
- [x] Replace all manual HTTP status writes with helper functions:
  - `websocket-handler.ts:75` → use `sendWebSocketErrorResponse()`
  - `server.ts:150` → use `sendHttpErrorResponse()`
  - `tls-manager.ts:78-82` → use `sendErrorResponse()`
- [x] Add WebSocket-specific error response helper
- [x] Ensure all helpers check socket writability before writing

**Step 1.2: Fix Hook Timing Issues**
- [ ] Move `onResponseComplete` call in `http-handler.ts:183-193` to fire after streaming completes
- [ ] Add response completion tracking for streaming responses
- [ ] Add optional interim hook `onResponseStart` if needed for current use cases
- [ ] Update plugin documentation with new hook timing guarantees

**Step 1.3: Standardize ID Generation & Correlation**
- [ ] Create `src/proxy/correlation.ts` with hierarchical ID system
- [ ] Implement format: `conn_123:req_456:ws_789` for traceability
- [ ] Update all ID generation to use consistent prefixes and correlation
- [ ] Add `parentId` field to all contexts for linking flows

**Step 1.4: Fix MAX_BODY_SIZE Documentation**
- [ ] Correct comment in `proxy-utils.ts:4` (100MB not 2MB)
- [ ] Add `maxBodySize` to `ProxyOptions` interface
- [ ] Make body size limit configurable throughout codebase
- [ ] Update all references to use configurable value

### Phase 2: Stream Management & Memory Safety (Week 2)

**Step 2.1: Replace Manual Piping with stream.pipeline**
- [ ] Replace `stream.pipe()` calls in:
  - `tunnel-handler.ts:74, 137, 226-227`
  - `websocket-handler.ts:159-160, 317-318`
  - `upstream-handler.ts:33, 104`
- [ ] Add proper error handling and cleanup with `stream.pipeline`
- [ ] Implement backpressure handling

**Step 2.2: Standardize Cleanup Patterns**
- [ ] Create shared `createTunnelCleanup()` helper
- [ ] Replace empty catch blocks with debug logging:
  - `tls-manager.ts:193-196`
  - `websocket-handler.ts:326, 351, 377`
- [ ] Ensure consistent socket destruction and error handling

**Step 2.3: Consolidate WebSocket Handling**
- [ ] Extract shared WebSocket tunnel logic from `websocket-handler.ts`
- [ ] Create single `handleWebSocketUpgrade()` method
- [ ] Remove duplicate header formatting and piping code
- [ ] Use single WebSocket handler instance across HTTP/HTTPS

### Phase 3: Configuration & Constants (Week 3)

**Step 3.1: Centralize Constants**
- [ ] Create `src/proxy/constants.ts`
- [ ] Move "Arachne-Proxy/0.1" string to read from package.json
- [ ] Centralize default ports, timeouts, and other magic numbers
- [ ] Add version detection from package.json

**Step 3.2: Expand ProxyOptions Interface**
- [ ] Add configuration options:
  ```typescript
  interface ProxyOptions {
    logLevel?: LogLevel
    maxBodySize?: number
    disableSystemProxy?: boolean
    requestTimeout?: number
    connectTimeout?: number
  }
  ```
- [ ] Update logger to use configurable log level
- [ ] Add system proxy disable option to server lifecycle

**Step 3.3: Improve Plugin System**
- [ ] Add plugin name and hook timing to error logs
- [ ] Implement optional strict mode in `PluginManager`
- [ ] Add performance timing for hook execution
- [ ] Improve error context with plugin information

### Phase 4: File Organization & Type Safety (Week 4)

**Step 4.1: Reorganize Utility Files**
- [ ] Split `utils.ts` and `proxy-utils.ts` into:
  - `src/proxy/utils/headers.ts` - header sanitization, parsing
  - `src/proxy/utils/sockets.ts` - socket info, network utilities
  - `src/proxy/utils/body.ts` - body reading, encoding/decoding
  - `src/proxy/utils/ids.ts` - ID generation and correlation
- [ ] Update all imports to use new file structure
- [ ] Remove duplicate socket info gathering code

**Step 4.2: Improve Type Safety**
- [ ] Define `ErrorContext` union type for error handlers
- [ ] Add explicit return types to all public APIs
- [ ] Create proper socket interfaces to avoid `(socket as any)` casting
- [ ] Update plugin types for better type safety

**Step 4.3: Clean Up Dead Code**
- [ ] Remove unused types from `http-types.ts`
- [ ] Remove unused `UrlProcessor.validateHostHeader`
- [ ] Audit and remove other unused code
- [ ] Update imports to remove dead references

### Phase 5: Build & Developer Experience (Week 5)

**Step 5.1: Add Build Pipeline**
- [ ] Add TypeScript build configuration for `dist/` output
- [ ] Update `package.json` exports to point to `dist/` files
- [ ] Add build scripts and CI integration
- [ ] Ensure proper source maps for debugging

**Step 5.2: Improve Logging & Debugging**
- [ ] Replace `console.error` fallback in logger with structured logging
- [ ] Add component standardization: 'http-handler', 'tls-manager', etc.
- [ ] Ensure all logs include correlation IDs
- [ ] Add log message templates for consistency

**Step 5.3: Header Sanitation Split**
- [ ] Create separate `sanitizeHttpHeaders()` and `sanitizeWebSocketHeaders()`
- [ ] Always drop hop-by-hop headers in HTTP flows
- [ ] Allow only required headers in WebSocket upgrade flows
- [ ] Normalize header casing consistently

### Acceptance Criteria & Testing

**Critical Requirements:**
- [ ] All streaming responses trigger `onResponseComplete` only after completion
- [ ] No manual HTTP status writes outside unified helpers
- [ ] All logs include hierarchical request correlation IDs
- [ ] Header sanitation is RFC-compliant and protocol-specific
- [ ] Shared tunnel cleanup replaces all duplicate code
- [ ] `MAX_BODY_SIZE` configurable with accurate documentation
- [ ] No unused code or types remain

**Verification Steps:**
- [ ] End-to-end tests for hook timing with streaming responses
- [ ] Integration tests for error response consistency
- [ ] Load tests for memory management and cleanup
- [ ] Plugin compatibility tests for new hook timing
- [ ] Build system tests for proper package exports

### Risk Mitigation

**Breaking Changes:**
- Hook timing changes may affect existing plugins
- Build system changes affect package consumers
- Error response format standardization

**Mitigation:**
- Maintain backward compatibility adapters where possible
- Add feature flags for gradual rollout
- Comprehensive testing before each phase
- Clear migration documentation

### Success Metrics

- [ ] 100% error responses use unified helpers
- [ ] 0 empty catch blocks remain
- [ ] All logs traceable through correlation IDs
- [ ] Memory usage stable under load
- [ ] Plugin hook timing predictable and documented
- [ ] Build time and package size improvements
- [ ] Developer debugging experience improved


