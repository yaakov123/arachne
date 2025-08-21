import type {
    BackendEvent,
    ClientMessage,
    ClientHello,
    InterceptSubmitMessage,
    InterceptSkipMessage,
    InterceptRequestBodyEvent,
    InterceptResolvedEvent,
} from '@arachne/api-types'

// The socket is a ws.WebSocket from @fastify/websocket
export type WSSocket = any

export interface HubOptions {
    token?: string
    pingIntervalMs?: number
    idleTimeoutMs?: number
    maxBufferedBytes?: number
}

interface ClientFilters {
    host?: string
    method?: string
    pathGlob?: string
    status?: string
}

interface Client {
    id: string
    socket: WSSocket
    filters?: ClientFilters
    intercept?: boolean
    lastPong: number
    authenticated: boolean
}

interface InterceptWaiter {
    reqId: string
    interceptId: string
    timeout: NodeJS.Timeout
    resolve: (v: {
        buffer?: Buffer
        clientId?: string
        edited: boolean
    }) => void
    claimedBy?: string
    recipients: Set<string> // client ids permitted to submit
}

export class WsHub {
    private clients = new Map<string, Client>()
    private intercepts = new Map<string, InterceptWaiter>()
    private opts: Required<HubOptions>
    private timer?: NodeJS.Timeout

    constructor(options: HubOptions = {}) {
        this.opts = {
            token: options.token ?? '',
            pingIntervalMs: options.pingIntervalMs ?? 30000,
            idleTimeoutMs: options.idleTimeoutMs ?? 90000,
            maxBufferedBytes: options.maxBufferedBytes ?? 5 * 1024 * 1024,
        }
    }

    start() {
        if (this.timer) return
        this.timer = setInterval(
            () => this.heartbeat(),
            this.opts.pingIntervalMs
        )
    }

    stop() {
        if (this.timer) clearInterval(this.timer)
        this.timer = undefined
        for (const c of this.clients.values()) {
            try {
                c.socket.close(1001, 'server stopping')
            } catch {}
        }
        this.clients.clear()
        // Resolve any pending intercepts as unedited
        for (const [id, w] of this.intercepts) {
            clearTimeout(w.timeout)
            try {
                w.resolve({ edited: false })
            } catch {}
            this.intercepts.delete(id)
        }
    }

    handleConnection(socket: WSSocket, reqUrl: URL) {
        // Guard: ensure we have a valid WS-like object
        if (!socket || typeof (socket as any).on !== 'function') {
            return
        }
        const id = this.genClientId()
        const now = Date.now()
        const tokenFromQuery = reqUrl.searchParams.get('token') || undefined
        const needAuth = !!this.opts.token
        const authenticated = needAuth
            ? tokenFromQuery === this.opts.token
            : true

        const client: Client = {
            id,
            socket,
            filters: undefined,
            intercept: false,
            lastPong: now,
            authenticated,
        }
        if (!authenticated) {
            try {
                socket.close(1008, 'Unauthorized')
            } catch {}
            return
        }

        this.clients.set(id, client)

        socket.on('message', (data: any) => this.onMessage(client, data))
        socket.on('close', () => this.onClose(client))
        socket.on('pong', () => {
            client.lastPong = Date.now()
        })
    }

    broadcast(ev: BackendEvent) {
        const asJson = JSON.stringify(ev)
        for (const c of this.clients.values()) {
            if (!this.matchesFilters(c, ev)) continue
            if (c.socket.readyState !== 1 /* OPEN */) continue
            if (c.socket.bufferedAmount > this.opts.maxBufferedBytes) {
                try {
                    c.socket.close(1009, 'Too much buffered data')
                } catch {}
                continue
            }
            try {
                c.socket.send(asJson)
            } catch {}
        }
    }

    // Send an intercept prompt and wait for first valid submission
    async requestIntercept(
        ev: InterceptRequestBodyEvent
    ): Promise<{ buffer?: Buffer; clientId?: string; edited: boolean }> {
        const recipients = new Set<string>()
        for (const c of this.clients.values()) {
            if (!c.intercept) continue
            if (!this.matchesFilters(c, ev)) continue
            if (c.socket.readyState !== 1) continue
            recipients.add(c.id)
        }
        if (recipients.size === 0) return { edited: false }

        const json = JSON.stringify(ev)
        for (const cid of recipients) {
            const c = this.clients.get(cid)
            if (!c) continue
            try {
                c.socket.send(json)
            } catch {}
        }

        return await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.intercepts.delete(ev.interceptId)
                resolve({ edited: false })
            }, 8000)
            this.intercepts.set(ev.interceptId, {
                reqId: ev.id,
                interceptId: ev.interceptId,
                timeout,
                resolve,
                recipients,
            })
        })
    }

    private onMessage(client: Client, data: any) {
        let msg: ClientMessage | undefined
        try {
            msg = JSON.parse(
                typeof data === 'string' ? data : data.toString('utf8')
            )
        } catch {
            return
        }
        if (!msg) return

        if ((msg as ClientHello).type === 'hello') {
            const hello = msg as ClientHello
            client.filters = hello.filters || {}
            if (typeof hello.intercept === 'boolean')
                client.intercept = hello.intercept
            // Allow token in hello as alternative location
            if (
                this.opts.token &&
                hello.token &&
                hello.token !== this.opts.token
            ) {
                try {
                    client.socket.close(1008, 'Unauthorized')
                } catch {}
                return
            }
            return
        }

        if (
            (msg as InterceptSubmitMessage).type ===
            'intercept:requestBody:submit'
        ) {
            const s = msg as InterceptSubmitMessage
            const waiter = this.intercepts.get(s.interceptId)
            if (!waiter) return
            if (!waiter.recipients.has(client.id)) return
            if (waiter.claimedBy && waiter.claimedBy !== client.id) return
            waiter.claimedBy = client.id
            let buf: Buffer | undefined
            if (s.bodyEncoding === 'utf8') buf = Buffer.from(s.body, 'utf8')
            else if (s.bodyEncoding === 'base64')
                buf = Buffer.from(s.body.replace(/^base64:/, ''), 'base64')
            else buf = undefined
            clearTimeout(waiter.timeout)
            this.intercepts.delete(s.interceptId)
            waiter.resolve({ buffer: buf, clientId: client.id, edited: true })
            const resolved: InterceptResolvedEvent = {
                type: 'intercept:requestBody:resolved',
                id: waiter.reqId,
                interceptId: waiter.interceptId,
                ts: new Date().toISOString(),
                acceptedByClientId: client.id,
                edited: true,
            }
            this.broadcast(resolved)
            return
        }

        if (
            (msg as InterceptSkipMessage).type === 'intercept:requestBody:skip'
        ) {
            const s = msg as InterceptSkipMessage
            const waiter = this.intercepts.get(s.interceptId)
            if (!waiter) return
            if (!waiter.recipients.has(client.id)) return
            clearTimeout(waiter.timeout)
            this.intercepts.delete(s.interceptId)
            waiter.resolve({ edited: false })
            const resolved: InterceptResolvedEvent = {
                type: 'intercept:requestBody:resolved',
                id: waiter.reqId,
                interceptId: waiter.interceptId,
                ts: new Date().toISOString(),
                acceptedByClientId: client.id,
                edited: false,
            }
            this.broadcast(resolved)
            return
        }
    }

    private onClose(client: Client) {
        this.clients.delete(client.id)
    }

    private heartbeat() {
        const now = Date.now()
        for (const c of this.clients.values()) {
            if (!c.socket || typeof c.socket.readyState !== 'number') {
                this.clients.delete(c.id)
                continue
            }
            if (c.socket.readyState !== 1) continue
            try {
                c.socket.ping()
            } catch {}
            if (now - c.lastPong > this.opts.idleTimeoutMs) {
                try {
                    c.socket.close(1001, 'Idle timeout')
                } catch {}
                this.clients.delete(c.id)
            }
        }
    }

    private matchesFilters(c: Client, ev: BackendEvent): boolean {
        const f = c.filters
        if (!f) return true
        const url = (ev as any).url as string | undefined
        const method = (ev as any).method as string | undefined
        const statusCode = (ev as any).statusCode as number | undefined
        try {
            if (f.host && url) {
                const h = new URL(url).hostname
                if (h !== f.host) return false
            }
            if (
                f.method &&
                method &&
                f.method.toUpperCase() !== method.toUpperCase()
            )
                return false
            if (f.pathGlob && url) {
                const p = new URL(url).pathname
                if (!this.globMatch(p, f.pathGlob)) return false
            }
            if (f.status && typeof statusCode === 'number') {
                if (!this.statusMatches(statusCode, f.status)) return false
            }
            return true
        } catch {
            return true
        }
    }

    private globMatch(pathname: string, glob: string): boolean {
        const re = new RegExp(
            '^' + glob.split('*').map(this.escapeRegex).join('.*') + '$'
        )
        return re.test(pathname)
    }

    private escapeRegex(s: string) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    private statusMatches(code: number, spec: string): boolean {
        const parts = spec.split(',').map((s) => s.trim())
        for (const p of parts) {
            if (/^\d\d\dx$/.test(p)) {
                const base = parseInt(p[0])
                if (Math.floor(code / 100) === base) return true
            } else if (/^\d+$/.test(p)) {
                if (parseInt(p, 10) === code) return true
            }
        }
        return false
    }

    private genClientId() {
        return 'ws_' + Math.random().toString(36).slice(2, 10)
    }
}
