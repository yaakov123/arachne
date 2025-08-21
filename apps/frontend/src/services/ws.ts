import type {
  BackendEvent,
  ClientHello,
  InterceptSkipMessage,
  InterceptSubmitMessage,
} from '@arachne/api-types'

export interface ConnectOptions {
  baseUrl?: string // e.g. 'http://127.0.0.1:8080' (omit to use dev proxy / same origin)
  path?: string // default '/ws'
  token?: string
  filters?: ClientHello['filters']
  intercept?: boolean
  autoReconnect?: boolean
  maxReconnectDelayMs?: number
}

export type EventHandler = (ev: BackendEvent) => void

export class WsClient {
  private ws?: WebSocket
  private handlers = new Set<EventHandler>()
  private opts: Required<Omit<ConnectOptions, 'baseUrl' | 'token' | 'filters' | 'intercept'>> & {
    baseUrl?: string
    token?: string
    filters?: ClientHello['filters']
    intercept?: boolean
  }
  private reconnectAttempts = 0
  private closedByUser = false

  constructor() {
    this.opts = {
      baseUrl: undefined,
      path: '/ws',
      token: undefined,
      filters: undefined,
      intercept: false,
      autoReconnect: true,
      maxReconnectDelayMs: 10000,
    }
  }

  on(handler: EventHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  off(handler: EventHandler) {
    this.handlers.delete(handler)
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async connect(options: ConnectOptions = {}) {
    this.closedByUser = false
    this.opts = { ...this.opts, ...options }

    const wsUrl = this.buildWsUrl(this.opts.baseUrl, this.opts.path!, this.opts.token)

    await this.open(wsUrl)
  }

  private async open(url: URL) {
    return await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url)
      this.ws = ws

      const cleanup = () => {
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('error', onError)
        ws.removeEventListener('message', onMessage)
        ws.removeEventListener('close', onClose)
      }

      const onOpen = () => {
        this.reconnectAttempts = 0
        // Send hello with filters/intercept (token already in query)
        const hello: ClientHello = {
          type: 'hello',
          filters: this.opts.filters,
          intercept: this.opts.intercept,
          token: this.opts.token, // harmless; server validates query token earlier
        }
        ws.send(JSON.stringify(hello))
        resolve()
      }

      const onError = (_ev: Event) => {
        // Let close handler handle reconnection
        // but surface initial connection errors
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection error'))
        }
      }

      const onMessage = (ev: MessageEvent) => {
        try {
          const data = typeof ev.data === 'string' ? ev.data : '' + ev.data
          const parsed: BackendEvent = JSON.parse(data)
          if (parsed && (parsed as any).type) {
            this.handlers.forEach((h) => h(parsed))
          }
        } catch {
          // ignore
        }
      }

      const onClose = () => {
        cleanup()
        if (this.closedByUser) return
        if (!this.opts.autoReconnect) return
        const delay = this.nextBackoff()
        setTimeout(() => {
          // Rebuild URL in case token changed
          const wsUrl = this.buildWsUrl(this.opts.baseUrl, this.opts.path!, this.opts.token)
          this.open(wsUrl).catch(() => {/* will retry again */})
        }, delay)
      }

      ws.addEventListener('open', onOpen)
      ws.addEventListener('error', onError)
      ws.addEventListener('message', onMessage)
      ws.addEventListener('close', onClose)
    })
  }

  disconnect(code = 1000, reason = 'client closing') {
    this.closedByUser = true
    try {
      this.ws?.close(code, reason)
    } catch {}
    this.ws = undefined
  }

  updateFilters(filters?: ClientHello['filters']) {
    this.opts.filters = filters
    if (this.isConnected()) {
      const hello: ClientHello = { type: 'hello', filters, intercept: this.opts.intercept, token: this.opts.token }
      this.ws!.send(JSON.stringify(hello))
    }
  }

  setIntercept(enabled: boolean) {
    this.opts.intercept = enabled
    if (this.isConnected()) {
      const hello: ClientHello = { type: 'hello', filters: this.opts.filters, intercept: enabled, token: this.opts.token }
      this.ws!.send(JSON.stringify(hello))
    }
  }

  submitIntercept(msg: InterceptSubmitMessage) {
    this.send(msg)
  }

  skipIntercept(msg: InterceptSkipMessage) {
    this.send(msg)
  }

  send(msg: InterceptSubmitMessage | InterceptSkipMessage | ClientHello) {
    if (!this.isConnected()) throw new Error('WebSocket not connected')
    this.ws!.send(JSON.stringify(msg))
  }

  private buildWsUrl(baseUrl: string | undefined, path: string, token?: string) {
    const origin = baseUrl ? new URL(baseUrl) : new URL(window.location.origin)
    const wsProtocol = origin.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = new URL(path, `${wsProtocol}//${origin.host}`)
    if (token) url.searchParams.set('token', token)
    return url
  }

  private nextBackoff() {
    const attempt = ++this.reconnectAttempts
    const max = this.opts.maxReconnectDelayMs
    const jitter = Math.random() * 200
    const base = Math.min(max, 250 * Math.pow(2, attempt))
    return Math.round(base + jitter)
  }
}

export const wsClient = new WsClient()
