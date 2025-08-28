import { TransactionRepository } from '../repositories/index'
import type { Transaction, TransactionCreateInput } from '../types'

export class TransactionService {
    constructor(
        private readonly transactionRepository: TransactionRepository = new TransactionRepository()
    ) {}

    async addTransactionToProject(transaction: TransactionCreateInput) {
        return this.transactionRepository.create(transaction)
    }

    async getTransactions(projectId: string): Promise<Transaction[]> {
        return this.transactionRepository.findByProject(projectId)
    }

    async transactionCount(projectId: string) {
        return this.transactionRepository.countByProject(projectId)
    }

    async getTransaction(id: string) {
        return this.transactionRepository.findById(id)
    }
}
