import { SystemConfigRepository } from '../repositories/index'
import { SystemConfigUpdateInput } from '../types'

export class SystemConfigService {
    constructor(
        private readonly systemConfigRepository: SystemConfigRepository = new SystemConfigRepository()
    ) {}

    async getSystemConfig() {
        return this.systemConfigRepository.getConfig()
    }

    async updateSystemConfig(systemConfig: SystemConfigUpdateInput) {
        return this.systemConfigRepository.updateConfig(systemConfig)
    }
}
