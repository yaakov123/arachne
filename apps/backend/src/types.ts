export interface AppConfig {
    backend: {
        host: string
        port: number
        apiPrefix: string
        cors: string
        token?: string
    }
    proxy: {
        host: string
        port: number
        caBaseDir?: string
    }
    recording: {
        outDir?: string
        maxBytes: number
    }
    projects: {
        baseDir: string
    }
}
