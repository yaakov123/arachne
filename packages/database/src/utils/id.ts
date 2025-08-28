import { randomBytes } from 'node:crypto'

/**
 * Generate a random ID using crypto.randomBytes
 */
export function generateId(): string {
    return randomBytes(16).toString('hex')
}

/**
 * Generate a UUID v4 (alternative implementation)
 */
export function generateUuid(): string {
    const bytes = randomBytes(16)

    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    return [
        bytes.toString('hex', 0, 4),
        bytes.toString('hex', 4, 6),
        bytes.toString('hex', 6, 8),
        bytes.toString('hex', 8, 10),
        bytes.toString('hex', 10, 16),
    ].join('-')
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
    return randomBytes(4).toString('hex')
}
