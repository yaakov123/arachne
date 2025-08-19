import forge from 'node-forge'
import * as tls from 'node:tls'
import { readFileIfExists, writeFileAtomic, caCertPath, caKeyPath, hostCertPath, hostKeyPath } from './store.js'

export interface CAOptions {
  commonName?: string
  organizationName?: string
  countryName?: string
  localityName?: string
  validityYears?: number
  keyBits?: number
}

export interface IssuedCert {
  certPem: string
  keyPem: string
}

export class CertificateAuthority {
  private caCertPem?: string
  private caKeyPem?: string
  private secureContextCache = new Map<string, tls.SecureContext>()

  constructor(private opts: CAOptions = {}) {}

  get caCert(): string | undefined { return this.caCertPem }

  async ensureRootCA(): Promise<{ certPem: string; keyPem: string }> {
    const existingCert = readFileIfExists(caCertPath())
    const existingKey = readFileIfExists(caKeyPath())
    if (existingCert && existingKey) {
      this.caCertPem = existingCert
      this.caKeyPem = existingKey
      return { certPem: existingCert, keyPem: existingKey }
    }

    const validityYears = this.opts.validityYears ?? 10
    const keyBits = this.opts.keyBits ?? 2048

    const keys = forge.pki.rsa.generateKeyPair({ bits: keyBits, e: 0x10001 })
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = new forge.jsbn.BigInteger(forge.util.bytesToHex(forge.random.getBytesSync(16)), 16).toString(16)
    const now = new Date()
    cert.validity.notBefore = new Date(now.getTime() - 5 * 60 * 1000)
    cert.validity.notAfter = new Date(now)
    cert.validity.notAfter.setFullYear(now.getFullYear() + validityYears)

    const attrs = [
      { name: 'commonName', value: this.opts.commonName ?? 'Arachne Proxy Root CA' },
      { name: 'organizationName', value: this.opts.organizationName ?? 'Arachne' },
      { name: 'countryName', value: this.opts.countryName ?? 'US' },
      { name: 'localityName', value: this.opts.localityName ?? 'Internet' },
    ]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)

    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true },
      { name: 'subjectKeyIdentifier' },
      { name: 'authorityKeyIdentifier', keyIdentifier: true },
    ])

    cert.sign(keys.privateKey, forge.md.sha256.create())

    const certPem = forge.pki.certificateToPem(cert)
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey)

    writeFileAtomic(caCertPath(), certPem)
    writeFileAtomic(caKeyPath(), keyPem)

    this.caCertPem = certPem
    this.caKeyPem = keyPem
    return { certPem, keyPem }
  }

  async issueHostCert(hostname: string): Promise<IssuedCert> {
    if (!this.caCertPem || !this.caKeyPem) {
      await this.ensureRootCA()
    }
    const existingCert = readFileIfExists(hostCertPath(hostname))
    const existingKey = readFileIfExists(hostKeyPath(hostname))
    if (existingCert && existingKey) {
      return { certPem: existingCert, keyPem: existingKey }
    }

    const caCert = forge.pki.certificateFromPem(this.caCertPem!)
    const caKey = forge.pki.privateKeyFromPem(this.caKeyPem!)

    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 })
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = new forge.jsbn.BigInteger(forge.util.bytesToHex(forge.random.getBytesSync(16)), 16).toString()

    const now = new Date()
    cert.validity.notBefore = new Date(now.getTime() - 5 * 60 * 1000)
    cert.validity.notAfter = new Date(now)
    cert.validity.notAfter.setFullYear(now.getFullYear() + 2)

    const attrs = [
      { name: 'commonName', value: hostname },
      { name: 'organizationName', value: 'Arachne' },
    ]
    cert.setSubject(attrs)
    cert.setIssuer(caCert.subject.attributes)

    const altNames: any[] = []
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      altNames.push({ type: 7, ip: hostname })
    } else {
      altNames.push({ type: 2, value: hostname })
      // Add wildcard if appropriate
      const parts = hostname.split('.')
      if (parts.length > 2) {
        altNames.push({ type: 2, value: `*.${parts.slice(1).join('.')}` })
      }
    }

    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames },
      { name: 'authorityKeyIdentifier', keyIdentifier: true, authorityCertIssuer: true, serialNumber: caCert.serialNumber },
    ])

    cert.sign(caKey, forge.md.sha256.create())

    const certPem = forge.pki.certificateToPem(cert)
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey)

    writeFileAtomic(hostCertPath(hostname), certPem)
    writeFileAtomic(hostKeyPath(hostname), keyPem)

    return { certPem, keyPem }
  }

  async getSecureContextForHost(hostname: string): Promise<tls.SecureContext> {
    const cached = this.secureContextCache.get(hostname)
    if (cached) return cached

    const { certPem, keyPem } = await this.issueHostCert(hostname)
    const ctx = tls.createSecureContext({ cert: certPem, key: keyPem, ca: this.caCertPem })
    this.secureContextCache.set(hostname, ctx)
    return ctx
  }
}
