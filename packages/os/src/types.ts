export interface ProcessInfo {
    pid: number
    name: string
    path?: string
    user?: string
}

export interface TrustResult {
    ok: boolean
    message: string
    code?: number | null
}

export type Platform = 'darwin' | 'win32' | 'linux'

export interface OSProvider {
    // System proxy management
    enableSystemProxy(host: string, port: number): Promise<void>
    disableSystemProxy(): Promise<void>
    

    getTrustInstructions(certPath: string): Promise<{
        trustCommand: string
        untrustCommands: string[]
    }>
    
    // Network process tracking (future functionality)
    getProcessForConnection(localPort: number, remoteHost: string, remotePort: number): Promise<ProcessInfo | null>
    
    // Platform info
    isSupported(): boolean
    getPlatform(): Platform
}
