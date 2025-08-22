import type { BackendEvent } from '@arachne/api-types'

// The socket is a ws.WebSocket from @fastify/websocket
export type WSSocket = any

export interface HubOptions {
    pingIntervalMs?: number
    idleTimeoutMs?: number
    maxBufferedBytes?: number
}

interface Client {
    id: string
    socket: WSSocket
    lastPong: number
}

export class WsHub {
    private clients = new Map<string, Client>()
    private opts: Required<HubOptions>
    private timer?: NodeJS.Timeout

    constructor(options: HubOptions = {}) {
        this.opts = {
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
    }

    handleConnection(socket: WSSocket) {
        // Guard: ensure we have a valid WS-like object
        if (!socket || typeof (socket as any).on !== 'function') {
            return
        }
        const id = this.genClientId()
        const now = Date.now()

        const client: Client = {
            id,
            socket,
            lastPong: now,
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

    private onMessage(client: Client, data: any) {
        console.log('onMessage', client.id, data)
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

    private genClientId() {
        return 'ws_' + Math.random().toString(36).slice(2, 10)
    }
}
