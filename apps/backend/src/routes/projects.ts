import type { FastifyInstance } from 'fastify'
import type { ProjectErrorResponse } from '@arachne/api-types'
import type { RouteOptions } from './types'
import { ProjectCreateInput, ProjectUpdateInput } from '@arachne/database'

export function registerProjectRoutes(
    app: FastifyInstance,
    opts: Pick<RouteOptions, 'prefix' | 'projectService' | 'transactionService'>
) {
    const { prefix, projectService, transactionService } = opts

    // List all projects
    app.get(`${prefix}/projects`, async (_req, rep) => {
        try {
            const projects = await projectService.listProjects()
            rep.send(projects)
        } catch (error) {
            const response: ProjectErrorResponse = {
                error: 'Failed to list projects',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(500).send(response)
        }
    })

    // Create new project
    app.post<{
        Body: ProjectCreateInput
    }>(`${prefix}/projects`, async (req, rep) => {
        try {
            const project = await projectService.createProject(req.body)

            rep.code(201).send(project)
        } catch (error) {
            const response: ProjectErrorResponse = {
                error: 'Failed to create project',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(400).send(response)
        }
    })

    // Get specific project
    app.get<{
        Params: { id: string }
    }>(
        `${prefix}/projects/:id`,

        async (req, rep) => {
            const { id } = req.params
            const project = await projectService.getProject(id)
            if (!project) {
                rep.code(404).send({
                    error: `Project ${id} was not found`,
                })
            }

            rep.send(project)
        }
    )

    // Update project
    app.put<{
        Params: { id: string }
        Body: ProjectUpdateInput
    }>(
        `${prefix}/projects/:id`,

        async (req, rep) => {
            const { id } = req.params
            const project = await projectService.updateProject(id, req.body)
            rep.send(project)
        }
    )

    // Delete project
    app.delete<{
        Params: { id: string }
    }>(`${prefix}/projects/:id`, async (req, rep) => {
        const { id } = req.params
        await projectService.deleteProject(id)
        rep.code(204).send()
    })

    // Get project transactions
    app.get<{
        Params: { id: string }
    }>(
        `${prefix}/projects/:id/transactions`,

        async (req, rep) => {
            const { id } = req.params
            const transactions = await transactionService.getTransactions(id)
            rep.send(transactions)
        }
    )

    // Set current project (for active recording)
    app.post<{
        Params: { id: string }
    }>(`${prefix}/projects/:id/activate`, async (req, rep) => {
        try {
            const { id } = req.params

            const project = await projectService.getProject(id)
            // Verify project exists
            if (!project) {
                rep.code(404).send({
                    error: `Project ${id} was not found`,
                })
                return
            }

            await projectService.saveActiveProject(id === 'none' ? null : id)
            rep.code(204).send()
        } catch (error) {
            const response: ProjectErrorResponse = {
                error: 'Failed to activate project',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(500).send(response)
        }
    })

    // Get current active project
    app.get(
        `${prefix}/projects/current`,

        async (_req, rep) => {
            const currentProject = await projectService.getCurrentProject()
            rep.send(currentProject)
        }
    )
}
