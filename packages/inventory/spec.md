# @arachne/inventory — Design Spec (Lean Core + Adapters)

## 1. Purpose and Scope

Build a decoupled, privacy-conscious library that ingests `@arachne/recorder` traffic events (NDJSON → parsed objects) and synthesizes an API inventory per website. The core focuses solely on modeling and aggregation with no IO or runtime coupling.

Out of scope for this package (v0):
- No proxy/plugin integration, no NDJSON tailing, no timers.
- No OpenAPI export (can be a separate package later).
- No CLI or UI (CLI can be built on top later).


## 2. Architecture

Two layers inside one package, with the intent that these can be split into separate packages if needed.

- Core (pure-ish):
  - Inventory data model and aggregation logic.
  - Path templating heuristics and version detection.
  - `InventoryBuilder` API to incrementally ingest events.
  - No filesystem/network dependencies.

- Adapters (optional, opt-in):
  - `InventoryStore` implementations (e.g., per-apex JSON files).
  - NDJSON parsing helper for recorder lines.
  - Apex resolver (simple heuristic by default; can inject PSL-backed resolver later).


## 3. Inputs and Privacy

- Input records match `TrafficRecord` shapes emitted by `@arachne/recorder` (`connect`, `request`, `response`, `requestBody`, `responseBody`, `error`) — see `packages/recorder/src/index.ts`.
- Recorder drops sensitive header values by default. This package will:
  - Store header names only (never values).
  - Retain up to 10 request/response body examples per operation (if recorder sampled them). Bodies are base64, possibly truncated by recorder; we store `contentType`, `contentEncoding`, and `truncated`/`statusCode` flags only.
  - Query parameters: store names and inferred simple types (boolean/number/string/array) with seen counts; no values.


## 4. Storage layout (via adapters)

- Target layout (implemented by an adapter, not core): one JSON file per apex domain, containing apex + all subdomains.
  - Example path: `~/.arachne/inventory/example.com.json`
  - File structure (see §7 Data Model).
- Apex resolution: default simple heuristic (last two labels), with optional public suffix list (PSL) injection later for accuracy (`co.uk`, etc.).


## 5. Version handling (explicit, path-only)

- Detection rules applied only to the first two path segments:
  1) Segment equals `v{number}` (e.g., `v1`, `v2`).
  2) Segment equals `version` followed immediately by a numeric segment (`version/3`).
- Normalization: always label versions as `v{number}` (e.g., `v2`).
- Storage: within a `VersionInventory`, we remove the detected version pair from the path so that cross-version diffs are straightforward. Raw events still contain the original full path.
- If not detected: bucket under `unversioned`.

Examples:
- `/v1/users/123/profile` → version `v1`; stored path: `/users/{id}/profile`.
- `/api/v3/orders/24` → version `v3`; stored path: `/api/orders/{id}`.
- `/reports/version/2024/...` (beyond segment 2) → `unversioned`.


## 6. Path templating heuristics

Normalization:
- Lowercase host; preserve path case.
- Safe decode percent-encoding; collapse `//`; strip trailing slash (except root).

Known slugs (kept literal; configurable):
- `login`, `logout`, `me`, `profile`, `search`, `graphql`, `health`, `metrics`, `status`, `swagger`, `docs`, `openapi`, `ping`.

Classifier rules (first match wins):
- UUID v4 → `{uuid}`: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
- ULID → `{ulid}`: `/^[0-9A-HJKMNP-TV-Z]{26}$/`
- 24-hex → `{hex24}`: `/^[0-9a-f]{24}$/i`
- Integer → `{id}`: `/^[0-9]+$/` (10/13 digits optionally as `{ts}`)
- Token-like (base62/base64url-ish, length ≥ 12) → `{token}`: `/^[A-Za-z0-9_-]{12,}$/`
- Date-like → `{date}`: e.g., `YYYY-MM-DD`
- File extension: keep `.ext` literal, classify basename (e.g., `avatars/{id}.png`).
- Cardinality fallback: if a literal segment sees > 3 distinct values across observations and none of the above matched, promote to `{var}`.

Additional:
- Placeholder repetition is allowed without indexing (e.g., `/users/{id}/posts/{id}`).
- Version detection (per §5) is applied and stripped before templating.

Query parameters:
- Keep names literal; infer simple type; arrays via repeated keys or `[]` suffix.
- No value storage, only presence/type counts.

Merging and stability:
- Maintain a trie per (host, version). Known slugs remain static.
- Literal→dynamic promotion occurs at threshold (K=3) and merges existing literals under the dynamic node.
- `{var}` may be upgraded to `{uuid}`, `{hex24}`, etc., if a stronger classifier is later observed. No downgrades.


## 7. Data Model

```ts
export type ApexInventoryFile = {
  apex: string
  updatedAt: number
  hosts: Record<string, HostInventory> // FQDN → HostInventory
}

export type HostInventory = {
  versions: Record<string, VersionInventory> // 'v1' | 'v2' | 'unversioned' | ...
}

export type VersionInventory = {
  sourcesSeen: Array<'path'> // fixed to 'path' for v0
  paths: Record<string, PathNode> // templated absolute path, with version removed
}

export type PathNode = {
  methods: Record<string, OperationStats> // 'GET' | 'POST' | ...
}

export type OperationStats = {
  hits: number
  lastSeen: number // ms since epoch
  statuses: Record<string, number> // '200': 3, '404': 1, ...
  reqHeaders: string[] // header names (deduped)
  resHeaders: string[]
  reqContentTypes: string[]
  resContentTypes: string[]
  queryParams: Record<string, ParamStats>
  examples?: {
    reqBodies?: BodyExample[] // up to 10
    resBodies?: BodyExample[] // up to 10
  }
}

export type ParamStats = {
  seen: number
  type: 'string' | 'number' | 'boolean' | 'array' | 'unknown'
}

export type BodyExample = {
  ts: number
  contentType?: string
  contentEncoding?: string
  statusCode?: number // for responses
  bodyB64: string
  truncated: boolean
}
```


## 8. Core API

```ts
export interface InventoryStore {
  // Load an apex inventory (or null if missing)
  loadApex(apex: string): Promise<ApexInventoryFile | null>
  // Persist an apex inventory (atomic write recommended by implementations)
  saveApex(apex: string, doc: ApexInventoryFile): Promise<void>
}

export type ApexResolver = (host: string) => string // returns apex for FQDN

export class InventoryBuilder {
  constructor(opts?: {
    store?: InventoryStore // optional; if omitted, in-memory only
    apexForHost?: ApexResolver // default: simple heuristic (last two labels)
    maxExamplesPerOp?: number // default: 10
    cardinalityThreshold?: number // default: 3
    knownSlugs?: string[] // extends defaults
    caseSensitivePaths?: boolean // default: true
  })

  // Ingest a single recorder event (parsed NDJSON line)
  ingest(rec: TrafficRecord): void

  // Serialize current in-memory state for a given apex
  toApexJSON(apex: string): ApexInventoryFile | null

  // Persist modified apex files via provided store (if any)
  snapshot(): Promise<void>

  // Eagerly load an apex via store (if any), merging into memory
  loadApex(apex: string): Promise<void>
}
```

Notes:
- Core does not manage timers; callers schedule `snapshot()` as desired.
- If `store` is omitted, `snapshot()` is a no-op and the inventory is memory-only.


## 9. Adapters (opt-in)

- `JsonFileStore` (per-apex files):
  - Resolves path as `<inventoryDir>/<apex>.json` (configurable `inventoryDir`, default `~/.arachne/inventory`).
  - Atomic writes: write to temp then rename.
  - Lazy load on first mutation per apex.

- `parseNdjsonLine(line: string): TrafficRecord | null`:
  - Tolerant JSON parse with shape guards for known event types.
  - Skips invalid lines.

- `defaultApexResolver(host: string): string`:
  - Simple heuristic (last two labels) with an allowlist of known multi-label TLDs configurable.
  - Future: allow injecting a PSL-backed resolver.


## 10. Ingestion semantics

- Events may arrive out of order; aggregation is idempotent and order-agnostic.
- On `request`:
  - Compute apex, host (FQDN), version (per §5), and templated path (per §6).
  - Ensure structures exist, then update method stats: hits, lastSeen, req header names, req content-types, query param type stats.
- On `requestBody`:
  - If bodies are present, append to `examples.reqBodies` (bounded to 10).
- On `response`:
  - Update statuses, res header names, res content-types.
- On `responseBody`:
  - Append to `examples.resBodies` with statusCode (bounded to 10).
- `connect` and `error` are ignored for inventory (optional future error stats).


## 11. Performance & Limits

- Complexity roughly O(unique host × version × templated path × method).
- Bounded arrays for examples (10 max) avoid unbounded memory growth.
- Debounced snapshots recommended at call-site (e.g., every 5–30 seconds).


## 12. Testing Strategy

- Unit tests for:
  - Version detection edge-cases.
  - Segment classifiers and cardinality promotion.
  - Query param type inference.
  - Idempotent ingestion with out-of-order events.
- Integration tests with small synthetic NDJSON sets.


## 13. Future Extensions

- CLI (`arachne-inventory tail`) to tail NDJSON and drive `InventoryBuilder`.
- Exporters (OpenAPI/Postman) in a separate package to avoid coupling.
- PSL-backed apex resolver.
- GraphQL-aware grouping by `operationName`.


## 14. Resolved Decisions

- Parameter naming from resource names: not used (too many edge cases).
- Known slugs: seed list above; configurable.
- Cardinality threshold K=3 for `{var}`.
- Version detection: explicit and path-only (`v{number}` or `version/{number}` in first two segments). Stored as `vN`. Paths under versions have version stripped.
- Placeholder repetition: allowed without indexing.
