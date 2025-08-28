# @arachne/database

Database package for Arachne HTTP Proxy - provides SQLite-based persistence with Prisma ORM.

## Overview

This package replaces the file-based storage system with a proper database layer, offering:

-   **Project management** with metadata and settings
-   **Transaction storage** with detailed request/response data
-   **Host/endpoint analytics** for traffic analysis
-   **System configuration** management
-   **High-performance querying** with proper indexing

## Architecture

```
@arachne/database
├── src/
│   ├── client.ts              # Database connection & configuration
│   ├── types/                 # TypeScript definitions
│   ├── repositories/          # Data access layer
│   │   ├── base.ts           # Common repository functionality
│   │   ├── project.ts        # Project CRUD operations
│   │   ├── transaction.ts    # Transaction management
│   │   ├── host.ts          # Analytics data
│   │   └── system-config.ts # System settings
│   ├── services/             # Business logic layer
│   │   ├── database-project.ts   # Project-focused operations
│   │   └── database-analytics.ts # Analytics operations
│   └── utils/               # Utilities
│       ├── id.ts           # ID generation
│       └── migration.ts    # File migration tools
└── schema.prisma           # Database schema
```

## Quick Start

### 1. Environment Setup

Create a `.env` file in the database package directory:

```bash
DATABASE_URL="file:./dev.db"
```

### 2. Initialize Database

```bash
cd packages/database
npm run db:generate  # Generate Prisma client
npm run db:push     # Create database tables
```

### 3. Basic Usage

```typescript
import {
    DatabaseProjectService,
    DatabaseAnalyticsService,
    initializeDatabase,
} from '@arachne/database'

// Initialize database with optimizations
await initializeDatabase()

// Create services
const projectService = new DatabaseProjectService()
const analyticsService = new DatabaseAnalyticsService()

// Create a project
const project = await projectService.createProjectWithDefaults({
    name: 'My API Project',
    description: 'Testing my REST API',
})

// Add a transaction
await projectService.addTransactionToProject(
    project.metadata.id,
    transactionEvent
)

// Get analytics
const inventory = await analyticsService.getInventoryTree()
```

## Repository Layer

### BaseRepository

Common functionality for all repositories:

```typescript
import { BaseRepository } from '@arachne/database'

class MyRepository extends BaseRepository {
    // Inherit pagination, ordering, JSON conversion utilities
}
```

### ProjectRepository

CRUD operations for projects:

```typescript
import { ProjectRepository } from '@arachne/database'

const projectRepo = new ProjectRepository()

// Create project
const project = await projectRepo.create({
    id: 'project-123',
    name: 'My Project',
    maxTransactions: 5000,
})

// Find with stats
const projectWithStats = await projectRepo.findByIdWithStats(project.id)

// Update
await projectRepo.update(project.id, { name: 'Updated Name' })

// Convert to API format
const projectInfo = await projectRepo.toProjectInfo(project)
```

### TransactionRepository

Transaction management with relationships:

```typescript
import { TransactionRepository } from '@arachne/database'

const transactionRepo = new TransactionRepository()

// Create transaction with headers/bodies
const transaction = await transactionRepo.create({
    id: 'conn_123:req_456',
    projectId: 'project-123',
    method: 'GET',
    urlFull: 'https://api.example.com/users',
    headers: [
        { name: 'Authorization', value: 'Bearer token', type: 'request' },
    ],
    requestBody: {
        size: 100,
        sample: '{"query": "data"}',
        encoding: 'utf8',
        // ... other fields
    },
})

// Find with all related data
const fullTransaction = await transactionRepo.findByIdWithHeaders(
    transaction.id
)

// Paginated project transactions
const transactions = await transactionRepo.findByProject('project-123', {
    limit: 50,
    orderBy: 'timestamp',
    method: 'POST',
})
```

### HostRepository

Analytics and endpoint tracking:

```typescript
import { HostRepository } from '@arachne/database'

const hostRepo = new HostRepository()

// Record activity (creates/updates host & endpoint)
await hostRepo.recordTransactionActivity('api.example.com', 'GET', '/users')

// Get host with endpoints
const hostData = await hostRepo.findHostByIdWithEndpoints('api.example.com')

// Get top active hosts
const topHosts = await hostRepo.getTopHosts(10)

// Build inventory tree for API
const inventory = await hostRepo.buildInventoryTree()
```

### SystemConfigRepository

System configuration management:

```typescript
import { SystemConfigRepository } from '@arachne/database'

const configRepo = new SystemConfigRepository()

// Set active project
await configRepo.setActiveProjectId('project-123')

// Get current active project
const activeProjectId = await configRepo.getActiveProjectId()

// Check if project is active
const isActive = await configRepo.isProjectActive('project-123')
```

## Service Layer

### DatabaseProjectService

High-level project operations:

```typescript
import { DatabaseProjectService } from '@arachne/database'

const service = new DatabaseProjectService()

// Create project with defaults
const project = await service.createProjectWithDefaults({
    name: 'My Project',
    settings: { maxTransactions: 1000 },
})

// Add transaction (handles analytics & retention)
await service.addTransactionToProject(project.metadata.id, event)

// Get project transactions with pagination
const { transactions, total } = await service.getProjectTransactions(
    project.metadata.id,
    { limit: 50, method: 'POST' }
)

// Project lifecycle
await service.setActiveProject(project.metadata.id)
await service.deleteProject(project.metadata.id)
```

### DatabaseAnalyticsService

Analytics and reporting:

```typescript
import { DatabaseAnalyticsService } from '@arachne/database'

const service = new DatabaseAnalyticsService()

// Get complete inventory
const inventory = await service.getInventoryTree()

// Get endpoint interactions
const interactions = await service.getHostEndpointInteractions(
    'api.example.com',
    'GET',
    '/users',
    { limit: 100 }
)

// Analytics summary
const summary = await service.getAnalyticsSummary()
// Returns: { totalHosts, totalEndpoints, mostActiveHost }

// Cleanup old data
await service.cleanupOldAnalytics(30) // 30 days retention
```

## Database Client

### Connection Management

```typescript
import {
    getPrismaClient,
    closePrismaClient,
    withTransaction,
} from '@arachne/database'

// Get singleton client
const prisma = getPrismaClient()

// Use transactions for consistency
await withTransaction(async (tx) => {
    await tx.project.create(/* ... */)
    await tx.transaction.create(/* ... */)
})

// Cleanup on shutdown
await closePrismaClient()
```

### Database Initialization

```typescript
import { initializeDatabase } from '@arachne/database'

// Apply SQLite optimizations
await initializeDatabase()
// Sets: WAL mode, NORMAL sync, 64MB cache, memory temp store
```

## Migration from File Storage

For migrating existing file-based projects:

```typescript
import { migrateFromFileStorage, migrateActiveProject } from '@arachne/database'

// Migrate projects and transactions
const result = await migrateFromFileStorage({
    projectsDir: '/path/to/projects',
    batchSize: 100,
    dryRun: false,
})

console.log(`Migrated ${result.projectsMigrated} projects`)
console.log(`Migrated ${result.transactionsMigrated} transactions`)

// Migrate active project setting
const activeProjectId = await migrateActiveProject('/path/to/projects')
if (activeProjectId) {
    await configRepo.setActiveProjectId(activeProjectId)
}
```

## Type Safety

All repositories and services are fully typed:

```typescript
import type {
    Project,
    Transaction,
    CreateProjectData,
    ProjectInfo,
    TransactionCompleteEvent,
} from '@arachne/database'

// Type-safe project creation
const projectData: CreateProjectData = {
    id: 'project-123',
    name: 'My Project',
    maxTransactions: 1000,
}

// Type-safe API conversion
const projectInfo: ProjectInfo = await projectRepo.toProjectInfo(project)
```

## Performance Features

-   **Connection pooling** via Prisma
-   **Prepared statements** for all queries
-   **Batch operations** for bulk inserts
-   **Optimized indexes** on common query fields
-   **SQLite optimizations** (WAL, caching, memory storage)
-   **Automatic cleanup** of old data
-   **Pagination** support throughout

## Scripts

```bash
npm run db:generate    # Generate Prisma client
npm run db:push       # Apply schema to database
npm run db:seed       # Run seed script (if created)
npm run lint          # Lint TypeScript code
npm run type-check    # Type checking only
```

## Environment Variables

-   `DATABASE_URL` - SQLite database file path (default: `file:./dev.db`)
-   `NODE_ENV` - Controls logging level (`development` for verbose logging)

## Error Handling

All repository methods can throw errors. Service layer methods include proper error handling:

```typescript
try {
    const project = await projectService.getProjectWithStats('invalid-id')
    if (!project) {
        // Handle not found
    }
} catch (error) {
    // Handle database errors
    console.error('Database operation failed:', error)
}
```

## Integration with Backend

Replace existing file-based services:

```typescript
// OLD: File-based project service
import { ProjectService } from './services/project-service'

// NEW: Database-backed service
import { DatabaseProjectService } from '@arachne/database'

const projectService = new DatabaseProjectService()
```

The database services maintain API compatibility with existing interfaces.
