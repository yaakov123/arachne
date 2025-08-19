# Arachne Monorepo

A TypeScript monorepo using npm workspaces and Vite.

## Structure

```
arachne/
├── packages/
│   ├── shared/          # Shared utilities and types
│   └── app/             # React application
├── package.json         # Root workspace configuration
└── tsconfig.json        # TypeScript project references
```

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
- All packages use Vite for building