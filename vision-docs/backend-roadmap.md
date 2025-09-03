# Backend — Roadmap and Design for Offensive Capabilities

This document proposes the backend architecture and API surface to evolve Arachne into a BurpSuite‑class offensive tool. It focuses on engines, services, modules, and tRPC endpoints.

## Guiding Principles

- Small, composable services with clear contracts.
- Deterministic, reproducible actions with audit logs and evidence.
- Async jobs for heavy work; live WS updates for UX.
- Configurable safety boundaries (scopes, rate limits, domains).

## New Backend Services

- Attack Engine
  - Orchestrates active attacks (scanner rules, intruder jobs, custom campaigns).
  - Executes request plans with concurrency control, pacing, retries, and auth.
  - Emits progress and results events; writes results and evidence.
- Template/Replay Service
  - Builds `RequestTemplate` from a captured `Transaction` (parameterized).
  - Applies `AuthProfile`s and variable sources to produce concrete requests.
- Detection Service
  - Runs signatures/analyzers over responses and cross‑request context.
  - Produces `Finding` with severity, CWE/OWASP mapping, and evidence pointers.
- Sequence/Macro Service
  - Defines and executes stateful chains (e.g., login → fetch CSRF → submit).
- Spider/Crawler Service (stub first)
  - Discovers endpoints via passive analysis and optional active crawling.
- OAST/Interaction Service (future)
  - Generates unique interaction tokens, exposes listener endpoint, records callbacks.
- Payload Library Service
  - Manages wordlists, payload sets, combinators, encoders/transformers.
- Job Queue/Runner
  - Persistent job definitions, cancel/pause/resume, retries, and rate limiting.

## Proposed tRPC Routers

- `templates`
  - `fromTransaction(id)` → `RequestTemplate`
  - `update(template)` / `delete(id)` / `list(projectId)`
- `intruder`
  - `createJob({ templateId, positions, payloadSets, strategy, repeat, rate, concurrency })`
  - `start(jobId)` / `pause(jobId)` / `resume(jobId)` / `cancel(jobId)`
  - `status(jobId)` / `results(jobId, pagination)`
- `scanner`
  - `start({ projectId, scope, ruleset, rate, concurrency })`
  - `status(scanId)` / `findings(scanId, pagination)` / `stop(scanId)`
- `sequences`
  - CRUD for macros/sequences; `execute(sequenceId, variables)`
- `payloads`
  - CRUD for payload sets, wordlists, encoders; `listBuiltin()`
- `findings`
  - `list(projectId, filters)` / `get(id)` / `audit(id)` / `dismiss(id)`
- `oast` (future)
  - `allocateToken()` / `interactions(filters)`
- `spider` (future)
  - `start({ seedUrls, authProfileId, scope })` / `status(id)` / `stop(id)`

## Eventing (WS Subscriptions)

- Extend `subscriptions` with channels for `jobs`, `findings`, `intruder`, `scanner`, `sequences`.
- Standardize event envelopes with progress, rate, ETA, and summary metrics.

## Execution Model

- Concurrency & Rate Limits: configurable per job/project; backpressure to avoid DoS.
- Scoping: allowlists (hosts, paths) and safe‑mode switches enforced centrally.
- Retry & Jitter: optional; ensure idempotency for unsafe methods is opt‑in.
- Auth: compose `AuthProfile` application before `beforeRequest` hooks.

## Detection Model (Initial)

- Passive rules over captured traffic (no requests).
- Active rules: response diffing, reflection checks, error patterning, timing deltas.
- Categories: Injection (SQL, NoSQL, XSS), Path Traversal, SSRF, Deserialization, Open Redirect, Command Injection, CRLF/Smuggling (cautious), Auth/Session misconfig (JWT, cookies, CORS), CSRF indicators.
- Evidence capture: response excerpts (bounded), header snapshots, timing, transaction linkage.

## Safety & Ethics

- Project‑level safe‑mode: block high‑risk attacks unless explicitly allowed.
- Domain scope enforcement; block private IP ranges unless configured.
- Pacing & throughput caps; sleep/jitter knobs.
- Red‑team logging/audit trail for every active request emitted.

## Phased Plan (Backend)

Phase 1 (Foundations)
- Attack Engine skeleton + Job Queue with in‑memory store (adapter for DB later).
- Request Template/Replay from Transactions; AuthProfile application.
- Intruder v1: single‑position payloads, basic payload sets, results stream.
- Findings store + manual finding creation from editor.

Phase 2 (Scanner & Detection)
- Detection Service with rule engine; response diff helpers; baselines.
- Scanner v1: rule library, scoped enumeration (passive + targeted active).
- Payload Library Service (built‑in lists + custom uploads).
- Findings workflow: status, severity, tags, audit trail.

Phase 3 (Sequences & Spider)
- Macro/Sequence runner; variables, extractors, and setters.
- Spider seed + passive hints to expand target surfaces.
- Job persistence; resumable jobs; cross‑project isolation.

## Implementation Notes

- Keep attacks using the same HTTP core (request builder) as proxy/editor for parity.
- tRPC contracts should return small pages, and stream progress via WS.
- Structure heavy response bodies with samples and diff pointers rather than full blobs.
- Prefer functional modules (rules, payload sources) with pure inputs/outputs for testing.

