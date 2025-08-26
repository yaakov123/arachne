# Proxy Configuration Plan: Project-Based Runtime Configuration

## Overview

This document outlines the plan to enable the backend to update proxy configuration based on project metadata when starting the proxy, without recreating the `MitmProxyServer` instance.

## Current Architecture Analysis

**Current Proxy Start Flow:**

1. Backend creates `MitmProxyServer` instance with static configuration in `apps/backend/src/index.ts`
2. API endpoint `/api/proxy/start` calls `proxy.start()` directly
3. Proxy uses fixed configuration: `ignoredHosts: ['*.tradovateapi.com']` and other static options
4. No dynamic configuration based on active project

**Project Metadata Structure:**

```typescript
ProjectMetadata.settings: {
  maxTransactions?: number      // Used by backend
  retentionDays?: number       // Used by backend
  ignoredHosts?: string[]      // 🎯 CAN BE USED FOR PROXY
  maxBodySize?: number         // 🎯 CAN BE USED FOR PROXY
}
```

**Problem with Current Proxy Components:**

-   Configuration options (`ignoredHosts`, `maxBodySize`) are passed to constructors
-   No mechanism to update configuration after instantiation
-   Adding per-property update methods would be clunky and unmaintainable

## Proposed Solution: Reactive Configuration Store

### Core Pattern: Shared Configuration State

Instead of adding update methods for each property, use a **Configuration State** pattern where components hold references to a shared configuration object that can be updated atomically.

**Key Benefits:**

-   Single update method for all configuration
-   Automatic propagation to all components
-   Easy to add new configuration properties
-   Type-safe configuration access
-   Zero downtime configuration updates

## Implementation Plan

### Phase 1: Create Configuration Store

**File: `packages/proxy/src/config/proxy-config-store.ts`**

```typescript
export interface ProxyRuntimeConfig {
    ignoredHosts: string[]
    maxBodySize: number
    // Future extensibility:
    // customHeaders?: Record<string, string>
    // rateLimit?: { requests: number, windowMs: number }
    // retryOptions?: { retries: number, backoff: number }
}

export class ProxyConfigStore {
    private config: ProxyRuntimeConfig
    private listeners: Set<(config: ProxyRuntimeConfig) => void> = new Set()

    constructor(initialConfig: ProxyRuntimeConfig) {
        this.config = { ...initialConfig }
    }

    get current(): Readonly<ProxyRuntimeConfig> {
        return this.config
    }

    update(newConfig: Partial<ProxyRuntimeConfig>): void {
        const oldConfig = this.config
        this.config = { ...this.config, ...newConfig }

        // Only notify if something actually changed
        if (!this.isEqual(oldConfig, this.config)) {
            this.notifyListeners()
        }
    }

    subscribe(listener: (config: ProxyRuntimeConfig) => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.config))
    }

    private isEqual(a: ProxyRuntimeConfig, b: ProxyRuntimeConfig): boolean {
        return JSON.stringify(a) === JSON.stringify(b) // Simple equality check
    }
}
```

### Phase 2: Refactor Proxy Components

**1. Update MitmProxyServer**

```typescript
// packages/proxy/src/proxy/server.ts
export class MitmProxyServer {
    private configStore: ProxyConfigStore
    // ... other properties

    constructor(private opts: ProxyOptions = {}) {
        // Initialize configuration store
        this.configStore = new ProxyConfigStore({
            ignoredHosts: opts.ignoredHosts || [],
            maxBodySize: opts.maxBodySize || 100 * 1024 * 1024,
        })

        this.ca = opts.ca ?? new CertificateAuthority({ store: opts.certStore })
        this.pluginManager = new PluginManager(opts.plugins)

        // Pass config store reference to components
        this.httpHandler = new HttpHandler(
            this.pluginManager,
            this.handleError.bind(this),
            this.configStore // Pass the store, not individual values
        )

        this.tlsManager = new TlsManager(
            this.ca,
            this.pluginManager,
            this.httpHandler,
            this.webSocketHandler,
            this.handleError.bind(this),
            this.configStore // Pass the store
        )

        // ... rest of constructor
    }

    // Clean, single update method
    updateConfiguration(newConfig: Partial<ProxyRuntimeConfig>): void {
        this.configStore.update(newConfig)
    }

    getCurrentConfiguration(): ProxyRuntimeConfig {
        return this.configStore.current
    }
}
```

**2. Update HttpHandler**

```typescript
// packages/proxy/src/proxy/http-handler.ts
export class HttpHandler {
    constructor(
        private pluginManager: PluginManager,
        private onError: (err: unknown, ctx: ErrorContext) => void,
        private configStore: ProxyConfigStore // Store reference instead of individual values
    ) {
        this.requestBodyHandler = new RequestBodyHandler(
            pluginManager,
            configStore
        )
        this.responseBodyHandler = new ResponseBodyHandler(
            pluginManager,
            configStore
        )
        this.upstreamHandler = new UpstreamHandler(onError)
        this.tunnelHandler = new TunnelHandler(onError)
    }

    async handleHttpRequest(
        clientReq: IncomingMessage,
        clientRes: http.ServerResponse,
        isHttps: boolean,
        parentCorrelation?: CorrelationId
    ): Promise<void> {
        // Use current configuration dynamically
        const config = this.configStore.current

        if (isHostIgnored(host, config.ignoredHosts)) {
            return this.tunnelToUpstream(/* ... */)
        }

        // ... rest of method uses config.* as needed
    }
}
```

**3. Update TlsManager**

```typescript
// packages/proxy/src/proxy/tls-manager.ts
export class TlsManager {
    constructor(
        private ca: CertificateAuthority,
        private pluginManager: PluginManager,
        private httpHandler: HttpHandler,
        private webSocketHandler: WebSocketHandler,
        private onError: (err: unknown, ctx: ErrorContext) => void,
        private configStore: ProxyConfigStore // Store reference
    ) {
        this.tunnelHandler = new TunnelHandler(onError)
    }

    async handleConnect(/* ... */): Promise<void> {
        const config = this.configStore.current

        if (isHostIgnored(hostname, config.ignoredHosts)) {
            // Direct tunnel logic
        }
        // ... rest of method
    }
}
```

**4. Update Body Handlers**

```typescript
// packages/proxy/src/proxy/request-body-handler.ts
export class RequestBodyHandler {
    constructor(
        private pluginManager: PluginManager,
        private configStore: ProxyConfigStore
    ) {}

    async handleRequestBody(/* ... */): Promise<void> {
        const config = this.configStore.current
        const maxSize = config.maxBodySize

        // Use maxSize for body processing...
    }
}
```

### Phase 3: Backend Integration

**1. Create Configuration Manager**

```typescript
// apps/backend/src/services/proxy-configuration-manager.ts
import type { ProjectMetadata } from '@arachne/api-types'
import type { ProxyRuntimeConfig } from '@arachne/proxy'

export class ProxyConfigurationManager {
    constructor(
        private baseConfig: {
            ignoredHosts: string[]
            maxBodySize: number
        }
    ) {}

    buildProjectConfiguration(
        projectMetadata?: ProjectMetadata
    ): ProxyRuntimeConfig {
        const settings = projectMetadata?.settings

        return {
            ignoredHosts: [
                ...this.baseConfig.ignoredHosts,
                ...(settings?.ignoredHosts || []),
            ],
            maxBodySize: settings?.maxBodySize || this.baseConfig.maxBodySize,
        }
    }

    hasConfigurationChanged(
        currentConfig: ProxyRuntimeConfig,
        newConfig: ProxyRuntimeConfig
    ): boolean {
        return JSON.stringify(currentConfig) !== JSON.stringify(newConfig)
    }
}
```

**2. Update Backend Index**

```typescript
// apps/backend/src/index.ts
async function main() {
    // ... existing setup ...

    // Configuration Manager
    const configManager = new ProxyConfigurationManager({
        ignoredHosts: ['*.tradovateapi.com'],
        maxBodySize: REC_MAX_BYTES,
    })

    // Create proxy instance but don't start it yet
    const proxy = new MitmProxyServer({
        host: PROXY_HOST,
        port: PROXY_PORT,
        ca,
        plugins: [broadcastPlugin],
        // Initial configuration will be set when proxy starts
    })

    // API routes
    await registerApi(app, {
        prefix: BACKEND_API_PREFIX,
        token: BACKEND_TOKEN,
        ca,
        proxy,
        projectService,
        configManager, // Add config manager
    })

    // Listen for project changes
    projectService.on('project-changed', async (event) => {
        const newConfig = configManager.buildProjectConfiguration(
            event.metadata
        )
        const currentConfig = proxy.getCurrentConfiguration()

        if (configManager.hasConfigurationChanged(currentConfig, newConfig)) {
            proxy.updateConfiguration(newConfig)

            logger.info('Proxy configuration auto-updated for project change', {
                projectId: event.projectId,
                newConfig,
            })

            // Notify frontend via WebSocket
            hub.broadcast({
                type: 'proxy-configuration-updated',
                projectId: event.projectId,
                configuration: newConfig,
            })
        }
    })

    // ... rest of main
}
```

**3. Update API Registration**

```typescript
// apps/backend/src/api.ts
export interface ApiOptions {
    prefix: string
    token?: string
    ca: CertificateAuthority
    proxy: MitmProxyServer
    projectService: ProjectService
    configManager: ProxyConfigurationManager // Add this
}

export async function registerApi(app: FastifyInstance, opts: ApiOptions) {
    const { prefix, token, ca, proxy, projectService, configManager } = opts

    // Update proxy start endpoint
    app.post(
        `${prefix}/proxy/start`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                // Get current project and build configuration
                const currentProject = await projectService.getCurrentProject()
                const projectConfig = configManager.buildProjectConfiguration(
                    currentProject?.metadata
                )

                // Update proxy configuration before starting
                proxy.updateConfiguration(projectConfig)

                const serverInfo = await proxy.start()

                logger.info('Proxy started with project configuration', {
                    projectId: currentProject?.metadata.id,
                    projectName: currentProject?.metadata.name,
                    ignoredHosts: projectConfig.ignoredHosts,
                    maxBodySize: projectConfig.maxBodySize,
                })

                const response: ProxyStartResponse = {
                    ok: true,
                    message: 'Proxy started successfully',
                    serverInfo,
                }
                rep.send(response)
            } catch (error) {
                const response: ProxyErrorResponse = {
                    ok: false,
                    error: 'Failed to start proxy',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    // Add configuration update endpoint
    app.post(
        `${prefix}/proxy/update-config`,
        { preHandler: auth },
        async (_req, rep) => {
            try {
                const currentProject = await projectService.getCurrentProject()
                const newConfig = configManager.buildProjectConfiguration(
                    currentProject?.metadata
                )
                const currentConfig = proxy.getCurrentConfiguration()

                if (
                    configManager.hasConfigurationChanged(
                        currentConfig,
                        newConfig
                    )
                ) {
                    proxy.updateConfiguration(newConfig)

                    logger.info('Proxy configuration updated', {
                        projectId: currentProject?.metadata.id,
                        newConfig,
                    })

                    rep.send({
                        ok: true,
                        message: 'Configuration updated successfully',
                    })
                } else {
                    rep.send({
                        ok: true,
                        message: 'No configuration changes needed',
                    })
                }
            } catch (error) {
                rep.code(500).send({
                    ok: false,
                    error: 'Failed to update configuration',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                })
            }
        }
    )

    // ... rest of API endpoints
}
```

**4. Update Project Service**

```typescript
// apps/backend/src/services/project-service.ts
import { EventEmitter } from 'events'

export class ProjectService extends EventEmitter {
    // ... existing code ...

    async setCurrentProject(projectId: string): Promise<void> {
        // ... existing project switch logic ...

        // Emit event for proxy configuration update
        this.emit('project-changed', {
            projectId,
            metadata: project.metadata,
        })
    }
}
```

## Benefits

### 1. **Scalable Configuration**

Adding new config properties requires:

-   Add property to `ProxyRuntimeConfig` interface
-   Use `config.newProperty` where needed
-   No update methods needed!

### 2. **Type-Safe**

TypeScript ensures all config usage is validated

### 3. **Reactive**

Components automatically see config changes

### 4. **Single Source of Truth**

One config store, no synchronization issues

### 5. **Clean API**

One update method handles all configuration

### 6. **Zero Downtime**

Configuration updates without stopping/starting proxy

## Future Extensibility Examples

**Adding Rate Limiting:**

```typescript
interface ProxyRuntimeConfig {
    ignoredHosts: string[]
    maxBodySize: number
    rateLimit?: { requests: number, windowMs: number }  // Just add this!
}

// In HttpHandler:
async handleHttpRequest(/* ... */) {
    const config = this.configStore.current

    if (config.rateLimit) {
        // Apply rate limiting logic
    }
}
```

**Adding Custom Headers:**

```typescript
interface ProxyRuntimeConfig {
    ignoredHosts: string[]
    maxBodySize: number
    customHeaders?: Record<string, string> // Add this!
}

// Usage is automatic - no update methods needed!
```

## Configuration Mapping

| Project Setting                      | Proxy Option                | Purpose                                   |
| ------------------------------------ | --------------------------- | ----------------------------------------- |
| `ignoredHosts: string[]`             | `ignoredHosts: string[]`    | Skip intercepting specific hosts/patterns |
| `maxBodySize: number`                | `maxBodySize: number`       | Limit body buffering per project needs    |
| (future) `customHeaders: KeyValue[]` | Custom plugin configuration | Add project-specific headers              |
| (future) `rateLimit: number`         | Custom plugin configuration | Throttle requests per project             |

## Implementation Tasks

**Proxy Package Tasks:**

1. Create `ProxyConfigStore` class and `ProxyRuntimeConfig` interface
2. Update `MitmProxyServer` constructor to create and use config store
3. Update `HttpHandler`, `TlsManager` to accept config store reference
4. Update body handlers to use dynamic config

**Backend Tasks:**

1. Create `ProxyConfigurationManager` service
2. Update proxy start endpoint to apply project configuration
3. Add project change listener for automatic updates
4. Update API registration to include config manager

**Frontend Benefits:**

-   No changes needed to existing UI
-   Proxy configuration updates happen transparently
-   WebSocket events notify of configuration changes

## Risk Mitigation

1. **Configuration Validation**: Robust validation prevents proxy startup failures
2. **Graceful Degradation**: Invalid config falls back to defaults with warnings
3. **State Management**: Clear proxy state tracking prevents orphaned instances
4. **Backward Compatibility**: No breaking changes to existing API

This approach provides a clean, maintainable, and infinitely extensible solution for project-based proxy configuration while maintaining the existing architecture's strengths.
