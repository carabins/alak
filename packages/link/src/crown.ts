import type { CrownConfig, Unsubscribe } from './types'

export interface CrownTransport {
  sendHeartbeat(holderId: string): void
  sendClaim(claimantId: string): void
  broadcastPeerList(): string[] // returns connected peer ids
}

type CrownHandler = (newHolder: string) => void

/**
 * Crown (Authority) Manager.
 *
 * - Crown holder broadcasts heartbeat every N ms.
 * - If no heartbeat for electionTimeout → election.
 * - Election: deterministic — lowest peerId among connected peers wins.
 * - Transfer: new holder announces, all peers update.
 */
export class CrownManager {
  private _holder: string
  private handlers = new Set<CrownHandler>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null
  private lastHeartbeat = 0

  readonly config: CrownConfig

  constructor(
    private readonly localPeerId: string,
    private transport: CrownTransport,
    initialHolder: string,
    config?: Partial<CrownConfig>,
  ) {
    this._holder = initialHolder
    this.config = {
      heartbeatInterval: config?.heartbeatInterval ?? 1000,
      electionTimeout: config?.electionTimeout ?? 3000,
    }
  }

  get holder(): string {
    return this._holder
  }

  get isHolder(): boolean {
    return this._holder === this.localPeerId
  }

  start(): void {
    this.stop()
    if (this.isHolder) {
      this.startHeartbeat()
    } else {
      this.startWatchdog()
    }
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.stopWatchdog()
  }

  onTransfer(handler: CrownHandler): Unsubscribe {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /** Called when receiving a heartbeat from the crown holder */
  handleHeartbeat(holderId: string): void {
    this.lastHeartbeat = Date.now()
    if (holderId !== this._holder) {
      this.setHolder(holderId)
    }
  }

  /** Called when receiving a claim from another peer */
  handleClaim(claimantId: string): void {
    // Accept claim if claimant has lower ID (election rule)
    // or if current holder is unreachable
    if (claimantId <= this._holder || Date.now() - this.lastHeartbeat > this.config.electionTimeout) {
      this.setHolder(claimantId)
    }
  }

  /** Called when a peer disconnects — triggers election if it was the holder */
  handlePeerLeave(peerId: string): void {
    if (peerId === this._holder) {
      this.elect()
    }
  }

  /** Force election (e.g., on reconnect) */
  elect(): void {
    const peers = this.transport.broadcastPeerList()
    // Include self
    const candidates = [this.localPeerId, ...peers].sort()
    const winner = candidates[0] // lowest ID

    if (winner === this.localPeerId) {
      // We win — claim the crown
      this.setHolder(this.localPeerId)
      this.transport.sendClaim(this.localPeerId)
    }
    // If someone else wins, they'll claim and we'll get the heartbeat
  }

  private setHolder(newHolder: string): void {
    const changed = this._holder !== newHolder
    this._holder = newHolder

    // Switch roles
    if (this.isHolder) {
      this.stopWatchdog()
      this.startHeartbeat()
    } else {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
      }
      this.startWatchdog()
    }

    if (changed) {
      for (const h of this.handlers) h(newHolder)
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return
    // Send immediately
    this.transport.sendHeartbeat(this.localPeerId)
    this.heartbeatTimer = setInterval(() => {
      this.transport.sendHeartbeat(this.localPeerId)
    }, this.config.heartbeatInterval)
  }

  private startWatchdog(): void {
    this.stopWatchdog()
    this.lastHeartbeat = Date.now()
    this.watchdogTimer = setTimeout(() => {
      this.onWatchdogTimeout()
    }, this.config.electionTimeout)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private onWatchdogTimeout(): void {
    if (Date.now() - this.lastHeartbeat >= this.config.electionTimeout) {
      // Crown holder is presumed dead — elect new one
      this.elect()
    } else {
      // Restart watchdog
      this.startWatchdog()
    }
  }
}
