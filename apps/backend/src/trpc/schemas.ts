import { z } from 'zod'

// Project schemas
export const projectSettingsSchema = z.object({
    maxTransactions: z.number().min(1).optional(),
    retentionDays: z.number().min(1).optional(),
    hostFilterMode: z.enum(['blacklist', 'whitelist']).optional(),
    hostFilter: z.array(z.string()).optional(),
    maxBodySize: z.number().min(1).optional(),
})

export const createProjectSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    settings: projectSettingsSchema.optional().default({}),
})

export const updateProjectSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    settings: projectSettingsSchema.optional(),
})

export const projectParamsSchema = z.object({
    id: z.string().min(1, 'Project ID is required'),
})

// Transaction schemas
export const transactionFiltersSchema = z.object({
    method: z.string().optional(),
    host: z.string().optional(),
    statusCode: z.number().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
})

// Proxy schemas
export const proxyControlSchema = z.object({
    action: z.enum(['start', 'stop']),
})

// Certificate Authority schemas
export const caActionSchema = z.object({
    action: z.enum(['create', 'trust', 'untrust', 'status']),
})

// Repeater schemas
export const repeatRequestSchema = z.object({
    originalTransactionId: z.string().min(1),
    transaction: z.object({
        method: z.string(),
        url: z.string().url(),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.string().optional(),
    }),
})

// Common response schemas
export const errorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
})

export const successResponseSchema = z.object({
    message: z.string(),
})

export const paginationSchema = z.object({
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
})
