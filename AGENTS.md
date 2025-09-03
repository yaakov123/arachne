# Repository Guidelines

## Project Structure & Module Organization
- apps/backend: Fastify + tRPC server (TypeScript).
- apps/frontend: Vite + Vue 3 web UI.
- packages/proxy: HTTP proxy core library with unit tests.
- packages/proxy-e2e: End-to-end tests targeting the proxy.
- packages/database: Prisma schema, migrations, and DB helpers.
- packages/api-types, packages/os: Shared types and utilities.

## Build, Test, and Development Commands
- Root dev: `npm run dev` (Turbo runs package dev scripts).
- Filtered dev: `turbo run dev --filter=@arachne/backend` (or `--filter=@arachne/frontend`).
- Build all: `npm run build`.
- Lint all: `npm run lint`; Type-check all: `npm run type-check`.
- Tests: `npm test` (Vitest monorepo projects); watch: `npm run test:watch`; CI: `npm run test:ci`.
- Per workspace example: `npm run dev --workspace @arachne/backend`, `npm test -w @arachne/proxy`.
- Database (in packages/database): `npm run db:push`, `npm run db:seed`, `npm run studio`.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM) and Vue SFCs.
- Formatting (root .prettierrc): 4 spaces, single quotes, no semicolons, trailing commas (es5). Run `npm run prettier`.
- Linting (flat ESLint): TS + Vue rules; fix warnings before pushing. Prefer explicit types at module boundaries.
- Naming: kebab-case dirs/files; PascalCase for types/classes; camelCase for variables/functions.

## Testing Guidelines
- Framework: Vitest. Unit tests live under `packages/*/tests/*.test.ts`.
- E2E: `packages/proxy-e2e/tests` (uses `@arachne/proxy`).
- Run all: `npm test`. Filter: `vitest run packages/proxy --reporter=verbose`.
- Write fast, deterministic tests. Mock I/O where possible. Co-locate fixtures under `tests/__fixtures__` when needed.

## Commit & Pull Request Guidelines
- Commits: Conventional prefixes (e.g., `feat:`, `fix:`, `refactor:`). Use imperative, present tense; concise subject (<72 chars).
- Before PR: run `npm run lint`, `npm run type-check`, and `npm test`. Include description, scope, linked issues, and UI screenshots (frontend changes).
- Small, focused PRs are preferred. Note breaking changes clearly.

## Security & Configuration
- Node: use v20+ (frontend supports ^20.19 or >=22.12). Do not commit secrets; keep `.env` local (see packages/database/.env example). Review logs/fixtures for sensitive data before pushing.
