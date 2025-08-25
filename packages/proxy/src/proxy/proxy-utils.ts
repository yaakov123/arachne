import net from 'node:net'
import zlib from 'node:zlib'

export const MAX_BODY_SIZE = 100 * 1024 * 1024 // 100MB safety limit

export function getRemote(s: net.Socket): string | undefined {
    const a = s.remoteAddress
    const p = s.remotePort
    return a ? `${a}${p ? ':' + p : ''}` : undefined
}

export function getNumericHeader(
    h: string | string[] | number | undefined
): number | undefined {
    if (typeof h === 'number') return h
    if (typeof h === 'string') {
        const n = parseInt(h, 10)
        return isNaN(n) ? undefined : n
    }
    if (Array.isArray(h)) {
        for (const v of h) {
            const n = parseInt(v, 10)
            if (!isNaN(n)) return n
        }
    }
    return undefined
}

export function headerToString(h: string | string[] | undefined): string | undefined {
    if (typeof h === 'string') return h
    if (Array.isArray(h)) return h[0]
    return undefined
}

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

