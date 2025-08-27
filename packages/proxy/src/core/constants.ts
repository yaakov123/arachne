import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Centralized constants for the Arachne Proxy
 * This file contains all magic numbers, default values, and version strings
 * used throughout the proxy package.
 */

// Version and branding
let packageVersion = '0.1.0' // fallback
try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const packageJsonPath = path.join(__dirname, '../../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    packageVersion = packageJson.version
} catch {
    // Use fallback version if package.json can't be read
}

export const VERSION = packageVersion
export const USER_AGENT = `Arachne-Proxy/${VERSION}`
export const SERVICE_NAME = 'arachne-proxy'

// Network defaults
export const DEFAULT_PROXY_HOST = '127.0.0.1'
export const DEFAULT_PROXY_PORT = 8899
export const DEFAULT_HTTP_PORT = 80
export const DEFAULT_HTTPS_PORT = 443

// Body and memory limits
export const MAX_BODY_SIZE = 100 * 1024 * 1024 // 100MB safety limit
export const LOG_FILE_MAX_SIZE = 10 * 1024 * 1024 // 10MB
export const LOG_MAX_FILES = 5

// Timeouts (in milliseconds)
export const DEFAULT_REQUEST_TIMEOUT = 30000 // 30 seconds
export const DEFAULT_CONNECT_TIMEOUT = 10000 // 10 seconds

// Log levels
export const DEFAULT_LOG_LEVEL = 'debug'

// Component names for logging
export const COMPONENTS = {
    HTTP_HANDLER: 'http-handler',
    TLS_MANAGER: 'tls-manager',
    WEBSOCKET_HANDLER: 'websocket-handler',
    TUNNEL_HANDLER: 'tunnel-handler',
    UPSTREAM_HANDLER: 'upstream-handler',
    SERVER_LIFECYCLE: 'server-lifecycle',
    PLUGIN_MANAGER: 'plugin-manager',
    CONTEXT_BUILDER: 'context-builder',
    ERROR_RESPONSES: 'error-responses',
} as const

// HTTP headers
export const PROXY_AGENT_HEADER = 'Proxy-Agent'

// File paths
export const DEFAULT_LOG_DIR = 'logs'
export const PROXY_LOG_FILENAME = 'proxy.log'
export const ERROR_LOG_FILENAME = 'proxy-error.log'
