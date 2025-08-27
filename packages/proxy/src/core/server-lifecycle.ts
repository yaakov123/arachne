import http from 'node:http'
import { OSProviderFactory } from '@arachne/os'
import { logger } from '../logger'
import { DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT } from './constants'

export interface ServerInfo {
    host: string
    port: number
}

export class ServerLifecycleManager {
    private osProvider = OSProviderFactory.create()
    
    constructor(
        private httpServer: http.Server,
    ) {}

    async start(host: string = DEFAULT_PROXY_HOST, port: number = DEFAULT_PROXY_PORT): Promise<ServerInfo> {
        await new Promise<void>((resolve) =>
            this.httpServer.listen(port, host, resolve)
        )
        
        logger.logProxyStart(host, port)
        
        if (this.osProvider.isSupported()) {
            try {
                logger.debug('Enabling system proxy...', { component: 'server-lifecycle', hostname: host, port })
                await this.osProvider.enableSystemProxy(host, port)
                logger.logSystemProxyEnabled(host, port)
            } catch (error) {
                logger.warn('Failed to enable system proxy', { 
                    component: 'server-lifecycle', 
                    hostname: host, 
                    port,
                    error: error instanceof Error ? error.message : String(error)
                })
            }
        }
        
        return { host, port }
    }

    async stop(): Promise<void> {
        logger.debug('Stopping proxy server...', { component: 'server-lifecycle' })
        
        // Proactively close sockets to avoid hanging on close() due to keep-alive or long-lived tunnels
        const srv = this.httpServer as unknown as {
            closeIdleConnections?: () => void
            closeAllConnections?: () => void
        }
        
        try {
            srv.closeIdleConnections?.()
        } catch (error) {
            logger.debug('Error closing idle connections', { 
                component: 'server-lifecycle',
                error: error instanceof Error ? error.message : String(error)
            })
        }
        
        try {
            srv.closeAllConnections?.()
        } catch (error) {
            logger.debug('Error closing all connections', { 
                component: 'server-lifecycle',
                error: error instanceof Error ? error.message : String(error)
            })
        }
        
        if (this.osProvider.isSupported()) {
            try {
                logger.debug('Disabling system proxy...', { component: 'server-lifecycle' })
                await this.osProvider.disableSystemProxy()
                logger.logSystemProxyDisabled()
            } catch (error) {
                logger.warn('Failed to disable system proxy', { 
                    component: 'server-lifecycle',
                    error: error instanceof Error ? error.message : String(error)
                })
            }
        }
        new Promise<void>((resolve, reject) =>
            this.httpServer.close((err) => (err ? reject(err) : resolve()))
        ).then(() => {
            logger.logProxyStop()
        })
    }
}
