# @arachne/frontend — Agent Guide

This document is a fast, practical guide for working on the Vite + Vue 3 frontend located in `apps/frontend`.

## Overview
- Framework: Vite + Vue 3 + TypeScript
- State: Pinia stores under `src/stores`
- Routing: Vue Router under `src/router`
- RPC: tRPC client in `src/services/trpc.ts` (HTTP + WebSocket)
- Styling: Global styles in `src/assets`; theme initialization in `src/main.ts`
- Aliases: `@` resolves to `apps/frontend/src`

## Prerequisites
- Node: ^20.19.0 or >=22.12.0 (enforced via `package.json` engines)
- Monorepo install from the repo root: `npm install`
- Backend running for API calls and subscriptions: `@arachne/backend` on `http://127.0.0.1:8080/api` and `ws://127.0.0.1:8080/api`
  - If needed: `npm run dev --workspace @arachne/backend`
  - Database setup (once): `npm run db:push -w @arachne/database`, `npm run db:seed -w @arachne/database`

## Common Commands
From the repo root:
- Dev (all apps via Turbo): `npm run dev`
- Dev (frontend only): `turbo run dev --filter=@arachne/frontend`
- Or workspace dev: `npm run dev --workspace @arachne/frontend`
- Build: `npm run build -w @arachne/frontend`
- Preview build: `npm run preview -w @arachne/frontend`
- Type-check: `npm run type-check -w @arachne/frontend`
- Lint: `npm run lint -w @arachne/frontend`

## Project Structure
- `src/main.ts`: App bootstrap, theme setup, Pinia + Router registration, project store initialization.
- `src/router/`: Route definitions (`/`, `/request-editor`, `/settings`).
- `src/services/trpc.ts`: tRPC client configured for HTTP queries/mutations and WS subscriptions to `127.0.0.1:8080/api`.
- `src/stores/`: Pinia stores (`project`, `transactions`, `authProfiles`, `hosts`).
- `src/components/`, `src/views/`, `src/layouts/`: UI composition.
- `src/utils/`, `src/composables/`, `src/types/`: helpers, composables, shared types (re-exported from monorepo packages as needed).
- `vite.config.ts`: Vue plugin + Vue DevTools, `@` alias, Monaco editor optimization and chunking.

## Coding Conventions
- Language/Modules: TypeScript ESM and `.vue` SFCs.
- Formatting: 4 spaces, single quotes, no semicolons, trailing commas (es5). Run: `npm run prettier` (root).
- Linting: strict (fail on warnings). Fix issues before pushing: `npm run lint -w @arachne/frontend`.
- Types: prefer explicit exports at module boundaries; re-export shared types from `@arachne/backend` and `@arachne/database` via `src/types` when convenient.
- Naming: kebab-case files/dirs; PascalCase types/classes; camelCase variables/functions.

## Runtime & Integration Notes
- Backend dependency: UI expects the backend at `127.0.0.1:8080`. Update `src/services/trpc.ts` if the API host/port changes.
- Subscriptions: WebSocket link is used for real-time updates; ensure the backend WS endpoint is reachable.
- Router base: `createWebHistory(import.meta.env.BASE_URL)`; Vite preview/production must respect the base if deploying under a subpath.
- Theme: `main.ts` applies light/dark based on `localStorage('arachne-theme')` or system preference to avoid FOUC.
- Monaco: large dependency is split into its own chunk; dev server pre-bundles worker modules for faster HMR.

## Testing
- Vitest is configured at the monorepo root. This app currently has no local unit tests.
- To add tests here, co-locate under `apps/frontend/src/tests` and wire into the root Vitest config if needed. Keep tests fast and deterministic.

## Troubleshooting
- API errors or empty data: ensure backend is running and DB seeded.
- WebSocket failures: confirm `ws://127.0.0.1:8080/api` is reachable and not blocked by a proxy/firewall.
- Type errors from shared packages: run a root build or start root dev to ensure packages are compiled.
- Lint failures: run `npm run lint -w @arachne/frontend` and fix all warnings/errors.

## Useful Snippets
- Run only the frontend quickly: `npm run dev -w @arachne/frontend`
- Open Vite Vue DevTools: installed via `vite-plugin-vue-devtools`; follow the browser prompt/extension if presented.
- Check routes: edit `src/router/index.ts` and corresponding view files under `src/views`.

## PR Checklist (Frontend)
- `npm run lint -w @arachne/frontend`
- `npm run type-check -w @arachne/frontend`
- Build locally: `npm run build -w @arachne/frontend`
- Include UI screenshots for visible changes; note breaking changes clearly.

