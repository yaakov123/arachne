import { CertStore, CertStoreOptions } from './certs/store'

export { MitmProxyServer, type ProxyOptions } from './proxy/server'
export { CertificateAuthority, type CAOptions } from './certs/ca'
export { installRootCATrust } from './certs/trust'
export * from './plugins/types'
export { createLoggerPlugin } from './plugins/logger.js'
export { createDemoRewritePlugin } from './plugins/rewriter.js'
export { type CertStoreOptions } from './certs/store'
export { enableSystemProxy, disableSystemProxy } from './os/system-proxy'

export function getDefaultCertStoreOptions(): CertStoreOptions {
    return {
        baseDir: CertStore.defaultBaseDir(),
    }
}
