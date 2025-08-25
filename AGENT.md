# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Root Level (Turbo monorepo)
- `npm run build` - Build all packages (dependencies built first)
- `npm run dev` - Start development servers across all apps
- `npm run lint` - Lint all packages
- `npm run type-check` - Type check all packages  
- `npm run test` - Run tests across all packages
- `npm run test:ci` - Build proxy package then run tests
- `npm run prettier` - Format all code with Prettier
- `npm run cleanup` - Run cleanup tasks

### Per-Package Development
- `npm run dev -w @arachne/backend` - Start backend server (Fastify + WebSockets)
- `npm run dev -w @arachne/frontend` - Start frontend dev server (Vue + Vite)
- `npm run build -w @arachne/proxy` - Build specific package
- `npm run test:watch -w @arachne/backend` - Watch tests for specific package

### Testing
- `npm run test:watch` - Watch mode for all tests (vitest)
- Individual package tests: `npm run test -w <package-name>`

## Architecture Overview

This is a TypeScript monorepo for web traffic analysis via MITM proxy, consisting of:

### Core Packages (`packages/`)
- **`@arachne/proxy`** - HTTP/HTTPS MITM proxy with plugin system and certificate authority management
- **`@arachne/api-types`** - Shared TypeScript interfaces for HTTP and WebSocket communication

### Applications (`apps/`)
- **`@arachne/backend`** - Fastify server with WebSocket hub, integrates proxy + recorder, provides REST API
- **`@arachne/frontend`** - Vue 3 SPA
### Key Architecture Patterns

**Plugin System**: The proxy uses a plugin architecture where traffic events (connect, request, response) flow through registered plugins. The recorder plugin writes to NDJSON files, while the broadcast plugin sends real-time data to connected WebSocket clients.

**Certificate Management**: The proxy generates a root CA and issues per-host certificates on-the-fly for HTTPS interception. CA can be installed to system trust store.

**Real-time Communication**: Backend maintains a WebSocket hub (`WsHub`) that broadcasts traffic data to connected frontend clients in real-time.

**Monorepo Structure**: Uses npm workspaces + Turbo for build orchestration. TypeScript project references ensure proper build dependencies.

## Technology Stack

- **Build**: Turbo (orchestration), Vite (frontend), tsx (backend dev)
- **Frontend**: Vue 3, Pinia (state), Vue Router, Axios
- **Backend**: Fastify, WebSockets, node-forge (certificates)
- **Testing**: Vitest for unit tests, custom e2e setup
- **Linting**: ESLint with TypeScript and Vue support

## Environment Configuration

Backend accepts these environment variables:
- `BACKEND_HOST/PORT` - HTTP server binding
- `ARACHNE_PROXY_HOST/PORT` - Proxy server binding  
- `ARACHNE_CA_STORE_DIR` - Certificate storage location
- `ARACHNE_REC_OUT_DIR` - Recording output directory
- `BACKEND_TOKEN` - Optional API authentication

## Development Notes

- The backend integrates proxy + recorder + WebSocket broadcasting in a single process
- Frontend connects via WebSocket to receive real-time traffic updates
- HTTPS interception requires trusting the generated root CA certificate