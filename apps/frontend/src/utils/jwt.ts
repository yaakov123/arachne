export interface DecodedJWT {
    header: Record<string, any>
    payload: Record<string, any>
    signature: string
    raw: {
        header: string
        payload: string
        signature: string
    }
}

/**
 * Checks if a string looks like a JWT token
 */
export function isJwtLike(token: string): boolean {
    if (!token || typeof token !== 'string') {
        return false
    }

    // Remove "Bearer " prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim()

    // JWT should have exactly 3 parts separated by dots
    const parts = cleanToken.split('.')
    if (parts.length !== 3) {
        return false
    }

    // Each part should be base64url encoded (no padding required)
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/
    return parts.every((part) => part.length > 0 && base64UrlRegex.test(part))
}

/**
 * Decodes a base64url string to a regular string
 */
function base64UrlDecode(str: string): string {
    // Add padding if needed
    let padded = str
    while (padded.length % 4) {
        padded += '='
    }

    // Replace base64url characters with base64 characters
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')

    try {
        return atob(base64)
    } catch {
        throw new Error('Invalid base64url encoding')
    }
}

/**
 * Decodes a JWT token into its components
 * @param token - The JWT token string
 * @returns Decoded JWT object or null if invalid
 */
export function decodeJWT(token: string): DecodedJWT | null {
    try {
        // Remove "Bearer " prefix if present
        const cleanToken = token.replace(/^Bearer\s+/i, '').trim()

        if (!isJwtLike(cleanToken)) {
            return null
        }

        const parts = cleanToken.split('.')
        const [headerPart, payloadPart, signaturePart] = parts

        // Decode header and payload
        const headerJson = base64UrlDecode(headerPart)
        const payloadJson = base64UrlDecode(payloadPart)

        const header = JSON.parse(headerJson)
        const payload = JSON.parse(payloadJson)

        return {
            header,
            payload,
            signature: signaturePart,
            raw: {
                header: headerPart,
                payload: payloadPart,
                signature: signaturePart,
            },
        }
    } catch (error) {
        // If any step fails, return null
        return null
    }
}

/**
 * Formats a Unix timestamp to a readable date string
 */
export function formatUnixTimestamp(timestamp: number): string {
    try {
        const date = new Date(timestamp * 1000)
        return date.toLocaleString()
    } catch {
        return timestamp.toString()
    }
}

/**
 * Checks if a Unix timestamp is expired
 */
export function isExpired(exp: number): boolean {
    return Date.now() >= exp * 1000
}

/**
 * Checks if a token is a valid JWT by attempting to decode it
 * This is more reliable than just checking the format
 */
export function isValidJWT(token: string): boolean {
    return decodeJWT(token) !== null
}
