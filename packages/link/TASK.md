# @alaq/link — Task for Implementation Agent

## Context

`@alaq/link` is the transport layer for the Alaq ecosystem. First consumer: **Kotelok** — a multiplayer party word game (4-12+ players, phones + TV screen, same room).

Read existing design docs in this directory:
- `CONCEPT.md` — architecture and philosophy
- `PLAN.md` — phased roadmap
- `PLUGINS.md` — driver plugin system
- `DISCUSSION.md` — open questions

Existing implemented packages to integrate with:
- `packages/link/src/drivers/ws.ts` — WebSocket driver (absorbed the former `@alaq/ws` package; auto-reconnect, queue)
- `packages/link-state/src/` — SyncStore + SyncNode (reactive state replica with ghost proxies, versioned cache)
- `packages/deep-state/src/` — deep proxy state tracking with ghost proxies

---

## Architecture Decisions (Locked)

1. **Server:** Bun.js in cloud, HTTPS + WebSocket. No HTTP/3 yet (Bun doesn't support QUIC). WebTransport driver is stub/future.
2. **Topology:** Full mesh CRDT. Every client holds full state replica. Server is a peer with "crown" (authority) that can be transferred.
3. **Discovery:** Cloud Echo — server matches public IPs, orchestrates WebRTC handshake between LAN peers.
4. **Sync precision target:** FPS-level (~16ms). WebRTC SCTP timestamps as base. Future: acoustic calibration mode (each device plays unique frequency, one device with mic measures offsets).
5. **Protocol:** Binary (MessagePack or CBOR). NOT JSON for hot path. JSON acceptable for initial handshake/signaling only.
6. **CRDT:** Build primitives on top of `@alaq/deep-state`, not Yjs/Automerge. Must integrate natively with SyncStore/SyncNode. Start with: LWW Register, G-Counter, OR-Set.

---

## What to Build

### Phase 1: Core Interfaces & LinkHub

#### 1.1 LinkDriver interface

```typescript
interface LinkDriver {
  readonly id: string           // "ws", "webrtc", "http", "webtransport"
  readonly type: 'server' | 'p2p' | 'http'
  readonly capabilities: {
    reliable: boolean
    unreliable: boolean        // datagrams (WebRTC/WebTransport only)
    ordered: boolean
    maxMessageSize: number     // bytes
  }

  connect(config: DriverConfig): Promise<void>
  disconnect(): void
  send(channel: string, data: Uint8Array, qos: QoS): void
  onMessage(handler: (channel: string, data: Uint8Array, peerId: string) => void): void

  readonly state: 'connecting' | 'connected' | 'disconnected' | 'failed'
  onStateChange(handler: (state: DriverState) => void): void

  // For P2P drivers
  readonly peers?: Map<string, PeerInfo>
}

type QoS = 'reliable' | 'unreliable' | 'ordered-reliable'
```

#### 1.2 LinkHub (orchestrator)

```typescript
interface LinkHub {
  // Lifecycle
  connect(url: string, options?: LinkOptions): Promise<void>
  disconnect(): void

  // Messaging — hub picks best driver based on QoS
  send(channel: string, data: any, qos?: QoS): void
  on(channel: string, handler: (data: any, peerId: string) => void): Unsubscribe

  // Peer awareness
  readonly peers: Map<string, Peer>
  onPeerJoin(handler: (peer: Peer) => void): Unsubscribe
  onPeerLeave(handler: (peer: Peer) => void): Unsubscribe

  // Time sync
  readonly clockOffset: number       // ms offset from server
  readonly rtt: Map<string, number>  // round-trip per peer
  now(): number                      // synchronized timestamp

  // Crown (authority transfer)
  readonly crownHolder: string       // peerId
  onCrownTransfer(handler: (newHolder: string) => void): Unsubscribe

  // Drivers (runtime pluggable)
  addDriver(driver: LinkDriver): void
  removeDriver(id: string): void
  readonly activeDrivers: LinkDriver[]
}
```

#### 1.3 Peer

```typescript
interface Peer {
  id: string
  name?: string
  isLocal: boolean          // same LAN (detected via Cloud Echo)
  connection: 'server' | 'p2p' | 'both'
  rtt: number               // ms
  lastSeen: number          // timestamp
  metadata: Record<string, any>
}
```

### Phase 2: Drivers

#### 2.1 WebSocketDriver
- Implemented in `src/drivers/ws.ts` (absorbs the former `@alaq/ws` package)
- Auto-reconnect with exponential backoff
- Message queue during disconnection
- Binary frames (Uint8Array), not JSON
- Handles signaling for WebRTC (SDP/ICE exchange via WS)

#### 2.2 WebRTCDriver
- Creates RTCPeerConnection per remote peer
- RTCDataChannel: one reliable (ordered), one unreliable (maxRetransmits: 0)
- ICE candidate exchange via WebSocket signaling
- Handles local ICE candidates for LAN discovery (Cloud Echo)
- SCTP timestamps for clock sync
- Auto-fallback: if P2P fails, messages route through server WS

#### 2.3 HttpDriver
- Fetch wrapper for large payloads
- Handles "Reference Protocol": receives URL pointer via WS/WebRTC, fetches via HTTP
- Supports resumable downloads (Range headers)
- Cache-aware (ETag, If-None-Match)

#### 2.4 WebTransportDriver (stub)
- Interface only, no implementation yet
- When Bun or proxy supports QUIC — fill in
- Must support both datagrams (unreliable) and streams (reliable)

### Phase 3: Time Synchronization

#### 3.1 NTP-like Clock Sync
- Periodic ping/pong between all peers (every 5s)
- Calculate clock offset and RTT per peer
- Expose `hub.now()` — returns synchronized timestamp
- Accuracy target: <5ms in LAN, <30ms over internet

#### 3.2 Sync Primitives for Consumers
```typescript
// "Play sound at exactly this moment across all devices"
hub.schedule(hub.now() + 100, () => playSound('round-end'))

// "What's the latency to peer X?"
const delay = hub.rtt.get(peerId)  // ms
```

### Phase 4: Integration with link-state

#### 4.1 SyncStore ↔ LinkHub bridge

`link-state` SyncStore has hooks: `onFetch`, `onSubscribe`, `onUnsubscribe`, `onAction`. LinkHub must plug into these:

```typescript
const hub = new LinkHub()
const store = new SyncStore({
  onFetch: (path) => hub.request('fetch', { path }),
  onAction: (action, path, args) => hub.send('action', { action, path, args }, 'reliable'),
  onSubscribe: (path) => hub.send('sub', { path }, 'reliable'),
  onUnsubscribe: (path) => hub.send('unsub', { path }, 'reliable'),
})

// Incoming state patches from network → store
hub.on('patch', (data) => store.applyPatch(data.path, data.value))
```

#### 4.2 CRDT Layer (between link and link-state)

Sits between LinkHub (transport) and SyncStore (local state):

```
App ←→ SyncStore ←→ CRDT Engine ←→ LinkHub ←→ Network
```

CRDT Engine:
- Intercepts `applyPatch` from local SyncStore
- Wraps changes in CRDT operations (LWW/Counter/ORSet based on field type)
- Broadcasts ops to peers via LinkHub
- Receives remote ops, merges, applies to local SyncStore
- Conflict resolution is automatic (CRDT guarantees)

Required CRDT types:
- **LWW Register** — last-write-wins for simple fields (room status, current word, active player)
- **G-Counter / PN-Counter** — for scores (increment-only or increment-decrement)
- **OR-Set (Observed-Remove Set)** — for player lists, word lists (add/remove without conflicts)
- **LWW-Map** — for settings, metadata

---

## Server-Side (Bun.js)

The server is a special peer, not a traditional REST backend.

```typescript
// server.ts (Bun)
Bun.serve({
  port: 443,
  tls: { ... },

  fetch(req, server) {
    // HTTP endpoints: Reference Protocol only
    if (req.url.endsWith('/ref/*')) return handleReference(req)

    // Upgrade to WebSocket
    server.upgrade(req, { data: { peerId: generateId() } })
  },

  websocket: {
    open(ws) { /* register peer, send state snapshot, detect LAN peers */ },
    message(ws, msg) { /* binary: route CRDT ops, signaling, actions */ },
    close(ws) { /* unregister, crown transfer if needed */ },
  }
})
```

Server responsibilities:
1. WebSocket endpoint for all clients
2. Signaling relay for WebRTC P2P setup
3. Cloud Echo: match peers by public IP, instruct WebRTC handshake
4. Crown holder (authority) — validates critical state changes
5. State persistence (in-memory, optional disk snapshot)
6. Reference Protocol: serve large payloads via HTTP

---

## File Structure

```
packages/link/
  src/
    index.ts              # exports
    hub.ts                # LinkHub implementation
    types.ts              # all interfaces
    codec.ts              # MessagePack/CBOR encode/decode
    clock.ts              # NTP-like time sync
    crown.ts              # authority transfer logic
    drivers/
      ws.ts               # WebSocketDriver
      webrtc.ts           # WebRTCDriver
      http.ts             # HttpDriver
      webtransport.ts     # stub
    crdt/
      index.ts            # CRDT engine
      lww-register.ts     # Last-Write-Wins Register
      counter.ts          # G-Counter, PN-Counter
      or-set.ts           # Observed-Remove Set
      lww-map.ts          # LWW Map
  test/
    hub.test.ts
    drivers/
      ws.test.ts
      webrtc.test.ts
    crdt/
      lww.test.ts
      counter.test.ts
      or-set.test.ts
    clock.test.ts
  package.yaml
```

---

## Acceptance Criteria

1. **Two browser tabs** can connect via WebSocket to Bun server, discover they're on same LAN, establish WebRTC P2P, and exchange messages with <5ms latency
2. **Clock sync** between two peers has <5ms drift after calibration
3. **CRDT merge** works: two peers modify same field concurrently, both converge to same state without conflicts
4. **Crown transfer** works: disconnect crown holder, another peer becomes authority within 3s
5. **Driver fallback** works: kill WebRTC → messages automatically route through WebSocket
6. **Binary protocol** works: messages are MessagePack/CBOR, not JSON on hot path
7. **SyncStore integration** works: local state change → CRDT op → broadcast → remote store updated

---

## Dependencies

- `@alaq/deep-state` — ghost proxies, deep proxy tracking
- `@alaq/link-state` — SyncStore, SyncNode (consumer of link)
- `@alaq/quark` — reactive primitives (Qv, IQ)
- `@alaq/nucl` — plugin system (for driver registration)
- MessagePack library: `@msgpack/msgpack` or `msgpackr` (evaluate bundle size)

---

## Non-Goals (for now)

- HTTP/3 / WebTransport implementation (stub only)
- Persistence / database (in-memory only)
- Authentication / authorization
- Encryption beyond TLS
- Acoustic calibration (future feature, document interface only)
