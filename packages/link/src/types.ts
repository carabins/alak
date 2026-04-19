// ── Wire Protocol ──────────────────────────────────────────────────

export const enum Op {
  READ  = 0,
  WRITE = 1,
  SUB   = 2,
  RPC   = 3,
}

export const enum MsgFlag {
  NONE    = 0,
  ACK     = 1 << 0,
  STREAM  = 1 << 1,
  BATCH   = 1 << 2,
  ERROR   = 1 << 3,
}

export interface WireMessage {
  op: Op
  flags: number
  seq: number
  path: string
  realm?: string
  scope?: string
  qos?: QoS
  data?: any
}

// ── QoS ────────────────────────────────────────────────────────────

export type QoS = 'reliable' | 'unreliable' | 'ordered-reliable'

// ── Codec ──────────────────────────────────────────────────────────

export interface Codec {
  readonly id: number
  readonly name: string
  encode(value: any): Uint8Array
  decode(data: Uint8Array): any
}

// ── LinkDriver (low-level transport) ───────────────────────────────

export type DriverState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'

export interface DriverCapabilities {
  reliable: boolean
  unreliable: boolean
  ordered: boolean
  maxMessageSize: number
}

export interface DriverConfig {
  url?: string
  peerId?: string
  metadata?: Record<string, any>
}

export interface PeerInfo {
  id: string
  rtt?: number
  isLocal?: boolean
}

export interface LinkDriver {
  readonly id: string
  readonly type: 'server' | 'p2p' | 'http'
  readonly capabilities: DriverCapabilities
  readonly state: DriverState

  connect(config: DriverConfig): Promise<void>
  disconnect(): void

  send(channel: string, data: Uint8Array, qos: QoS): void
  onMessage(handler: MessageHandler): void

  onStateChange(handler: (state: DriverState) => void): void

  // P2P drivers
  readonly peers?: Map<string, PeerInfo>
}

export type MessageHandler = (channel: string, data: Uint8Array, peerId: string) => void

// ── Peer ───────────────────────────────────────────────────────────

export interface Peer {
  id: string
  name?: string
  isLocal: boolean
  connection: 'server' | 'p2p' | 'both'
  rtt: number
  lastSeen: number
  metadata: Record<string, any>
}

// ── LinkHub (orchestrator) ─────────────────────────────────────────

export type Unsubscribe = () => void

export interface LinkOptions {
  peerId?: string
  metadata?: Record<string, any>
  codec?: Codec
  clockSyncInterval?: number
  crownHeartbeatInterval?: number
}

export interface LinkHub {
  // Lifecycle
  connect(url: string, options?: LinkOptions): Promise<void>
  disconnect(): void

  // Messaging
  send(channel: string, data: any, qos?: QoS): void
  request(channel: string, data: any, qos?: QoS): Promise<any>
  on(channel: string, handler: (data: any, peerId: string) => void): Unsubscribe

  // Peers
  readonly peerId: string
  readonly peers: Map<string, Peer>
  onPeerJoin(handler: (peer: Peer) => void): Unsubscribe
  onPeerLeave(handler: (peer: Peer) => void): Unsubscribe

  // Time sync
  readonly clockOffset: number
  readonly rtt: Map<string, number>
  now(): number

  // Crown (authority)
  readonly crownHolder: string
  readonly isCrownHolder: boolean
  onCrownTransfer(handler: (newHolder: string) => void): Unsubscribe

  // Drivers
  addDriver(driver: LinkDriver): void
  removeDriver(id: string): void
  readonly activeDrivers: LinkDriver[]
}

// ── Adapter (high-level Q-compatible) ──────────────────────────────

export type Capability =
  | 'reliable'
  | 'realtime'
  | 'bidirectional'
  | 'p2p'
  | 'offline'
  | 'broadcast'
  | 'binary'
  | 'streaming'
  | 'mesh'
  | 'scouting'
  | 'wildcard-sub'

export interface AdapterConfig {
  url?: string
  peerId?: string
  codec?: Codec
}

export type Listener = (value: any, peerId?: string) => void

export interface ReadOpts { qos?: QoS; timeout?: number }
export interface WriteOpts { qos?: QoS; ack?: boolean }
export interface SubOpts { qos?: QoS }
export interface RpcOpts { qos?: QoS; timeout?: number }

export interface Adapter {
  readonly id: string
  readonly capabilities: Set<Capability>
  readonly state: DriverState

  connect(config: AdapterConfig): Promise<void>
  disconnect(): Promise<void>

  read(path: string, opts?: ReadOpts): Promise<any>
  write(path: string, value: any, opts?: WriteOpts): Promise<void>
  subscribe(path: string, listener: Listener, opts?: SubOpts): Unsubscribe
  invoke(path: string, args: any[], opts?: RpcOpts): Promise<any>
}

// ── CRDT Types ─────────────────────────────────────────────────────

export interface CRDTState {
  type: string
  state: any
}

export interface CRDTOp {
  type: string
  peerId: string
  clock: number
  path: string
  op: any
}

export interface CRDT<T = any> {
  readonly value: T
  readonly state: CRDTState
  merge(remote: CRDTState): void
}

// ── Clock Sync ─────────────────────────────────────────────────────

export interface ClockSyncConfig {
  interval: number       // ms between pings (default: 5000)
  samples: number        // rolling average window (default: 5)
}

export interface PeerClock {
  offset: number         // ms offset from peer
  rtt: number            // ms round-trip time
  lastSync: number       // local timestamp of last sync
}

// ── Crown (Authority) ──────────────────────────────────────────────

export interface CrownConfig {
  heartbeatInterval: number    // ms (default: 1000)
  electionTimeout: number      // ms, heartbeat × multiplier (default: 3000)
}

// ── Server Messages ────────────────────────────────────────────────

export const enum ServerMsg {
  // Handshake
  HELLO       = 0,
  WELCOME     = 1,

  // State sync
  PATCH       = 10,
  SNAPSHOT    = 11,
  SUB         = 12,
  UNSUB       = 13,
  FETCH       = 14,
  ACTION      = 15,

  // Peers
  PEER_JOIN   = 20,
  PEER_LEAVE  = 21,

  // Clock
  PING        = 30,
  PONG        = 31,

  // Crown
  CROWN_BEAT  = 40,
  CROWN_CLAIM = 41,

  // Signaling (WebRTC)
  SIG_OFFER   = 50,
  SIG_ANSWER  = 51,
  SIG_ICE     = 52,

  // CRDT
  CRDT_OP     = 60,
  CRDT_STATE  = 61,
}
