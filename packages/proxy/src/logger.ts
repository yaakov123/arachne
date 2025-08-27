import winston from 'winston'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import {
    SERVICE_NAME,
    DEFAULT_LOG_LEVEL,
    LOG_FILE_MAX_SIZE,
    LOG_MAX_FILES,
    DEFAULT_LOG_DIR,
    PROXY_LOG_FILENAME,
    ERROR_LOG_FILENAME,
    COMPONENTS,
} from './core/constants'

export interface LogContext {
    requestId?: string
    component?: string
    hostname?: string
    port?: number
    method?: string
    url?: string
    statusCode?: number
    duration?: number
    error?: string
    stack?: string
    [key: string]: any
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

class ProxyLogger {
    private logger: winston.Logger
    private logDir: string

    constructor() {
        // Create logs directory
        this.logDir = this.createLogDirectoryPath()
        this.ensureLogDirectory()

        // Configure winston logger
        this.logger = winston.createLogger({
            level: DEFAULT_LOG_LEVEL,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: SERVICE_NAME },
            transports: [
                // File transport for all logs
                new winston.transports.File({
                    filename: path.join(this.logDir, PROXY_LOG_FILENAME),
                    maxsize: LOG_FILE_MAX_SIZE,
                    maxFiles: LOG_MAX_FILES,
                    tailable: true,
                }),
                // Separate file for errors
                new winston.transports.File({
                    filename: path.join(this.logDir, ERROR_LOG_FILENAME),
                    level: 'error',
                    maxsize: LOG_FILE_MAX_SIZE,
                    maxFiles: LOG_MAX_FILES,
                    tailable: true,
                }),
                // Console output with simple format
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp({ format: 'HH:mm:ss' }),
                        winston.format.printf(
                            ({
                                timestamp,
                                level,
                                message,
                                component,
                                requestId,
                                ...meta
                            }) => {
                                let log = `${timestamp} [${level}]`
                                if (component) log += ` [${component}]`
                                if (requestId) log += ` [${requestId}]`
                                log += ` ${message}`

                                // Add relevant metadata
                                const relevantMeta =
                                    Object.keys(meta).length > 0 ? meta : null
                                if (relevantMeta) {
                                    const metaStr = Object.entries(relevantMeta)
                                        .filter(
                                            ([key, value]) =>
                                                value !== undefined &&
                                                key !== 'service'
                                        )
                                        .map(
                                            ([key, value]) => `${key}=${value}`
                                        )
                                        .join(' ')
                                    if (metaStr) log += ` ${metaStr}`
                                }

                                return log
                            }
                        )
                    ),
                }),
            ],
        })
    }

    private createLogDirectoryPath(): string {
        return path.join(process.cwd(), DEFAULT_LOG_DIR)
    }

    private ensureLogDirectory(): void {
        try {
            fs.mkdirSync(this.logDir, { recursive: true })
        } catch (error) {
            console.error('Failed to create log directory:', error)
            // Fallback to temp directory
            this.logDir = path.join(os.tmpdir(), 'arachne-proxy-logs')
            fs.mkdirSync(this.logDir, { recursive: true })
        }
    }

    public info(message: string, context?: LogContext): void {
        this.logger.info(message, context)
    }

    public warn(message: string, context?: LogContext): void {
        this.logger.warn(message, context)
    }

    public error(
        message: string,
        error?: Error | unknown,
        context?: LogContext
    ): void {
        const logContext = { ...context }

        if (error instanceof Error) {
            logContext.error = error.message
            logContext.stack = error.stack
        } else if (error) {
            logContext.error = String(error)
        }

        this.logger.error(message, logContext)
    }

    public debug(message: string, context?: LogContext): void {
        this.logger.debug(message, context)
    }

    public setLevel(level: LogLevel): void {
        this.logger.level = level
    }

    public getLogDirectory(): string {
        return this.logDir
    }

    // Convenience methods for common proxy operations
    public logRequest(
        requestId: string,
        method: string,
        url: string,
        context?: Partial<LogContext>
    ): void {
        this.info('Request received', {
            requestId,
            method,
            url,
            component: COMPONENTS.HTTP_HANDLER,
            ...context,
        })
    }

    public logResponse(
        requestId: string,
        statusCode: number,
        duration?: number,
        context?: Partial<LogContext>
    ): void {
        this.info('Response sent', {
            requestId,
            statusCode,
            duration,
            component: COMPONENTS.HTTP_HANDLER,
            ...context,
        })
    }

    public logConnect(
        requestId: string,
        hostname: string,
        port: number,
        context?: Partial<LogContext>
    ): void {
        this.info('CONNECT tunnel established', {
            requestId,
            hostname,
            port,
            component: COMPONENTS.TLS_MANAGER,
            ...context,
        })
    }

    public logUpstreamError(
        requestId: string,
        error: Error,
        url?: string,
        context?: Partial<LogContext>
    ): void {
        const errorCode = (error as NodeJS.ErrnoException)?.code

        // Log connection reset errors at debug level - these are normal in proxy scenarios
        if (errorCode === 'ECONNRESET') {
            this.debug('Upstream connection reset (normal)', {
                requestId,
                url,
                component: COMPONENTS.UPSTREAM_HANDLER,
                errorCode,
                ...context,
            })
        } else {
            this.error('Upstream request failed', error, {
                requestId,
                url,
                component: COMPONENTS.UPSTREAM_HANDLER,
                ...context,
            })
        }
    }

    public logProxyStart(host: string, port: number): void {
        this.info('Proxy server started', {
            hostname: host,
            port,
            component: COMPONENTS.SERVER_LIFECYCLE,
        })
    }

    public logProxyStop(): void {
        this.info('Proxy server stopped', {
            component: COMPONENTS.SERVER_LIFECYCLE,
        })
    }

    public logSystemProxyEnabled(host: string, port: number): void {
        this.info('System proxy enabled', {
            hostname: host,
            port,
            component: COMPONENTS.SERVER_LIFECYCLE,
        })
    }

    public logSystemProxyDisabled(): void {
        this.info('System proxy disabled', {
            component: COMPONENTS.SERVER_LIFECYCLE,
        })
    }
}

// Export singleton instance
export const logger = new ProxyLogger()

// Export the class for testing purposes
export { ProxyLogger }
