import { TRPCError } from '@trpc/server'
import { router, publicProcedure, schemas, z } from '../init'
import {
    createAuthProfileSchema,
    updateAuthProfileSchema,
    authProfileParamsSchema,
    authProfileFiltersSchema,
} from '../schemas'

export const authProfilesRouter = router({
    // List auth profiles with filtering
    list: publicProcedure
        .input(authProfileFiltersSchema)
        .query(async ({ ctx, input }) => {
            try {
                const result = await ctx.authProfileService.listAuthProfiles(
                    input
                )
                return result
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to list auth profiles',
                    cause: error,
                })
            }
        }),

    // Get auth profile by ID
    getById: publicProcedure
        .input(authProfileParamsSchema)
        .query(async ({ ctx, input }) => {
            try {
                const profile = await ctx.authProfileService.getAuthProfile(
                    input.id
                )
                if (!profile) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Auth profile ${input.id} was not found`,
                    })
                }
                return { profile }
            } catch (error) {
                if (error instanceof TRPCError) throw error
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get auth profile',
                    cause: error,
                })
            }
        }),

    // Get auth profiles by project
    getByProject: publicProcedure
        .input(
            z.object({
                projectId: z.string().min(1, 'Project ID is required'),
                enabled: z.boolean().optional(),
                method: z.string().optional(),
                limit: z.number().min(1).max(100).optional(),
                offset: z.number().min(0).optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            try {
                const profiles =
                    await ctx.authProfileService.getAuthProfilesByProject(
                        input.projectId,
                        {
                            enabled: input.enabled,
                            method: input.method,
                            limit: input.limit,
                            offset: input.offset,
                        }
                    )
                return { profiles }
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get auth profiles for project',
                    cause: error,
                })
            }
        }),

    // Create new auth profile
    create: publicProcedure
        .input(createAuthProfileSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                // Validate the auth profile configuration
                const validation =
                    ctx.authProfileService.validateAuthProfile(input)
                if (!validation.valid) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: `Validation failed: ${validation.errors.join(
                            ', '
                        )}`,
                    })
                }

                // Transform input to match repository expectations
                const createData = {
                    name: input.name,
                    description: input.description,
                    method: input.method,
                    authConfig: input.authConfig as any,
                    conditions: input.conditions as any,
                    priority: input.priority,
                    enabled: input.enabled,
                    tags: input.tags as any,
                    project: {
                        connect: { id: input.projectId },
                    },
                }

                const profile = await ctx.authProfileService.createAuthProfile(
                    createData
                )
                return { profile, message: 'Auth profile created successfully' }
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes('already exists')
                ) {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: error.message,
                    })
                }
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to create auth profile',
                    cause: error,
                })
            }
        }),

    // Update auth profile
    update: publicProcedure
        .input(
            z.object({
                id: schemas.id,
                data: updateAuthProfileSchema,
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                // Validate the auth profile configuration if provided
                if (input.data.authConfig || input.data.method) {
                    const validation =
                        ctx.authProfileService.validateAuthProfile({
                            ...input.data,
                            // Include existing data for validation context if needed
                        })
                    if (!validation.valid) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: `Validation failed: ${validation.errors.join(
                                ', '
                            )}`,
                        })
                    }
                }

                // Transform data to handle JSON fields
                const updateData = {
                    ...input.data,
                    authConfig: input.data.authConfig as any,
                    conditions: input.data.conditions as any,
                    tags: input.data.tags as any,
                }

                const profile = await ctx.authProfileService.updateAuthProfile(
                    input.id,
                    updateData
                )
                return { profile, message: 'Auth profile updated successfully' }
            } catch (error) {
                if (error instanceof Error) {
                    if (error.message.includes('not found')) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: error.message,
                        })
                    }
                    if (error.message.includes('already exists')) {
                        throw new TRPCError({
                            code: 'CONFLICT',
                            message: error.message,
                        })
                    }
                }
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to update auth profile',
                    cause: error,
                })
            }
        }),

    // Delete auth profile
    delete: publicProcedure
        .input(authProfileParamsSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.authProfileService.deleteAuthProfile(input.id)
                return { message: 'Auth profile deleted successfully' }
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes('not found')
                ) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: error.message,
                    })
                }
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to delete auth profile',
                    cause: error,
                })
            }
        }),

    // Toggle auth profile enabled status
    toggle: publicProcedure
        .input(authProfileParamsSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                const profile = await ctx.authProfileService.toggleAuthProfile(
                    input.id
                )
                return {
                    profile,
                    message: `Auth profile ${
                        profile.enabled ? 'enabled' : 'disabled'
                    } successfully`,
                }
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes('not found')
                ) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: error.message,
                    })
                }
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to toggle auth profile',
                    cause: error,
                })
            }
        }),

    // Duplicate auth profile
    duplicate: publicProcedure
        .input(
            z.object({
                id: z.string().min(1, 'Auth Profile ID is required'),
                newName: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const profile =
                    await ctx.authProfileService.duplicateAuthProfile(
                        input.id,
                        input.newName
                    )
                return {
                    profile,
                    message: 'Auth profile duplicated successfully',
                }
            } catch (error) {
                if (error instanceof Error) {
                    if (error.message.includes('not found')) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: error.message,
                        })
                    }
                    if (error.message.includes('already exists')) {
                        throw new TRPCError({
                            code: 'CONFLICT',
                            message: error.message,
                        })
                    }
                }
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to duplicate auth profile',
                    cause: error,
                })
            }
        }),

    // Get auth profiles count for a project
    getCount: publicProcedure
        .input(
            z.object({
                projectId: z.string().min(1, 'Project ID is required'),
            })
        )
        .query(async ({ ctx, input }) => {
            try {
                const count = await ctx.authProfileService.getAuthProfilesCount(
                    input.projectId
                )
                return { count }
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get auth profiles count',
                    cause: error,
                })
            }
        }),

    // Validate auth profile configuration
    validate: publicProcedure
        .input(createAuthProfileSchema.omit({ projectId: true }))
        .mutation(async ({ ctx, input }) => {
            try {
                const validation =
                    ctx.authProfileService.validateAuthProfile(input)
                return validation
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to validate auth profile',
                    cause: error,
                })
            }
        }),
})
