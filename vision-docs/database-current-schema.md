# Database — Current Schema (Prisma)

This document summarizes the current Prisma models and how they serve today’s capture/analysis features.

## Models

- `Project`
  - Core scope for all data; `settings` JSON includes proxy/runtime knobs (e.g., host filter mode, body size).
  - Relations: `transactions`, `hosts`, `authProfiles`.
- `Transaction`
  - Denormalized URL fields (protocol, host, port, path, query, fragment) for fast filtering.
  - Request/response metadata (method, statusCode, duration, sizes, body presence).
  - Optional linking to editor metadata; relations to headers and bodies.
- `TransactionHeader`
  - Request and response headers (separate relations, one table).
- `TransactionBody`
  - Content metadata (type/encoding/size/detectedFormat/isCompressed) and a bounded `sample`.
- `SystemConfig`
  - Process‑wide configuration (active project pointer).
- `Host` / `Endpoint`
  - Lightweight analytics inventory, keyed by project → host → (method, path).
- `RequestEditorMetadata`
  - Captures request editor context for provenance and UX.
- `AuthProfile`
  - Declarative auth strategies with JSON configs and conditions; per‑project collection.

## Indexing & Performance

- Indexes on `Transaction`: `projectId`, `hostId`, `timestamp`, `urlHost`, `method`, `statusCode`, `metadataType`.
- Unique constraints: `Host` (per project hostname), `Endpoint` (per host, method, path).

## Strengths

- Transaction‑centric model aligns well with passive capture and basic replay.
- JSON fields for flexible `Project.settings` and `AuthProfile.authConfig`.
- Host/Endpoint analytics enable prioritization of high‑value paths.

## Current Gaps for Offensive Features

- No representation for active jobs (scanner/intruder/spider) and their results.
- No findings/issues model with evidence linkage.
- No request templates/parameter maps to replay captured traffic with substitutions.
- No sequence/macro representation (stateful flows; token extraction).
- No payload libraries/wordlists; no OAST interactions.

