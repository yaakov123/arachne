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

// Auth Profile schemas
export const authValueSourceSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('static'), value: z.string() }),
    z.object({ type: z.literal('environment'), variable: z.string() }),
    z.object({ type: z.literal('prompt'), message: z.string().optional() }),
    z.object({
        type: z.literal('file'),
        path: z.string(),
        encoding: z.enum(['utf8', 'base64']).optional(),
    }),
    z.object({ type: z.literal('computed'), expression: z.string() }),
    z.object({
        type: z.literal('derived'),
        sourceField: z.string(),
        transform: z.string().optional(),
    }),
])

export const headerAuthPlacementSchema = z.object({
    type: z.literal('header'),
    name: z.string(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    encoding: z.enum(['base64', 'url', 'none']).optional(),
})

export const queryAuthPlacementSchema = z.object({
    type: z.literal('query'),
    name: z.string(),
    encoding: z.enum(['url', 'none']).optional(),
})

export const formAuthPlacementSchema = z.object({
    type: z.literal('body-form'),
    name: z.string(),
    encoding: z.enum(['url', 'none']).optional(),
})

export const jsonAuthPlacementSchema = z.object({
    type: z.literal('body-json'),
    path: z.string(),
    merge: z.boolean().optional(),
})

export const rawBodyAuthPlacementSchema = z.object({
    type: z.literal('body-raw'),
    contentType: z.string().optional(),
    encoding: z.enum(['base64', 'none']).optional(),
})

export const pathAuthPlacementSchema = z.object({
    type: z.literal('url-path'),
    template: z.string(),
    placeholder: z.string(),
})

export const cookieAuthPlacementSchema = z.object({
    type: z.literal('cookie'),
    name: z.string(),
    options: z
        .object({
            domain: z.string().optional(),
            path: z.string().optional(),
            secure: z.boolean().optional(),
            httpOnly: z.boolean().optional(),
            sameSite: z.enum(['strict', 'lax', 'none']).optional(),
        })
        .optional(),
})

export const authPlacementConfigSchema = z.discriminatedUnion('type', [
    headerAuthPlacementSchema,
    queryAuthPlacementSchema,
    formAuthPlacementSchema,
    jsonAuthPlacementSchema,
    rawBodyAuthPlacementSchema,
    pathAuthPlacementSchema,
    cookieAuthPlacementSchema,
])

export const authConditionSchema = z.object({
    urlPattern: z.string().optional(),
    hostPattern: z.string().optional(),
    methods: z.array(z.string()).optional(),
    headerConditions: z
        .array(
            z.object({
                name: z.string(),
                exists: z.boolean().optional(),
                value: z.string().optional(),
            })
        )
        .optional(),
    queryConditions: z
        .array(
            z.object({
                name: z.string(),
                exists: z.boolean().optional(),
                value: z.string().optional(),
            })
        )
        .optional(),
})

export const basicAuthConfigSchema = z.object({
    method: z.literal('basic'),
    username: authValueSourceSchema,
    password: authValueSourceSchema,
})

export const bearerAuthConfigSchema = z.object({
    method: z.literal('bearer'),
    token: authValueSourceSchema,
})

export const apiKeyAuthConfigSchema = z.object({
    method: z.literal('api-key'),
    key: authValueSourceSchema,
    placement: authPlacementConfigSchema,
})

export const jwtAuthConfigSchema = z.object({
    method: z.literal('jwt'),
    token: authValueSourceSchema,
    placement: authPlacementConfigSchema,
    validation: z
        .object({
            algorithm: z.string().optional(),
            issuer: z.string().optional(),
            audience: z.string().optional(),
            expirationCheck: z.boolean().optional(),
        })
        .optional(),
})

export const oauth2AuthConfigSchema = z.object({
    method: z.literal('oauth2'),
    tokenType: z.enum(['bearer', 'mac']).optional(),
    accessToken: authValueSourceSchema,
    refreshToken: authValueSourceSchema.optional(),
    placement: authPlacementConfigSchema,
    options: z
        .object({
            scope: z.string().optional(),
            expiresAt: z.number().optional(),
            tokenEndpoint: z.string().optional(),
        })
        .optional(),
})

export const customHeaderAuthConfigSchema = z.object({
    method: z.literal('custom-header'),
    placement: headerAuthPlacementSchema,
    value: authValueSourceSchema,
})

export const customAuthConfigSchema = z.object({
    method: z.literal('custom'),
    placements: z.array(authPlacementConfigSchema),
    values: z.record(z.string(), authValueSourceSchema),
    applyLogic: z.string().optional(),
})

export const authMethodConfigSchema = z.discriminatedUnion('method', [
    basicAuthConfigSchema,
    bearerAuthConfigSchema,
    apiKeyAuthConfigSchema,
    jwtAuthConfigSchema,
    oauth2AuthConfigSchema,
    customHeaderAuthConfigSchema,
    customAuthConfigSchema,
])

export const createAuthProfileSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    method: z.enum([
        'bearer',
        'api-key',
        'basic',
        'digest',
        'oauth1',
        'oauth2',
        'jwt',
        'custom-header',
        'custom',
    ]),
    authConfig: authMethodConfigSchema,
    conditions: authConditionSchema.optional(),
    priority: z.number().min(0).max(1000).optional().default(100),
    enabled: z.boolean().optional().default(true),
    tags: z.array(z.string()).optional(),
    projectId: z.string().min(1, 'Project ID is required'),
})

export const updateAuthProfileSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    method: z
        .enum([
            'bearer',
            'api-key',
            'basic',
            'digest',
            'oauth1',
            'oauth2',
            'jwt',
            'custom-header',
            'custom',
        ])
        .optional(),
    authConfig: authMethodConfigSchema.optional(),
    conditions: authConditionSchema.optional(),
    priority: z.number().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
})

export const authProfileParamsSchema = z.object({
    id: z.string().min(1, 'Auth Profile ID is required'),
})

export const authProfileFiltersSchema = z.object({
    projectId: z.string(),
    method: z.string().optional(),
    enabled: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
})
