# Arachne Monorepo

Tools for capturing and analyzing web traffic via a local MITM proxy. This monorepo contains:
- a pluggable HTTP/HTTPS proxy (`@arachne/proxy`)
- a recorder that writes structured NDJSON traffic logs (`@arachne/recorder`)
- a small React demo app (`@arachne/app`)
- shared utilities (`@arachne/shared`)

## Structure

```
arachne/
├── packages/
│   ├── shared/           # Shared utilities and types used across packages
│   ├── app/              # React example UI (demo, optional)
│   ├── proxy/            # Core MITM proxy with plugin system and CA management
│   └── recorder/         # Recorder plugin and helper to run proxy + recorder
├── package.json          # Root workspace configuration
└── tsconfig.json         # TypeScript project references
```

## What is Arachne?

- __Goal__: Make it easy to intercept, inspect, and persist HTTP/HTTPS traffic from a local machine for debugging, QA, and analysis.
- __How__: A local man-in-the-middle proxy that issues per-host certificates from a generated root CA, plus a recorder that outputs newline-delimited JSON (NDJSON) event streams.

## Packages

- __`@arachne/proxy`__ (`packages/proxy/`)
  - A fully-fledged HTTP/HTTPS MITM proxy with a plugin API.
  - Generates a root CA and on-the-fly per-host certs. Includes CLI to init/install CA and start the proxy.

- __`@arachne/recorder`__ (`packages/recorder/`)
  - Provides a `traffic-recorder` plugin that writes NDJSON records for connect, request, response, and optionally bodies.
  - Helper `startRecorderProxy()` to boot a proxy with the recorder attached and manage lifecycle.

- __`@arachne/app`__ (`packages/app/`)
  - Small React demo showcasing the monorepo wiring. Not required for proxy/recorder usage.

- __`@arachne/shared`__ (`packages/shared/`)
  - Shared types/utilities used by other packages.

## How they fit together

1. You run the proxy locally and configure your browser/system to use it.
2. The proxy intercepts traffic and emits events to plugins.
3. The recorder plugin writes a normalized NDJSON log to disk for later analysis.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build all packages:
   ```bash
   npm run build
   ```

3. Start development (app only):
   ```bash
   cd packages/app
   npm run dev
   ```

## Available Commands

### Root Level
- `npm run build` - Build all packages
- `npm run dev` - Run dev scripts in all packages
- `npm run lint` - Lint all packages
- `npm run type-check` - Type check all packages

### Per Package
Run commands in specific packages:
```bash
npm run build --workspace=packages/shared
npm run dev --workspace=packages/app
```

## Adding New Packages

1. Create a new directory in `packages/`:
   ```bash
   mkdir packages/new-package
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@arachne/new-package",
     "version": "1.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite build --watch",
       "build": "tsc && vite build",
       "type-check": "tsc --noEmit"
     },
     "devDependencies": {
       "typescript": "^5.0.0",
       "vite": "^5.0.0"
     }
   }
   ```

3. Create `tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src",
       "composite": true
     },
     "include": ["src/**/*"],
     "exclude": ["dist", "node_modules"]
   }
   ```

4. Add to root `tsconfig.json` references:
   ```json
   "references": [
     { "path": "./packages/shared" },
     { "path": "./packages/app" },
     { "path": "./packages/new-package" }
   ]
   ```

5. Install dependencies:
   ```bash
   npm install
   ```

## Using Shared Package

Import from the shared package in any other package:

```typescript
import { createUser, formatUserName, type User } from '@arachne/shared';
```

## Development

- The `shared` package must be built before other packages can import from it
- Use TypeScript project references for efficient builds
- Build tools: app uses Vite + React; libraries use pkgroll + TypeScript

## Quick start: run the proxy and recorder (macOS)

1. Build the required packages:
   ```bash
   npm run build -w @arachne/proxy -w @arachne/recorder
   ```
2. Initialize and (optionally) trust the root CA:
   ```bash
   npm exec -w @arachne/proxy arachne-proxy init-ca
   # Optional (may require sudo):
   sudo npm exec -w @arachne/proxy arachne-proxy install-ca
   ```
3. Start the recorder-powered proxy (writes to ~/.arachne/recorder/traffic.ndjson by default):
   ```bash
   npm exec -w @arachne/recorder arachne-recorder
   # or programmatically via startRecorderProxy() from @arachne/recorder
   ```
4. Point your system/browser at the proxy (default 127.0.0.1:8899).

See `packages/proxy/README.md` for more CLI details.

## Security notes

- Trusting a local root CA allows interception of HTTPS traffic. Only install the CA on machines you control, and remove it when finished.
- Logs may contain sensitive metadata; header names like `authorization` and `cookie` are redacted by default in the recorder. Review and adjust `redactHeaders` as needed.