import type { FastifyInstance } from 'fastify'
import type {
    ProjectListResponse,
    ProjectResponse,
    ProjectCreateResponse,
    ProjectErrorResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '@arachne/api-types'
import type { RouteOptions } from './types'

export function registerProjectRoutes(
    app: FastifyInstance,
    opts: Pick<RouteOptions, 'prefix' | 'projectService'>
) {
    const { prefix, projectService } = opts

    // List all projects
    app.get(`${prefix}/projects`, async (_req, rep) => {
        try {
            const projects = await projectService.listProjects()
            const response: ProjectListResponse = {
                ok: true,
                projects,
            }
            rep.send(response)
        } catch (error) {
            const response: ProjectErrorResponse = {
                ok: false,
                error: 'Failed to list projects',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(500).send(response)
        }
    })

    // Create new project
    app.post(`${prefix}/projects`, async (req, rep) => {
        try {
            const createRequest = req.body as CreateProjectRequest
            const project = await projectService.createProject(createRequest)
            const response: ProjectCreateResponse = {
                ok: true,
                project,
                message: 'Project created successfully',
            }
            rep.code(201).send(response)
        } catch (error) {
            const response: ProjectErrorResponse = {
                ok: false,
                error: 'Failed to create project',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            }
            rep.code(400).send(response)
        }
    })

    // Get specific project
    app.get(
        `${prefix}/projects/:id`,

        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }
                const project = await projectService.getProject(id)
                const response: ProjectResponse = {
                    ok: true,
                    project,
                }
                rep.send(response)
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to get project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 500
                rep.code(statusCode).send(response)
            }
        }
    )

    // Update project
    app.put(
        `${prefix}/projects/:id`,

        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }
                const updateRequest = req.body as UpdateProjectRequest
                const project = await projectService.updateProject(
                    id,
                    updateRequest
                )
                const response: ProjectResponse = {
                    ok: true,
                    project,
                }
                rep.send(response)
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to update project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 400
                rep.code(statusCode).send(response)
            }
        }
    )

    // Delete project
    app.delete(
        `${prefix}/projects/:id`,

        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }
                await projectService.deleteProject(id)
                rep.code(204).send()
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to delete project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 500
                rep.code(statusCode).send(response)
            }
        }
    )

    // Get project transactions
    app.get(
        `${prefix}/projects/:id/transactions`,

        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }

                const transactions = await projectService.getTransactions(id)
                rep.send({
                    ok: true,
                    transactions,
                    total: transactions.length,
                })
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to get project transactions',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                const statusCode =
                    error instanceof Error &&
                    error.message.includes('not found')
                        ? 404
                        : 500
                rep.code(statusCode).send(response)
            }
        }
    )

    // Set current project (for active recording)
    app.post(
        `${prefix}/projects/:id/activate`,

        async (req, rep) => {
            try {
                const { id } = req.params as { id: string }

                // Verify project exists
                if (
                    id !== 'none' &&
                    !(await projectService.projectExists(id))
                ) {
                    const response: ProjectErrorResponse = {
                        ok: false,
                        error: 'Project not found',
                        message: `Project ${id} does not exist`,
                    }
                    rep.code(404).send(response)
                    return
                }

                projectService.setCurrentProject(id === 'none' ? null : id)
                rep.send({
                    ok: true,
                    message:
                        id === 'none'
                            ? 'No project is now active'
                            : `Project ${id} is now active`,
                    currentProject: projectService.getCurrentProject(),
                })
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to activate project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )

    // Get current active project
    app.get(
        `${prefix}/projects/current`,

        async (_req, rep) => {
            try {
                const currentProject = await projectService.getCurrentProject()
                if (!currentProject) {
                    rep.send({
                        ok: true,
                        currentProject: null,
                        message: 'No project is currently active',
                    })
                    return
                }

                rep.send({
                    ok: true,
                    currentProject: currentProject.metadata.id,
                    project: currentProject,
                })
            } catch (error) {
                const response: ProjectErrorResponse = {
                    ok: false,
                    error: 'Failed to get current project',
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                }
                rep.code(500).send(response)
            }
        }
    )
}
