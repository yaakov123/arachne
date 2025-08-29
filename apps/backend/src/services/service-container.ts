import { ProjectService } from './project-service'
import { TransactionService } from './transaction-service'
import { BroadcastService } from './broadcast-service'
import { StorageService } from './storage-service'
import { BroadcastEmitter } from './broadcast-emitter'
import { createTransactionAggregatorPlugin } from '../plugins/transaction-aggregator-plugin'
import { AppConfig } from '../types'
import { logger } from '../logger'

/**
 * Service container that manages all application services and their dependencies.
 * This eliminates the need to pass callbacks and service instances around manually.
 */
export class ServiceContainer {
    private _broadcastEmitter!: BroadcastEmitter
    private _projectService!: ProjectService
    private _transactionService!: TransactionService
    private _broadcastService!: BroadcastService
    private _storageService!: StorageService
    private _transactionAggregatorPlugin!: any

    /**
     * Initialize all services in the correct order
     */
    async initialize(config: AppConfig): Promise<void> {
        logger.info('Initializing services')
        // Core services first (no dependencies)
        this._broadcastEmitter = new BroadcastEmitter()
        this._projectService = new ProjectService()
        this._transactionService = new TransactionService()

        // Initialize project service and get current project
        await this._projectService.initialize()

        // Services that depend on the core services
        this._broadcastService = new BroadcastService()
        this._storageService = new StorageService(this._transactionService)

        this._broadcastEmitter.on('transactionComplete', async (event) => {
            const projectId = this._projectService.getCurrentProjectId()
            if (!projectId) {
                console.warn(
                    'No active project set, skipping transaction storage for:',
                    event.id
                )
                return
            }
            const result = await this._storageService.handleTransactionComplete(
                projectId,
                event
            )
            this._broadcastService.handleTransactionComplete(event)
            return result
        })

        // Plugin that emits events
        this._transactionAggregatorPlugin = createTransactionAggregatorPlugin(
            this._broadcastEmitter,
            config.recording.maxBytes
        )
    }

    /**
     * Clean up all services
     */
    cleanup(): void {
        this._projectService?.cleanup()
        this._broadcastEmitter.removeAllListeners()
    }

    // Getters for accessing services
    get broadcastEmitter(): BroadcastEmitter {
        return this._broadcastEmitter
    }

    get projectService(): ProjectService {
        return this._projectService
    }

    get transactionService(): TransactionService {
        return this._transactionService
    }

    get broadcastService(): BroadcastService {
        return this._broadcastService
    }

    get storageService(): StorageService {
        return this._storageService
    }

    get transactionAggregatorPlugin(): any {
        return this._transactionAggregatorPlugin
    }
}
