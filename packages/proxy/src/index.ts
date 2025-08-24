import { CertStore, CertStoreOptions } from './certs/store'

export { MitmProxyServer, type ProxyOptions } from './proxy/server'
export { CertificateAuthority, type CAOptions } from './certs/ca'
export { installRootCATrust, uninstallRootCATrust, platform, type TrustResult, type Platform } from '@arachne/os'
export * from './plugins/types'
export { createLoggerPlugin } from './plugins/logger.js'
export { createDemoRewritePlugin } from './plugins/rewriter.js'
export { CertStore, type CertStoreOptions } from './certs/store'
export { enableSystemProxy, disableSystemProxy } from '@arachne/os'

export function getDefaultCertStoreOptions(): CertStoreOptions {
    return {
        baseDir: CertStore.defaultBaseDir(),
    }
}
