# Arachne Architectural Conventions

This document outlines the architectural patterns and conventions used across the Arachne HTTP Proxy application, covering the relationships between the frontend, backend, and database layers.

## Overview

Arachne follows a layered architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │◄──►│     Backend     │◄──►│    Database     │
│   (Vue.js)      │    │   (Node.js)     │    │   (SQLite)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ├─ Stores               ├─ Services             ├─ Repositories
        ├─ Composables          ├─ tRPC Routers         ├─ Prisma Schema
        ├─ Components           ├─ Plugins              ├─ Types
        └─ Services             └─ Utils                └─ Migrations
```

## Package Structure

### Monorepo Organization

```
arachne/
├── apps/
│   ├── frontend/          # Vue.js application
│   └── backend/           # Node.js API server
└── packages/
    ├── api-types/         # Shared API contracts
    ├── database/          # Database layer & types
    ├── os/               # OS-specific utilities
    └── proxy/            # HTTP proxy core
```

## Layer-by-Layer Conventions

### 1. Database Layer (`packages/database/`)

#### Schema Definition (`schema.prisma`)

-   **Single source of truth** for data models
-   Uses SQLite for portability
-   JSON fields for flexible configuration storage
-   Proper indexing for performance

#### Repository Pattern (`src/repositories/`)

**Naming Convention**: `{Entity}Repository.ts`

-   `TransactionRepository.ts`
-   `ProjectRepository.ts`
-   `HostRepository.ts`
-   `AuthProfileRepository.ts`
-   `SystemConfigRepository.ts`

**Structure**:

```typescript
export class TransactionRepository {
    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient = getPrismaClient()) {
        this.prisma = prismaClient
    }

    // CRUD operations
    async create(data: TransactionCreateInput): Promise<Transaction>
    async findById(id: string): Promise<Transaction | null>
    async findByProject(projectId: string): Promise<Transaction[]>

    // Business-specific queries
    async findByIdWithAllRelatedData(id: string)
    async countByProject(projectId: string): Promise<number>
}
```

#### Type System (`src/types/index.ts`)

**Strongly Typed JSON Pattern**:

```typescript
// Database model (from Prisma)
export type {
    Project as DatabaseProject,
    Transaction,
    // ... other Prisma types
} from '@prisma/client'

// Application model (with typed JSON)
export type Project = Omit<DatabaseProject, 'settings' | 'tags'> & {
    settings: ProjectSettings // Strongly typed
    tags: string[] // Strongly typed
}

export interface ProjectSettings {
    maxTransactions?: number
    retentionDays?: number
    hostFilterMode?: 'blacklist' | 'whitelist'
    hostFilter?: string[]
    maxBodySize?: number
}
```

**Key Patterns**:

-   Separate Prisma types from application types
-   Use `Omit` and intersection types for JSON field typing
-   Export both input and output types for repositories

### 2. Backend Layer (`apps/backend/`)

#### Service Layer (`src/services/`)

**Naming Convention**: `{Domain}Service.ts`

-   `TransactionService.ts`
-   `ProjectService.ts`
-   `BroadcastService.ts`
-   `StorageService.ts`

**Structure**:

```typescript
export class TransactionService {
    constructor(
        private readonly transactionRepository: TransactionRepository = new TransactionRepository(),
        private readonly hostRepository: HostRepository = new HostRepository()
    ) {}

    // Business logic methods
    async addTransaction(projectId: string, event: TransactionCompleteEvent)
    async getTransaction(id: string)
    async getTransactionsByHost(projectId: string, hostId: string)

    // Data transformation
    private toTransactionCreateInput(
        projectId: string,
        hostId: string,
        event: TransactionCompleteEvent
    ): TransactionCreateInput
}
```

**Service Container Pattern**:

```typescript
export class ServiceContainer {
    private _projectService: ProjectService
    private _transactionService: TransactionService

    constructor() {
        // Initialize services with dependencies
    }

    // Getters for accessing services
    get projectService(): ProjectService {
        return this._projectService
    }
}
```

#### tRPC API Layer (`src/trpc/routers/`)

**Naming Convention**: `{domain}Router` or `{domains}Router`

-   `projectsRouter` (plural for CRUD operations)
-   `transactionsRouter`
-   `hostsRouter`
-   `proxyRouter` (singular for service operations)

**Structure**:

```typescript
export const projectsRouter = router({
    // Query operations
    list: publicProcedure.input(schemas.pagination).query(async ({ ctx }) => {
        /* ... */
    }),

    getById: publicProcedure
        .input(projectParamsSchema)
        .query(async ({ ctx, input }) => {
            /* ... */
        }),

    // Mutation operations
    create: publicProcedure
        .input(createProjectSchema)
        .mutation(async ({ ctx, input }) => {
            /* ... */
        }),

    update: publicProcedure
        .input(updateProjectSchema)
        .mutation(async ({ ctx, input }) => {
            /* ... */
        }),
})
```

### 3. Shared Types Layer (`packages/api-types/`)

#### WebSocket Events (`src/ws.ts`)

```typescript
export type BackendEvent = ErrorEvent | TransactionCompleteEvent

export interface BaseEvent {
    type: 'error' | 'transactionComplete'
    id: string
    ts: string // ISO timestamp
}

export interface TransactionCompleteEvent extends BaseEvent {
    type: 'transactionComplete'
    transaction: {
        request: TransactionRequest
        response?: TransactionResponse
        timing: TimingInfo
        summary: TransactionSummary
    }
}
```

#### Authentication Profiles (`src/auth-profile.ts`)

```typescript
export type AuthMethod =
    | 'bearer'
    | 'api-key'
    | 'basic'
    | 'jwt'
    | 'oauth2'
    | 'custom-header'
    | 'custom'

export type AuthPlacement =
    | 'header'
    | 'query'
    | 'body-form'
    | 'body-json'
    | 'cookie'
```

### 4. Frontend Layer (`apps/frontend/`)

#### Store Pattern (`src/stores/`)

**Naming Convention**: `{domain}.ts` using Pinia

-   `project.ts`
-   `transactions.ts`
-   `hosts.ts`

**Structure**:

```typescript
export const useProjectStore = defineStore('project', () => {
    // State
    const projects = ref<Project[]>([])
    const currentProject = ref<Project | null>(null)
    const loading = ref(false)

    // Actions
    const loadProjects = async () => {
        loading.value = true
        const response = await trpc.projects.list.query()
        projects.value = response.projects
        loading.value = false
    }

    const createProject = async (project: ProjectCreateInput) => {
        // Implementation
    }

    return {
        // State
        projects: readonly(projects),
        currentProject: readonly(currentProject),
        loading: readonly(loading),

        // Actions
        loadProjects,
        createProject,
    }
})
```

#### Composables Pattern (`src/composables/`)

**Naming Convention**: `use{Feature}.ts`

-   `useProjectForm.ts`
-   `useProxy.ts`
-   `useTheme.ts`

**Structure**:

```typescript
export function useTheme() {
    const theme = ref<Theme>(getCurrentTheme())

    const toggleTheme = () => {
        theme.value = theme.value === 'light' ? 'dark' : 'light'
    }

    return {
        theme: readonly(theme),
        toggleTheme,
        isDark: computed(() => theme.value === 'dark'),
    }
}
```

#### Component Organization (`src/components/`)

-   **Atomic Design**: Base components, composite components
-   **Feature-based**: Components grouped by domain
-   **Props/Events**: TypeScript interfaces for component contracts

## Key Architectural Patterns

### 1. Strongly Typed JSON Pattern

Instead of storing untyped JSON in the database, we create TypeScript interfaces:

```typescript
// Database schema
model Project {
    settings Json  // Raw JSON in database
}

// Application types
export interface ProjectSettings {
    maxTransactions?: number
    retentionDays?: number
    hostFilterMode?: 'blacklist' | 'whitelist'
}

export type Project = Omit<DatabaseProject, 'settings'> & {
    settings: ProjectSettings  // Strongly typed in application
}
```

### 2. Repository Pattern

Each database entity has a corresponding repository:

-   Encapsulates database operations
-   Provides business-specific query methods
-   Handles data transformation between Prisma and application types

### 3. Service Layer Pattern

Business logic is centralized in service classes:

-   Services orchestrate multiple repositories
-   Handle complex business operations
-   Provide clean interfaces for API layer

### 4. tRPC Contract Pattern

Type-safe API contracts between frontend and backend:

-   Shared types via `@arachne/database` and `@arachne/api-types`
-   Input validation with Zod schemas
-   Automatic TypeScript inference

### 5. Store-First Frontend Pattern

Frontend state management follows a consistent pattern:

-   Pinia stores for domain state
-   Composables for reusable logic
-   Components consume stores and composables

## Naming Conventions

### Files and Classes

-   **Repositories**: `{Entity}Repository.ts` → `TransactionRepository`
-   **Services**: `{Domain}Service.ts` → `TransactionService`
-   **Stores**: `{domain}.ts` → `project.ts`
-   **Composables**: `use{Feature}.ts` → `useTheme.ts`
-   **Components**: `PascalCase.vue` → `ProjectManagement.vue`

### Database

-   **Tables**: `snake_case` → `transactions`, `auth_profiles`
-   **Models**: `PascalCase` → `Transaction`, `AuthProfile`
-   **Fields**: `camelCase` → `createdAt`, `projectId`

### API

-   **Routers**: `{domain}Router` → `projectsRouter`, `transactionsRouter`
-   **Procedures**: `camelCase` → `getById`, `create`, `update`

## Data Flow

### Transaction Processing Example

1. **Proxy captures HTTP transaction** → `TransactionCompleteEvent`
2. **Backend receives event** → `StorageService.handleTransactionComplete()`
3. **Service processes data** → `TransactionService.addTransaction()`
4. **Repository persists data** → `TransactionRepository.create()`
5. **WebSocket broadcasts event** → Frontend receives update
6. **Store updates state** → `useTransactionsStore.addTransaction()`
7. **Components react** → UI updates automatically

### Type Safety Chain

```
Prisma Schema → Generated Types → Repository Types → Service Types → API Types → Frontend Types
```

Each layer maintains type safety while allowing for appropriate abstractions.

## Best Practices

### 1. Type Safety

-   Always use TypeScript interfaces for JSON data
-   Leverage Prisma's generated types as base types
-   Use `Omit` and intersection types for type transformations

### 2. Separation of Concerns

-   Repositories handle data access only
-   Services contain business logic
-   Controllers (tRPC routers) handle HTTP concerns
-   Stores manage frontend state

### 3. Error Handling

-   Use tRPC's error handling for API errors
-   Repository methods return `null` for not found
-   Services throw business exceptions
-   Frontend stores handle loading/error states

### 4. Performance

-   Use Prisma's `include` and `select` for efficient queries
-   Implement pagination in repositories
-   Use indexes for frequently queried fields
-   Cache frequently accessed data in stores

### 5. Testing

-   Unit test repositories with test database
-   Integration test services with real dependencies
-   Mock external dependencies in tests
-   Use Vitest for consistent testing across packages

This architectural pattern ensures maintainability, type safety, and clear separation of concerns across the entire application stack.
