import type { LinkDriver, DriverCapabilities, DriverConfig, DriverState, QoS, MessageHandler } from '../types'

/**
 * HTTP Driver — fetch wrapper for Reference Protocol and large payloads.
 * Supports: resumable downloads, ETag caching.
 * Does NOT support: bidirectional, unreliable, subscriptions.
 */
export class HttpDriver implements LinkDriver {
  readonly id = 'http'
  readonly type = 'http' as const
  readonly capabilities: DriverCapabilities = {
    reliable: true,
    unreliable: false,
    ordered: true,
    maxMessageSize: Infinity,
  }

  private baseUrl = ''
  private _state: DriverState = 'idle'
  private handlers: MessageHandler[] = []
  private stateHandlers: ((state: DriverState) => void)[] = []
  private etags = new Map<string, string>()

  get state(): DriverState {
    return this._state
  }

  async connect(config: DriverConfig): Promise<void> {
    this.baseUrl = config.url ?? ''
    this.setState('connected')
  }

  disconnect(): void {
    this.setState('disconnected')
  }

  // HTTP driver uses fetch, not send. This is a no-op for the driver interface.
  send(_channel: string, _data: Uint8Array, _qos: QoS): void {
    // HTTP driver doesn't send via this path — use fetch() directly
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

  // ── HTTP-specific API ──

  /**
   * Fetch a resource by reference URL.
   * Used by Reference Protocol: server sends a URL pointer via WS,
   * client fetches the actual data via HTTP.
   */
  async fetch(url: string, options?: { range?: [number, number] }): Promise<Uint8Array> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`
    const headers: Record<string, string> = {}

    // ETag / conditional request
    const etag = this.etags.get(fullUrl)
    if (etag) headers['If-None-Match'] = etag

    // Range request (resumable downloads)
    if (options?.range) {
      headers['Range'] = `bytes=${options.range[0]}-${options.range[1]}`
    }

    const response = await globalThis.fetch(fullUrl, { headers })

    if (response.status === 304) {
      // Not modified — caller should use cached version
      return new Uint8Array(0)
    }

    // Store ETag for future conditional requests
    const newEtag = response.headers.get('ETag')
    if (newEtag) this.etags.set(fullUrl, newEtag)

    const buffer = await response.arrayBuffer()
    const data = new Uint8Array(buffer)

    // Notify handlers
    for (const h of this.handlers) {
      h(url, data, 'server')
    }

    return data
  }

  /**
   * POST data to server (for large payloads or actions).
   */
  async post(url: string, body: Uint8Array): Promise<Uint8Array> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`

    const response = await globalThis.fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    })

    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
  }

  private setState(s: DriverState): void {
    this._state = s
    for (const h of this.stateHandlers) h(s)
  }
}
