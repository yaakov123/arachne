import zlib from 'node:zlib'
import { MAX_BODY_SIZE } from '../constants'

// Re-export for backward compatibility
export { MAX_BODY_SIZE }

export async function readStreamToBuffer(
    stream: NodeJS.ReadableStream,
    expectedLength: number,
    maxBodySize: number = MAX_BODY_SIZE
): Promise<Buffer> {
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of stream as AsyncIterable<Buffer>) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += buf.length
        if (total > maxBodySize) throw new Error('Body too large')
        chunks.push(buf)
    }
    const out = Buffer.concat(chunks, total)
    if (
        typeof expectedLength === 'number' &&
        expectedLength >= 0 &&
        out.length !== expectedLength
    ) {
        // Not a hard error; some servers may send without accurate length
    }
    return out
}

export async function decodeBody(buf: Buffer, encoding?: string): Promise<Buffer> {
    const enc = (encoding || '').toLowerCase()
    if (!enc || enc === 'identity') return buf
    if (enc === 'gzip' || enc === 'x-gzip') {
        return await new Promise<Buffer>((res, rej) =>
            zlib.gunzip(buf, (e, o) => (e ? rej(e) : res(o)))
        )
    }
    if (enc === 'deflate') {
        return await new Promise<Buffer>((res, rej) =>
            zlib.inflate(buf, (e, o) => (e ? rej(e) : res(o)))
        )
    }
    if (enc === 'br') {
        return await new Promise<Buffer>((res, rej) =>
            zlib.brotliDecompress(buf, (e, o) => (e ? rej(e) : res(o)))
        )
    }
    // Unknown encoding; return as-is
    return buf
}
