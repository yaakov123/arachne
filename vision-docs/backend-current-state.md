# Backend — Current State

This document summarizes the current backend surface area, runtime architecture, data flows, and where the system is already aligned with an offensive web security toolchain.

## Overview

- Framework: Fastify + tRPC (with WebSocket subscriptions) in TypeScript.
- Proxy: MITM proxy from `@arachne/proxy`, with a plugin model and CA management.
- Persistence: Repositories from `@arachne/database` (Prisma/SQLite).
- Eventing: Lightweight in‑process event emitter for WS broadcasts.
- Auth: Optional bearer token for the API. Extracted auth profiles from traffic.

## Key Services and Plugins

- `ServiceContainer`: Wires core services (projects, transactions, broadcast, storage, auth profiles).
- `TransactionHandler` (proxy plugin):
  - Listens on `afterResponse` and builds normalized `TransactionData`.
  - Persists to database via `StorageService → TransactionService`.
  - Broadcasts `TransactionCompleteEvent` over tRPC subscriptions.
- `AuthExtracterPlugin` (proxy plugin):
  - Runs `afterRequest` and heuristically extracts credentials (Bearer, Basic, API key, JWT, custom headers).
  - Deduplicates against existing profiles; creates high‑confidence new `AuthProfile`s.
- `BroadcastService`: Emits events to `subscriptionsRouter`.
- `ProjectService`: Active project lifecycle; emits `projectChanged` for hot proxy config.
- `TransactionService`: Orchestrates transaction persistence and host/endpoint analytics.
- `StorageService`: Thin façade for transaction + auth profile persistence.

## tRPC Routers (Public Procedures)

- `health`: Health checks.
- `cert`, `ca`: Root CA lifecycle and trust instructions.
- `proxy`: Start/stop/status; updates runtime config per project.
- `projects`: CRUD + activate + transactions listing.
- `transactions`: Get full txn; unified filter/search with pagination.
- `hosts`: Host + endpoint analytics.
- `authProfiles`: CRUD, filter, toggle, duplicate, validate.
- `requests`: Fire a direct HTTP request via `undici` (request editor backend).
- `subscriptions`: WS streams for events/transactions/errors.

## Data Flow (Happy Path)

1. Proxy receives client request; plugins run (request hooks).
2. Upstream response returns; `TransactionHandler.afterResponse` normalizes data and emits `TransactionCompleteEvent`.
3. `StorageService` stores transaction; `HostRepository` updates analytics.
4. `BroadcastService` writes to WS subscription feed for real‑time UI.

## Current Strengths (Offensive Readiness)

- Passive capture of complete HTTP transactions with body samples and content hints.
- Project scoping and hot‑swappable proxy configuration (host whitelist/blacklist, body size limits).
- Basic analytics (hosts/endpoints) to focus targets.
- Heuristic credential extraction and creation of reusable `AuthProfile`s.
- Request editor API to reproduce/modify traffic.

## Gaps vs. Burp‑class Tooling

- No active scanning engine (no rules/payloads/attack jobs).
- No intruder/fuzzer (payload positions, wordlists, batching, compare/diff).
- No crawler/spider/JS rendering to expand attack surface.
- No findings/issues model or detection pipeline with evidence.
- No replay from captured transactions with parameterization/templates.
- No macro/sequence engine (login flows, CSRF token harvesting, stateful chains).
- No out‑of‑band interaction service (Burp Collaborator analog).
- Limited segmentation for sessions/contexts, rate limits, or safe‑mode guards.

## Non‑Goals (for now)

- Distributed multi‑node cluster.
- Third‑party plugin store/runtime isolation.
- Full JS DOM browser automation (can integrate later).

