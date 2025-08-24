import { CertStore, CertStoreOptions } from './certs/store'

export { MitmProxyServer, type ProxyOptions } from './proxy/server'
export { CertificateAuthority, type CAOptions } from './certs/ca'
export * from './plugins/types'
export { CertStore, type CertStoreOptions } from './certs/store'
export { logger, ProxyLogger, type LogContext, type LogLevel } from './logger'

// WebSocket exports
export { WebSocketHandler } from './websocket/handler.js'
export * from './websocket/types.js'
export * from './websocket/utils.js'

export function getDefaultCertStoreOptions(): CertStoreOptions {
    return {
        baseDir: CertStore.defaultBaseDir(),
    }
}
