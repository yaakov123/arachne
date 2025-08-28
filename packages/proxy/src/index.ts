import { CertStore, type CertStoreOptions } from './certs/store'

export { MitmProxyServer, type ProxyOptions } from './core/server'
export { CertificateAuthority, type CAOptions } from './certs/ca'
export * from './plugins/types'
export { logger, ProxyLogger, type LogContext, type LogLevel } from './logger'
export { type ProxyRuntimeConfig } from './core/config-store'

export function getDefaultCertStoreOptions(): CertStoreOptions {
    return {
        baseDir: CertStore.defaultBaseDir(),
    }
}
