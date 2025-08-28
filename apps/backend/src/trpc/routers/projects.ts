import { TRPCError } from '@trpc/server'
import { router, publicProcedure, schemas, z } from '../init'
import {
    createProjectSchema,
    updateProjectSchema,
    projectParamsSchema,
} from '../schemas'

export const projectsRouter = router({
    // List all projects
    list: publicProcedure.input(schemas.pagination).query(async ({ ctx }) => {
        try {
            const projects = await ctx.projectService.listProjects()
            return { projects }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to list projects',
                cause: error,
            })
        }
    }),

    // Get project by ID
    getById: publicProcedure
        .input(projectParamsSchema)
        .query(async ({ ctx, input }) => {
            try {
                const project = await ctx.projectService.getProject(input.id)
                if (!project) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Project ${input.id} was not found`,
                    })
                }
                return { project }
            } catch (error) {
                if (error instanceof TRPCError) throw error
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get project',
                    cause: error,
                })
            }
        }),

    // Create new project
    create: publicProcedure
        .input(createProjectSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                const project = await ctx.projectService.createProject(input)
                return project
            } catch (error) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to create project',
                    cause: error,
                })
            }
        }),

    // Update project
    update: publicProcedure
        .input(
            z.object({
                id: schemas.id,
                data: updateProjectSchema,
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const project = await ctx.projectService.updateProject(
                    input.id,
                    input.data
                )
                return { project, message: 'Project updated successfully' }
            } catch (error) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to update project',
                    cause: error,
                })
            }
        }),

    // Delete project
    delete: publicProcedure
        .input(projectParamsSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                await ctx.projectService.deleteProject(input.id)
                return { message: 'Project deleted successfully' }
            } catch (error) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to delete project',
                    cause: error,
                })
            }
        }),

    // Get project transactions
    getTransactions: publicProcedure
        .input(
            z.object({
                id: schemas.id,
                pagination: schemas.pagination,
            })
        )
        .query(async ({ ctx, input }) => {
            try {
                const transactions =
                    await ctx.transactionService.getTransactions(input.id)
                return { transactions, total: transactions.length }
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to get project transactions',
                    cause: error,
                })
            }
        }),

    // Get current active project
    getCurrent: publicProcedure.query(async ({ ctx }) => {
        try {
            const currentProject = await ctx.projectService.getCurrentProject()
            return { currentProject }
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get current project',
                cause: error,
            })
        }
    }),

    // Activate project
    activate: publicProcedure
        .input(projectParamsSchema)
        .mutation(async ({ ctx, input }) => {
            try {
                // Verify project exists
                const project = await ctx.projectService.getProject(input.id)
                if (!project) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Project ${input.id} was not found`,
                    })
                }

                await ctx.projectService.saveActiveProject(
                    input.id === 'none' ? null : input.id
                )
                return { message: 'Project activated successfully' }
            } catch (error) {
                if (error instanceof TRPCError) throw error
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to activate project',
                    cause: error,
                })
            }
        }),
})
