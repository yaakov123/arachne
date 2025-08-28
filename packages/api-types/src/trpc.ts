// tRPC client configuration types
export interface TRPCClientConfig {
    url: string
    headers?: Record<string, string>
}

// Common tRPC error structure
export interface TRPCErrorResponse {
    code: string
    message: string
    data?: {
        code: string
        httpStatus: number
        path: string
        stack?: string
    }
}
