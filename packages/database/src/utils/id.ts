import { randomBytes } from 'node:crypto'

/**
 * Generate a random ID using crypto.randomBytes
 */
export function generateId(): string {
    return randomBytes(16).toString('hex')
}
