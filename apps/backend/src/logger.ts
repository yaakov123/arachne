import winston from 'winston'
import { join } from 'node:path'

// Create logs directory path
const logsDir = join(process.cwd(), 'logs')

// Custom format for broadcast plugin logs
const broadcastFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
)

// General application format
const appFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
        return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`
    })
)

// Create the main logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: appFormat,
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                appFormat
            )
        }),
        // File transport for general application logs
        new winston.transports.File({
            filename: join(logsDir, 'app.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        // Error-only file transport
        new winston.transports.File({
            filename: join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    ]
})

// Create a specialized logger for broadcast plugin
export const broadcastLogger = winston.createLogger({
    level: 'info',
    format: broadcastFormat,
    transports: [
        // Dedicated file for broadcast events
        new winston.transports.File({
            filename: join(logsDir, 'broadcast.log'),
            maxsize: 50 * 1024 * 1024, // 50MB (larger since this could be high volume)
            maxFiles: 10,
            tailable: true
        })
    ]
})

// Ensure logs directory exists
import { mkdirSync } from 'node:fs'
try {
    mkdirSync(logsDir, { recursive: true })
} catch (error) {
    // Directory might already exist, ignore error
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        console.error('Failed to create logs directory:', error)
    }
}


