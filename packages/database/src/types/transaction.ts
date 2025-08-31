import type {
    Prisma,
    Transaction,
    TransactionBody,
    TransactionHeader,
} from '@prisma/client'

export type { Transaction, TransactionBody, TransactionHeader }

export type TransactionCreateInput = Prisma.TransactionCreateInput
export type TransactionUpdateInput = Prisma.TransactionUpdateInput
export type TransactionFindManyArgs = Prisma.TransactionFindManyArgs

export interface FullTransaction extends Transaction {
    requestHeaders: TransactionHeader[]
    responseHeaders: TransactionHeader[]
    requestBody: TransactionBody | null
    responseBody: TransactionBody | null
}

// Service layer types
export interface DatabaseServiceOptions {
    databaseUrl?: string
    logLevel?: 'info' | 'warn' | 'error'
}
