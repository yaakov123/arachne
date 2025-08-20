import { CertStore, CertStoreOptions } from './certs/store.js'

export { MitmProxyServer, type ProxyOptions } from './proxy/server.js'
export { CertificateAuthority, type CAOptions } from './certs/ca.js'
export { installRootCATrust } from './certs/trust.js'
export * from './plugins/types.js'
export { createLoggerPlugin } from './plugins/logger.js'
export { createDemoRewritePlugin } from './plugins/rewriter.js'
export { type CertStoreOptions } from './certs/store.js'

export function getDefaultCertStoreOptions(): CertStoreOptions {
  return {
    baseDir: CertStore.defaultBaseDir(),
  }
}
  
