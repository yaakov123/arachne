import { CertStore, CertStoreOptions } from './certs/store'

export { MitmProxyServer, type ProxyOptions } from './proxy/server'
export { CertificateAuthority, type CAOptions } from './certs/ca'
export * from './plugins/types'
export { CertStore, type CertStoreOptions } from './certs/store'
export { logger, ProxyLogger, type LogContext, type LogLevel } from './logger'

export function getDefaultCertStoreOptions(): CertStoreOptions {
    return {
        baseDir: CertStore.defaultBaseDir(),
    }
}
