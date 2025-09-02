import { ProjectService } from './project.service'
import { TransactionService } from './transaction.service'
import { BroadcastService } from './broadcast.service'
import { StorageService } from './storage.service'
import { AuthProfileService } from './auth-profile.service'
import { logger } from '../logger'

/**
 * Service container that manages all application services and their dependencies.
 * This eliminates the need to pass callbacks and service instances around manually.
 */
export class ServiceContainer {
    private _projectService: ProjectService
    private _transactionService: TransactionService
    private _broadcastService: BroadcastService
    private _storageService: StorageService
    private _authProfileService: AuthProfileService

    constructor() {
        this._projectService = new ProjectService()
        this._transactionService = new TransactionService()
        this._broadcastService = new BroadcastService()
        this._storageService = new StorageService(this._transactionService)
        this._authProfileService = new AuthProfileService()
    }

    /**
     * Initialize all services in the correct order
     */
    async initialize(): Promise<void> {
        logger.info('Initializing services')

        // Initialize project service and get current project
        await this._projectService.initialize()

        // Services that depend on the core services
        this._broadcastService = new BroadcastService()
        this._storageService = new StorageService(this._transactionService)
    }

    /**
     * Clean up all services
     */
    cleanup(): void {
        this._projectService?.cleanup()
    }

    // Getters for accessing services

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

    get authProfileService(): AuthProfileService {
        return this._authProfileService
    }
}
