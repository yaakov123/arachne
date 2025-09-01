import { z } from 'zod'
import { router, publicProcedure } from '../init'
import { ApiInventoryService } from '../../services/api-inventory-service'

// Input schemas
const generateApiInventoryInput = z.object({
    projectId: z.string().optional(), // If not provided, uses current project
    config: z
        .object({
            minCallsThreshold: z.number().min(1).optional(),
            includeSensitiveData: z.boolean().optional(),
            maxExamples: z.number().min(1).max(100).optional(),
            pathSimilarityThreshold: z.number().min(0).max(1).optional(),
            autoDetectAuth: z.boolean().optional(),
            generateOpenApi: z.boolean().optional(),
        })
        .optional(),
})

const getApiEndpointsInput = z.object({
    projectId: z.string().optional(),
    hostFilter: z.string().optional(),
    methodFilter: z.string().optional(),
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
})

const getApiServicesInput = z.object({
    projectId: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
})

export const apiInventoryRouter = router({
    /**
     * Generate complete API inventory for a project
     */
    generateInventory: publicProcedure
        .input(generateApiInventoryInput)
        .mutation(async ({ input, ctx }) => {
            // Use provided project ID or current project
            const projectId =
                input.projectId || ctx.projectService.getCurrentProjectId()

            if (!projectId) {
                throw new Error(
                    'No project specified and no current project set'
                )
            }

            // Create service with custom config if provided
            const apiInventoryService = new ApiInventoryService(
                input.config || {}
            )

            // Generate the inventory
            const inventory = await apiInventoryService.generateApiInventory(
                projectId
            )

            return inventory
        }),

    /**
     * Get API endpoints for a project with filtering and pagination
     */
    getEndpoints: publicProcedure
        .input(getApiEndpointsInput)
        .query(async ({ input, ctx }) => {
            const projectId =
                input.projectId || ctx.projectService.getCurrentProjectId()

            if (!projectId) {
                throw new Error(
                    'No project specified and no current project set'
                )
            }

            const apiInventoryService = new ApiInventoryService()

            // Generate inventory and extract endpoints
            const inventory = await apiInventoryService.generateApiInventory(
                projectId
            )

            let endpoints = inventory.services.flatMap(
                (service) => service.endpoints
            )

            // Apply filters
            if (input.hostFilter) {
                endpoints = endpoints.filter((endpoint) =>
                    endpoint.host
                        .toLowerCase()
                        .includes(input.hostFilter!.toLowerCase())
                )
            }

            if (input.methodFilter) {
                endpoints = endpoints.filter(
                    (endpoint) =>
                        endpoint.method.toLowerCase() ===
                        input.methodFilter!.toLowerCase()
                )
            }

            // Apply pagination
            const total = endpoints.length
            const paginatedEndpoints = endpoints.slice(
                input.offset,
                input.offset + input.limit
            )

            return {
                endpoints: paginatedEndpoints,
                pagination: {
                    total,
                    offset: input.offset,
                    limit: input.limit,
                    hasMore: input.offset + input.limit < total,
                },
            }
        }),

    /**
     * Get API services for a project with pagination
     */
    getServices: publicProcedure
        .input(getApiServicesInput)
        .query(async ({ input, ctx }) => {
            const projectId =
                input.projectId || ctx.projectService.getCurrentProjectId()

            if (!projectId) {
                throw new Error(
                    'No project specified and no current project set'
                )
            }

            const apiInventoryService = new ApiInventoryService()

            // Generate inventory and extract services
            const inventory = await apiInventoryService.generateApiInventory(
                projectId
            )

            // Apply pagination
            const total = inventory.services.length
            const paginatedServices = inventory.services.slice(
                input.offset,
                input.offset + input.limit
            )

            return {
                services: paginatedServices,
                pagination: {
                    total,
                    offset: input.offset,
                    limit: input.limit,
                    hasMore: input.offset + input.limit < total,
                },
            }
        }),

    /**
     * Get global statistics for a project's API inventory
     */
    getStats: publicProcedure
        .input(
            z.object({
                projectId: z.string().optional(),
            })
        )
        .query(async ({ input, ctx }) => {
            const projectId =
                input.projectId || ctx.projectService.getCurrentProjectId()

            if (!projectId) {
                throw new Error(
                    'No project specified and no current project set'
                )
            }

            const apiInventoryService = new ApiInventoryService()

            // Generate inventory and return just the stats
            const inventory = await apiInventoryService.generateApiInventory(
                projectId
            )

            return {
                globalStats: inventory.globalStats,
                generatedAt: inventory.generatedAt,
                config: inventory.config,
            }
        }),

    /**
     * Get detailed information about a specific API endpoint
     */
    getEndpointDetails: publicProcedure
        .input(
            z.object({
                projectId: z.string().optional(),
                endpointId: z.string(),
            })
        )
        .query(async ({ input, ctx }) => {
            const projectId =
                input.projectId || ctx.projectService.getCurrentProjectId()

            if (!projectId) {
                throw new Error(
                    'No project specified and no current project set'
                )
            }

            const apiInventoryService = new ApiInventoryService()

            // Generate inventory and find specific endpoint
            const inventory = await apiInventoryService.generateApiInventory(
                projectId
            )

            const endpoint = inventory.services
                .flatMap((service) => service.endpoints)
                .find((endpoint) => endpoint.id === input.endpointId)

            if (!endpoint) {
                throw new Error(
                    `Endpoint with ID ${input.endpointId} not found`
                )
            }

            return endpoint
        }),

    /**
     * Export API inventory in different formats
     */
    exportInventory: publicProcedure
        .input(
            z.object({
                projectId: z.string().optional(),
                format: z.enum(['json', 'openapi']).default('json'),
                serviceId: z.string().optional(), // Export specific service only
            })
        )
        .query(async ({ input, ctx }) => {
            const projectId =
                input.projectId || ctx.projectService.getCurrentProjectId()

            if (!projectId) {
                throw new Error(
                    'No project specified and no current project set'
                )
            }

            const apiInventoryService = new ApiInventoryService({
                generateOpenApi: input.format === 'openapi',
            })

            const inventory = await apiInventoryService.generateApiInventory(
                projectId
            )

            if (input.format === 'json') {
                // Filter by service if specified
                if (input.serviceId) {
                    const service = inventory.services.find(
                        (s) => s.id === input.serviceId
                    )
                    if (!service) {
                        throw new Error(
                            `Service with ID ${input.serviceId} not found`
                        )
                    }
                    return {
                        ...inventory,
                        services: [service],
                    }
                }
                return inventory
            }

            // TODO: Implement OpenAPI export
            if (input.format === 'openapi') {
                throw new Error('OpenAPI export not yet implemented')
            }

            return inventory
        }),
})
