import { Qv } from '@alaq/quark'
import type IQuark from '@alaq/quark/IQuark'
import type { LinkDriver, DriverCapabilities, DriverConfig, DriverState, QoS, MessageHandler } from '../types'

export interface WsDriverConfig extends DriverConfig {
  url: string
  reconnect?: boolean
  reconnectIntensity?: number  // log base for backoff
  maxQueueSize?: number
}

/**
 * WebSocket Driver — reliable ordered transport.
 * Rewritten on Quark (not legacy Nucleus).
 * Binary frames only on hot path.
 */
export class WebSocketDriver implements LinkDriver {
  readonly id = 'ws'
  readonly type = 'server' as const
  readonly capabilities: DriverCapabilities = {
    reliable: true,
    unreliable: false,
    ordered: true,
    maxMessageSize: 64 * 1024,
  }

  private ws: WebSocket | null = null
  private config: WsDriverConfig | null = null
  private handlers: MessageHandler[] = []
  private stateHandlers: ((state: DriverState) => void)[] = []
  private queue: Uint8Array[] = []
  private reconnectCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  // Reactive state via Quark
  readonly $state: IQuark<DriverState> = Qv<DriverState>('idle')
  readonly $connected: IQuark<boolean> = Qv(false)

  get state(): DriverState {
    return this.$state.value!
  }

  async connect(config: DriverConfig): Promise<void> {
    const wsConfig: WsDriverConfig = {
      reconnect: true,
      reconnectIntensity: 24,
      maxQueueSize: 1000,
      ...config,
      url: config.url!,
    }
    this.config = wsConfig
    this.intentionalClose = false
    return this.doConnect()
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) return reject(new Error('No config'))

      this.setState('connecting')
      const ws = new WebSocket(this.config.url)
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        this.ws = ws
        this.reconnectCount = 0
        this.setState('connected')
        this.$connected(true)
        this.flushQueue()
        resolve()
      }

      ws.onmessage = (ev: MessageEvent) => {
        const data = ev.data instanceof ArrayBuffer
          ? new Uint8Array(ev.data)
          : new TextEncoder().encode(String(ev.data))

        for (const h of this.handlers) {
          h('', data, 'server')
        }
      }

      ws.onclose = () => {
        this.ws = null
        this.$connected(false)

        if (this.intentionalClose) {
          this.setState('disconnected')
          return
        }

        this.setState('disconnected')
        if (this.config?.reconnect) {
          this.scheduleReconnect()
        }
      }

      ws.onerror = () => {
        if (this.state === 'connecting') {
          reject(new Error(`WebSocket connection failed: ${this.config?.url}`))
        }
      }
    })
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setState('disconnected')
    this.$connected(false)
  }

  send(_channel: string, data: Uint8Array, _qos: QoS): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      if (this.config && this.queue.length < (this.config.maxQueueSize ?? 1000)) {
        this.queue.push(data)
      }
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler)
  }

  onStateChange(handler: (state: DriverState) => void): void {
    this.stateHandlers.push(handler)
  }

  get peers(): undefined {
    return undefined
  }

  // ── Internal ──

  private setState(s: DriverState): void {
    this.$state(s)
    for (const h of this.stateHandlers) h(s)
  }

  private flushQueue(): void {
    if (!this.ws) return
    while (this.queue.length > 0) {
      const msg = this.queue.shift()!
      this.ws.send(msg)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectCount++
    const delay = 1000 * Math.max(1, this.reconnectCount * Math.log10(this.config?.reconnectIntensity ?? 24))
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.doConnect().catch(() => {
        // Retry will be triggered by onclose
      })
    }, delay)
  }
}
