import { ProjectRepository } from '../repositories/index'
import { ProjectCreateInput, ProjectUpdateInput } from '../types'

export class ProjectService {
    constructor(
        private readonly projectRepository: ProjectRepository = new ProjectRepository()
    ) {}

    async createProject(project: ProjectCreateInput) {
        return this.projectRepository.create(project)
    }

    async getProject(id: string) {
        return this.projectRepository.findById(id)
    }

    async updateProject(id: string, project: ProjectUpdateInput) {
        return this.projectRepository.update(id, project)
    }

    async deleteProject(id: string) {
        return this.projectRepository.delete(id)
    }

    async listProjects() {
        return this.projectRepository.findMany()
    }

    async projectExists(id: string) {
        return this.projectRepository.exists(id)
    }
}
