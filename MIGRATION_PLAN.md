# Arachne SQLite Migration Plan

## Overview

Migrate from file-based storage (JSON metadata + JSONL transactions) to SQLite with Prisma ORM.

## Current State Analysis

### File Structure

```
projects/
├── active-project.json                 # Current active project
├── {project-id}/
│   ├── metadata.json                   # ProjectMetadata
│   └── transactions.jsonl              # TransactionCompleteEvent per line
```

## Migration Strategy

### Phase 3: Service Layer Updates

#### 3.1 Backend Service Refactoring

-   Update `apps/backend` to use `@arachne/database` package
-   Replace file-based `ProjectService` with database repositories
-   Maintain existing API compatibility
-   Add transaction management for data consistency

#### 3.2 Database Service Integration

-   Implement repository pattern in database package
-   Create service layer for business logic
-   Handle database connections and configuration
-   Add error handling and logging

## Database Schema Highlights

### Key Design Decisions

1. **Denormalized URL Storage**

    - Store URL components directly in Transaction table
    - Faster queries without joins
    - Trade-off: slight storage increase for query performance

2. **Separate Headers Table**

    - Many-to-one relationship
    - Easier querying by header name/value
    - Separate request/response via `headerType`

3. **Body Content Storage**

    - Separate table for large content
    - Metadata preserved for content analysis
    - Sample size limits to prevent SQLite bloat

4. **Repeater Metadata Separation**

    - Separate table for repeater tracking
    - Optional relationship (not all transactions are repeated)
    - Cleaner transaction model without nullable repeater fields

5. **Inventory Optimization**
    - Separate Host/Endpoint tables
    - Pre-computed statistics
    - Faster analytics queries

### Indexing Strategy

-   **Primary lookups**: projectId, timestamp, urlHost
-   **Analytics**: method, statusCode, hostId
-   **Repeater**: source, originalTransactionId

## Database Package Architecture

### Package Responsibilities

#### `@arachne/database` Package

-   **Database Schema**: Prisma schema definition and migrations
-   **Client Configuration**: Prisma client setup and connection management
-   **Repository Layer**: Data access objects for each entity
-   **Service Layer**: Business logic and complex queries
-   **Type Definitions**: Database models and custom types

#### Repository Pattern

```typescript
// Project Repository - handles CRUD operations
export class ProjectRepository {
    constructor(private prisma: PrismaClient) {}

    async create(data: CreateProjectData): Promise<Project>
    async findById(id: string): Promise<Project | null>
    async findMany(options?: FindProjectsOptions): Promise<Project[]>
    async update(id: string, data: UpdateProjectData): Promise<Project>
    async delete(id: string): Promise<void>
}

// Transaction Repository - handles transaction operations
export class TransactionRepository {
    constructor(private prisma: PrismaClient) {}

    async create(data: CreateTransactionData): Promise<Transaction>
    async findByProject(
        projectId: string,
        options?: PaginationOptions
    ): Promise<Transaction[]>
    async findWithHeaders(id: string): Promise<TransactionWithHeaders | null>
    async deleteByProject(projectId: string): Promise<void>
}
```

#### Service Layer

```typescript
// High-level database services that use repositories
export class DatabaseProjectService {
    constructor(
        private projectRepo: ProjectRepository,
        private transactionRepo: TransactionRepository
    ) {}

    async createProjectWithDefaults(
        request: CreateProjectRequest
    ): Promise<ProjectInfo>
    async getProjectWithStats(id: string): Promise<ProjectInfo>
    async addTransactionToProject(
        projectId: string,
        transaction: TransactionCompleteEvent
    ): Promise<void>
}
```

### Integration with Backend

#### Current vs New Architecture

```typescript
// OLD: apps/backend/src/services/project-service.ts
class ProjectService {
    // File-based operations
    private getProjectDir(projectId: string): string
    private getMetadataPath(projectId: string): string
    // ... file operations
}

// NEW: apps/backend/src/services/project-service.ts
import { DatabaseProjectService } from '@arachne/database'

class ProjectService {
    constructor(private dbService: DatabaseProjectService) {}

    // Delegate to database service
    async createProject(request: CreateProjectRequest): Promise<ProjectInfo> {
        return this.dbService.createProjectWithDefaults(request)
    }
}
```

## Performance Considerations

### SQLite Optimizations

-   `PRAGMA journal_mode = WAL` for better concurrency
-   `PRAGMA synchronous = NORMAL` for performance
-   `PRAGMA cache_size = -64000` (64MB cache)
-   `PRAGMA temp_store = MEMORY` for temp tables

### Query Patterns

-   Use prepared statements via Prisma
-   Implement connection pooling
-   Batch inserts for bulk operations
-   Pagination for large result sets

## Compatibility Layer

Maintain existing API contracts:

-   `ProjectInfo` interface compatibility
-   `TransactionCompleteEvent` format
-   Fresh start with clean database

## Testing Strategy

1. **Unit tests** for service layer changes
2. **Integration tests** for database operations
3. **Performance tests** with realistic data volumes
4. **Schema validation** for data integrity

## Timeline

-   **Phase 1**: 1-2 days (Database package setup, structure)
-   **Phase 2**: 1 day (Prisma setup, schema, generation)
-   **Phase 3**: 2-3 days (Backend service refactoring, integration)
-   **Testing**: 1-2 days (Validation, performance, integration)

Total: ~1 week for complete migration

## Environment Configuration

### Database Package (.env)

The `packages/database/.env` file should contain:

```
DATABASE_URL="file:./dev.db"
```

### Backend Application

The backend already has environment variable handling patterns in `apps/backend/src/index.ts`. No additional DATABASE_URL configuration needed there since the database package will handle its own connection.

For production deployments, set `DATABASE_URL` to point to the desired SQLite file location:

```bash
# Development (relative to packages/database/)
DATABASE_URL="file:./dev.db"

# Production (absolute path)
DATABASE_URL="file:/app/data/arachne.db"
```

## Implementation Order

1. **Create database package structure**
2. **Move schema and setup Prisma**
3. **Configure DATABASE_URL environment variable**
4. **Implement repository layer**
5. **Create database service layer**
6. **Update backend to use database package**
7. **Test and validate integration**
8. **Performance tuning and optimization**
