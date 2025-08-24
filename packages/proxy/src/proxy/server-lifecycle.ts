import http from 'node:http'
import { OSProviderFactory } from '@arachne/os'

export interface ServerInfo {
    host: string
    port: number
}

export class ServerLifecycleManager {
    private osProvider = OSProviderFactory.create()
    
    constructor(
        private httpServer: http.Server,
        private _onError: (err: unknown, ctx: any) => void
    ) {}

    async start(host: string = '127.0.0.1', port: number = 8899): Promise<ServerInfo> {
        await new Promise<void>((resolve) =>
            this.httpServer.listen(port, host, resolve)
        )
        
        if (this.osProvider.isSupported()) {
            try {
                console.log('[Arachne:Proxy] Enabling system proxy...')
                await this.osProvider.enableSystemProxy(host, port)
                console.log('[Arachne:Proxy] Enabled system proxy')
            } catch {
                console.warn('Failed to enable system proxy')
            }
        }
        
        return { host, port }
    }

    async stop(): Promise<void> {
        console.log('[Arachne:Proxy] Stopping proxy server...')
        
        // Proactively close sockets to avoid hanging on close() due to keep-alive or long-lived tunnels
        const srv = this.httpServer as unknown as {
            closeIdleConnections?: () => void
            closeAllConnections?: () => void
        }
        
        try {
            srv.closeIdleConnections?.()
        } catch {}
        
        try {
            srv.closeAllConnections?.()
        } catch {}
        
        if (this.osProvider.isSupported()) {
            try {
                console.log('[Arachne:Proxy] Disabling system proxy...')
                await this.osProvider.disableSystemProxy()
                console.log('[Arachne:Proxy] Disabled system proxy')
            } catch {
                console.warn('Failed to disable system proxy')
            }
        }
        await new Promise<void>((resolve, reject) =>
            this.httpServer.close((err) => (err ? reject(err) : resolve()))
        )
        
        console.log('[Arachne:Proxy] Stopped proxy server')
        
    }
}
