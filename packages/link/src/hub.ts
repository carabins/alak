import { uuidV7 } from '@alaq/rune'
import type {
  LinkHub as ILinkHub,
  LinkDriver,
  LinkOptions,
  Peer,
  QoS,
  Unsubscribe,
  MessageHandler,
  Codec,
} from './types'
import { ServerMsg } from './types'
import { ClockSync, type ClockTransport } from './clock'
import { CrownManager, type CrownTransport } from './crown'
import { encodeMessage, decodeMessage, getDefaultCodec } from './codec'

type ChannelHandler = (data: any, peerId: string) => void

/**
 * LinkHub — central orchestrator.
 *
 * Manages drivers, routes messages by QoS,
 * integrates ClockSync and CrownManager.
 */
export class LinkHub implements ILinkHub {
  private drivers: LinkDriver[] = []
  private channelHandlers = new Map<string, Set<ChannelHandler>>()
  private peerMap = new Map<string, Peer>()
  private peerJoinHandlers = new Set<(peer: Peer) => void>()
  private peerLeaveHandlers = new Set<(peer: Peer) => void>()
  private requestCallbacks = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>()
  private seq = 0
  private codec: Codec
  private _peerId: string
  private clock: ClockSync
  private crown: CrownManager

  constructor() {
    this._peerId = uuidV7()
    this.codec = getDefaultCodec()

    // Init clock sync
    const clockTransport: ClockTransport = {
      sendPing: (peerId, localTime) => {
        this.sendRaw(ServerMsg.PING, { target: peerId, t: localTime })
      },
      sendPong: (peerId, localTime, remoteTime) => {
        this.sendRaw(ServerMsg.PONG, { target: peerId, t: localTime, rt: remoteTime })
      },
    }
    this.clock = new ClockSync(clockTransport)

    // Init crown
    const crownTransport: CrownTransport = {
      sendHeartbeat: (holderId) => {
        this.sendRaw(ServerMsg.CROWN_BEAT, { holder: holderId })
      },
      sendClaim: (claimantId) => {
        this.sendRaw(ServerMsg.CROWN_CLAIM, { claimant: claimantId })
      },
      broadcastPeerList: () => [...this.peerMap.keys()],
    }
    this.crown = new CrownManager(this._peerId, crownTransport, '')
  }

  // ── Lifecycle ──

  get peerId(): string {
    return this._peerId
  }

  async connect(url: string, options?: LinkOptions): Promise<void> {
    if (options?.peerId) this._peerId = options.peerId
    if (options?.codec) this.codec = options.codec

    // Connect all registered drivers that need a URL
    for (const driver of this.drivers) {
      if (driver.type === 'server') {
        await driver.connect({ url, peerId: this._peerId, metadata: options?.metadata })
      }
    }

    // Send hello
    this.sendRaw(ServerMsg.HELLO, {
      peerId: this._peerId,
      metadata: options?.metadata,
    })
  }

  disconnect(): void {
    this.clock.stop()
    this.crown.stop()
    for (const driver of this.drivers) {
      driver.disconnect()
    }
  }

  // ── Messaging ──

  send(channel: string, data: any, qos: QoS = 'reliable'): void {
    const driver = this.selectDriver(qos)
    if (!driver) return

    const msg = encodeMessage(ServerMsg.PATCH, { ch: channel, d: data }, this.codec)
    driver.send(channel, msg, qos)
  }

  request(channel: string, data: any, qos: QoS = 'reliable'): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq
      this.requestCallbacks.set(id, { resolve, reject })

      const driver = this.selectDriver(qos)
      if (!driver) {
        reject(new Error('No driver available'))
        return
      }

      const msg = encodeMessage(ServerMsg.FETCH, { ch: channel, d: data, seq: id }, this.codec)
      driver.send(channel, msg, qos)

      // Timeout
      setTimeout(() => {
        if (this.requestCallbacks.has(id)) {
          this.requestCallbacks.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 10000)
    })
  }

  on(channel: string, handler: ChannelHandler): Unsubscribe {
    let set = this.channelHandlers.get(channel)
    if (!set) {
      set = new Set()
      this.channelHandlers.set(channel, set)
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  // ── Peers ──

  get peers(): Map<string, Peer> {
    return this.peerMap
  }

  onPeerJoin(handler: (peer: Peer) => void): Unsubscribe {
    this.peerJoinHandlers.add(handler)
    return () => this.peerJoinHandlers.delete(handler)
  }

  onPeerLeave(handler: (peer: Peer) => void): Unsubscribe {
    this.peerLeaveHandlers.add(handler)
    return () => this.peerLeaveHandlers.delete(handler)
  }

  // ── Time Sync ──

  get clockOffset(): number {
    return this.clock.averageOffset
  }

  get rtt(): Map<string, number> {
    const result = new Map<string, number>()
    for (const [id, pc] of this.clock.peers) {
      result.set(id, pc.rtt)
    }
    return result
  }

  now(): number {
    return this.clock.now()
  }

  // ── Crown ──

  get crownHolder(): string {
    return this.crown.holder
  }

  get isCrownHolder(): boolean {
    return this.crown.isHolder
  }

  onCrownTransfer(handler: (newHolder: string) => void): Unsubscribe {
    return this.crown.onTransfer(handler)
  }

  // ── Drivers ──

  addDriver(driver: LinkDriver): void {
    this.drivers.push(driver)
    driver.onMessage((_channel, data, peerId) => {
      this.handleIncoming(data, peerId)
    })
  }

  removeDriver(id: string): void {
    const idx = this.drivers.findIndex(d => d.id === id)
    if (idx >= 0) {
      this.drivers[idx].disconnect()
      this.drivers.splice(idx, 1)
    }
  }

  get activeDrivers(): LinkDriver[] {
    return this.drivers.filter(d => d.state === 'connected')
  }

  // ── Internal ──

  private sendRaw(msgType: ServerMsg, payload: any): void {
    const driver = this.selectDriver('reliable')
    if (!driver) return
    const msg = encodeMessage(msgType, payload, this.codec)
    driver.send('', msg, 'reliable')
  }

  private selectDriver(qos: QoS): LinkDriver | null {
    // For unreliable — prefer P2P (WebRTC)
    if (qos === 'unreliable') {
      const p2p = this.drivers.find(d => d.state === 'connected' && d.capabilities.unreliable)
      if (p2p) return p2p
    }

    // For reliable — prefer server (WS)
    const server = this.drivers.find(d => d.state === 'connected' && d.capabilities.reliable)
    if (server) return server

    // Any connected driver
    return this.drivers.find(d => d.state === 'connected') ?? null
  }

  private handleIncoming(data: Uint8Array, peerId: string): void {
    const { type, payload } = decodeMessage(data, this.codec)

    switch (type) {
      case ServerMsg.WELCOME:
        this.handleWelcome(payload)
        break

      case ServerMsg.PATCH:
        this.dispatch(payload.ch, payload.d, peerId)
        break

      case ServerMsg.FETCH: {
        // Response to a request
        const cb = this.requestCallbacks.get(payload.seq)
        if (cb) {
          this.requestCallbacks.delete(payload.seq)
          cb.resolve(payload.d)
        }
        break
      }

      case ServerMsg.PEER_JOIN:
        this.addPeer(payload)
        break

      case ServerMsg.PEER_LEAVE:
        this.removePeer(payload.id)
        break

      case ServerMsg.PING:
        this.clock.handlePing(peerId, payload.t)
        break

      case ServerMsg.PONG:
        this.clock.handlePong(peerId, payload.t, payload.rt)
        break

      case ServerMsg.CROWN_BEAT:
        this.crown.handleHeartbeat(payload.holder)
        break

      case ServerMsg.CROWN_CLAIM:
        this.crown.handleClaim(payload.claimant)
        break

      case ServerMsg.SIG_OFFER:
      case ServerMsg.SIG_ANSWER:
      case ServerMsg.SIG_ICE:
        // Forward to channel handlers for WebRTC driver to pick up
        this.dispatch('signaling', { type, ...payload }, peerId)
        break

      case ServerMsg.CRDT_OP:
      case ServerMsg.CRDT_STATE:
        this.dispatch('crdt', payload, peerId)
        break

      case ServerMsg.SNAPSHOT:
        this.dispatch('snapshot', payload, peerId)
        break
    }
  }

  private dispatch(channel: string, data: any, peerId: string): void {
    const handlers = this.channelHandlers.get(channel)
    if (handlers) {
      for (const h of handlers) h(data, peerId)
    }

    // Wildcard listeners
    const wildcardHandlers = this.channelHandlers.get('*')
    if (wildcardHandlers) {
      for (const h of wildcardHandlers) h({ channel, data }, peerId)
    }
  }

  private handleWelcome(payload: any): void {
    // Server assigned us peerId, crown holder, and initial peer list
    if (payload.peerId) this._peerId = payload.peerId
    if (payload.crownHolder) {
      this.crown.handleHeartbeat(payload.crownHolder)
    }
    if (payload.peers) {
      for (const p of payload.peers) this.addPeer(p)
    }

    // Start clock sync with all peers
    this.clock.start([...this.peerMap.keys()])
    this.crown.start()
  }

  private addPeer(peerData: any): void {
    // Guard: ignore malformed peer data (e.g. cloud-echo hints)
    if (!peerData.id) return
    // Skip if already known (avoid duplicate onPeerJoin calls)
    if (this.peerMap.has(peerData.id)) {
      // Update metadata silently
      const existing = this.peerMap.get(peerData.id)!
      existing.metadata = peerData.metadata ?? existing.metadata
      existing.lastSeen = Date.now()
      return
    }
    const peer: Peer = {
      id: peerData.id,
      name: peerData.name,
      isLocal: peerData.isLocal ?? false,
      connection: peerData.connection ?? 'server',
      rtt: 0,
      lastSeen: Date.now(),
      metadata: peerData.metadata ?? {},
    }
    this.peerMap.set(peer.id, peer)
    this.clock.addPeer(peer.id)
    for (const h of this.peerJoinHandlers) h(peer)
  }

  private removePeer(peerId: string): void {
    const peer = this.peerMap.get(peerId)
    if (!peer) return
    this.peerMap.delete(peerId)
    this.clock.removePeer(peerId)
    this.crown.handlePeerLeave(peerId)
    for (const h of this.peerLeaveHandlers) h(peer)
  }
}
