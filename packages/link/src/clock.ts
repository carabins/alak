import type { ClockSyncConfig, PeerClock } from './types'

export interface ClockTransport {
  sendPing(peerId: string, localTime: number): void
  sendPong(peerId: string, localTime: number, remoteTime: number): void
}

/**
 * NTP-like clock synchronization.
 *
 * Protocol:
 *   A sends PING { t0 = A.now() }
 *   B receives at t1 = B.now(), replies PONG { t0, t1, t2 = B.now() }
 *   A receives at t3 = A.now()
 *   offset = ((t1 - t0) + (t2 - t3)) / 2
 *   rtt = (t3 - t0) - (t2 - t1)
 *
 * Uses exponential moving average for stability.
 */
export class ClockSync {
  private peerClocks = new Map<string, PeerClock>()
  private pendingPings = new Map<string, number>() // peerId → t0
  private timer: ReturnType<typeof setInterval> | null = null
  private alpha: number // EMA smoothing factor

  readonly config: ClockSyncConfig

  constructor(
    private transport: ClockTransport,
    config?: Partial<ClockSyncConfig>,
  ) {
    this.config = {
      interval: config?.interval ?? 5000,
      samples: config?.samples ?? 5,
    }
    // EMA alpha: higher = more weight on new samples
    this.alpha = 2 / (this.config.samples + 1)
  }

  start(peerIds: string[]): void {
    this.stop()
    // Initial ping
    for (const id of peerIds) this.ping(id)
    // Periodic
    this.timer = setInterval(() => {
      for (const id of this.peerClocks.keys()) this.ping(id)
    }, this.config.interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  addPeer(peerId: string): void {
    this.ping(peerId)
  }

  removePeer(peerId: string): void {
    this.peerClocks.delete(peerId)
    this.pendingPings.delete(peerId)
  }

  ping(peerId: string): void {
    const t0 = Date.now()
    this.pendingPings.set(peerId, t0)
    this.transport.sendPing(peerId, t0)
  }

  /** Called when we receive a PING from a peer */
  handlePing(peerId: string, remoteTime: number): void {
    this.transport.sendPong(peerId, Date.now(), remoteTime)
  }

  /** Called when we receive a PONG from a peer */
  handlePong(peerId: string, localTimeAtPeer: number, ourOriginalTime: number): void {
    const t0 = ourOriginalTime
    const t1 = localTimeAtPeer // peer's time when they received our ping
    const t3 = Date.now()

    // Approximate t2 ≈ t1 (pong sent immediately after ping received)
    const t2 = t1

    const offset = ((t1 - t0) + (t2 - t3)) / 2
    const rtt = (t3 - t0) - (t2 - t1)

    const existing = this.peerClocks.get(peerId)
    if (existing) {
      // Exponential moving average
      existing.offset = existing.offset + this.alpha * (offset - existing.offset)
      existing.rtt = existing.rtt + this.alpha * (rtt - existing.rtt)
      existing.lastSync = t3
    } else {
      this.peerClocks.set(peerId, { offset, rtt, lastSync: t3 })
    }

    this.pendingPings.delete(peerId)
  }

  /** Get offset to a specific peer (ms) */
  getOffset(peerId: string): number {
    return this.peerClocks.get(peerId)?.offset ?? 0
  }

  /** Get RTT to a specific peer (ms) */
  getRtt(peerId: string): number {
    return this.peerClocks.get(peerId)?.rtt ?? 0
  }

  /** Average offset across all peers (best estimate of "network time") */
  get averageOffset(): number {
    if (this.peerClocks.size === 0) return 0
    let sum = 0
    for (const pc of this.peerClocks.values()) sum += pc.offset
    return sum / this.peerClocks.size
  }

  /** Synchronized timestamp */
  now(): number {
    return Date.now() + this.averageOffset
  }

  /** All peer clock data */
  get peers(): Map<string, PeerClock> {
    return this.peerClocks
  }
}
