import http from 'node:http'
import net from 'node:net'
import { SocketInfo, getSocketInfo } from './utils'
import { USER_AGENT, PROXY_AGENT_HEADER } from './constants'

export interface ErrorResponseOptions {
    requestId?: string
    component?: string
    hostname?: string
    port?: number
    originalError?: string
    socketInfo?: SocketInfo
}

export interface Logger {
    debug(message: string, context?: Record<string, any>): void
    error(message: string, error?: any, context?: Record<string, any>): void
}

/**
 * Sends an HTTP error response over a raw socket (for tunneling scenarios)
 * Checks socket writability before attempting to write
 */
export function sendErrorResponse(
    socket: net.Socket,
    statusCode: number,
    statusMessage: string,
    body?: string,
    logger?: Logger,
    options?: ErrorResponseOptions
): boolean {
    try {
        if (!socket.destroyed && socket.writable) {
            const response = body 
                ? `HTTP/1.1 ${statusCode} ${statusMessage}\r\nContent-Type: text/plain\r\nContent-Length: ${body.length}\r\n\r\n${body}`
                : `HTTP/1.1 ${statusCode} ${statusMessage}\r\n\r\n`
            
            if (logger && options) {
                logger.debug(`Sending ${statusCode} ${statusMessage} response`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    remoteAddress: socket.remoteAddress,
                    remotePort: socket.remotePort
                })
            }
            
            socket.write(response)
            return true
        } else {
            if (logger && options) {
                logger.debug(`Cannot send ${statusCode} response - socket already destroyed or not writable`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    socketInfo: getSocketInfo(socket)
                })
            }
            return false
        }
    } catch (writeError) {
        if (logger && options) {
            logger.error(`Failed to send ${statusCode} ${statusMessage} response`, writeError, {
                requestId: options.requestId,
                component: options.component,
                hostname: options.hostname,
                port: options.port,
                originalError: options.originalError,
                socketInfo: getSocketInfo(socket)
            })
        }
        return false
    }
}

/**
 * Sends an HTTP error response over an HTTP response object
 * Checks if headers have been sent before attempting to write
 */
export function sendHttpErrorResponse(
    res: http.ServerResponse,
    statusCode: number,
    statusMessage: string,
    body?: string,
    logger?: Logger,
    options?: ErrorResponseOptions
): boolean {
    const responseInfo = {
        headersSent: res.headersSent,
        finished: res.finished,
        destroyed: res.destroyed,
        writable: res.writable
    }
    
    try {
        if (!res.headersSent && res.writable) {
            if (logger && options) {
                logger.debug(`Sending ${statusCode} ${statusMessage} response`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port
                })
            }
            
            res.writeHead(statusCode, statusMessage)
            if (body) {
                res.end(body)
            } else {
                res.end()
            }
            return true
        } else {
            if (logger && options) {
                logger.debug(`Cannot send ${statusCode} response - headers already sent or not writable`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    responseInfo
                })
            }
            return false
        }
    } catch (writeError) {
        if (logger && options) {
            logger.error(`Failed to send ${statusCode} ${statusMessage} response`, writeError, {
                requestId: options.requestId,
                component: options.component,
                hostname: options.hostname,
                port: options.port,
                originalError: options.originalError,
                responseInfo
            })
        }
        return false
    }
}

/**
 * Sends a WebSocket upgrade error response over a raw socket
 * Specifically for WebSocket upgrade failures with appropriate headers
 */
export function sendWebSocketErrorResponse(
    socket: net.Socket,
    statusCode: number,
    statusMessage: string,
    body?: string,
    logger?: Logger,
    options?: ErrorResponseOptions
): boolean {
    try {
        if (!socket.destroyed && socket.writable) {
            // Include basic headers for WebSocket error responses
            const headers = [
                `HTTP/1.1 ${statusCode} ${statusMessage}`,
                'Connection: close',
                'Upgrade: websocket',
                'Sec-WebSocket-Version: 13'
            ]
            
            if (body) {
                headers.push(
                    'Content-Type: text/plain',
                    `Content-Length: ${body.length}`
                )
            }
            
            const response = headers.join('\r\n') + '\r\n\r\n' + (body || '')
            
            if (logger && options) {
                logger.debug(`Sending WebSocket ${statusCode} ${statusMessage} response`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    remoteAddress: socket.remoteAddress,
                    remotePort: socket.remotePort
                })
            }
            
            socket.write(response)
            return true
        } else {
            if (logger && options) {
                logger.debug(`Cannot send WebSocket ${statusCode} response - socket already destroyed or not writable`, {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    socketInfo: getSocketInfo(socket)
                })
            }
            return false
        }
    } catch (writeError) {
        if (logger && options) {
            logger.error(`Failed to send WebSocket ${statusCode} ${statusMessage} response`, writeError, {
                requestId: options.requestId,
                component: options.component,
                hostname: options.hostname,
                port: options.port,
                originalError: options.originalError,
                socketInfo: getSocketInfo(socket)
            })
        }
        return false
    }
}

/**
 * Sends a successful CONNECT tunnel established response
 * Used for HTTP CONNECT method tunneling
 */
export function sendConnectSuccessResponse(
    socket: net.Socket,
    logger?: Logger,
    options?: ErrorResponseOptions
): boolean {
    try {
        if (!socket.destroyed && socket.writable) {
            const response = 
                'HTTP/1.1 200 Connection Established\r\n' +
                `${PROXY_AGENT_HEADER}: ${USER_AGENT}\r\n` +
                '\r\n'
            
            if (logger && options) {
                logger.debug('Sending CONNECT success response', {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    remoteAddress: socket.remoteAddress,
                    remotePort: socket.remotePort
                })
            }
            
            socket.write(response)
            return true
        } else {
            if (logger && options) {
                logger.debug('Cannot send CONNECT success response - socket already destroyed or not writable', {
                    requestId: options.requestId,
                    component: options.component,
                    hostname: options.hostname,
                    port: options.port,
                    socketInfo: getSocketInfo(socket)
                })
            }
            return false
        }
    } catch (writeError) {
        if (logger && options) {
            logger.error('Failed to send CONNECT success response', writeError, {
                requestId: options.requestId,
                component: options.component,
                hostname: options.hostname,
                port: options.port,
                originalError: options.originalError,
                socketInfo: getSocketInfo(socket)
            })
        }
        return false
    }
}
