# @alaq/graph — Cookbook

Reverse-index for `.aql` authors: find the task, copy the pattern. Normative behaviour lives in `../SPEC.md`; this file is a quick-lookup companion.

## 1. Patterns

### 1.1 Add a field to a record

```
record Player {
  id: ID!
  name: String!
  avatar: String          # optional scalar
  myWords: [String!]!     # required list of required strings
}
```

### 1.2 Declare an optional field with a default

```
record GameSettings {
  wordsPerPlayer: Int! @default(value: 10)
  roundTime: Int! @default(value: 60)
}
```

### 1.3 Mark a field visible only to its owner

```
record Player {
  id: ID!
  myWords: [String!]! @auth(read: "owner")
}
```

### 1.4 Declare a scoped record (per-room state)

```
record GameRoom @scope(name: "room") @sync(qos: RELIABLE) {
  id: ID!
  status: RoomStatus!
  players: [Player!]!
}
```

### 1.5 Declare a real-time field inside a reliable record

```
record RoundState {
  phase: RoundPhase!
  timeLeft: Int! @sync(qos: REALTIME)
}
```

### 1.6 Declare a CRDT-replicated collection

```
record Message @crdt(type: LWW_MAP, key: "updated_at") {
  id: ID!
  author: ID!
  text: String!
  updated_at: Timestamp!
}
```

### 1.7 Declare an atomic blob

```
record KalmanBlock @atomic {
  matrix: [[Float!]!]!
  bias: [Float!]!
}
```

### 1.8 Declare an RPC-style action

```
action CreateRoom {
  input: { settings: GameSettings }
  output: ID!
}
```

### 1.9 Declare a fire-forget action

```
action StartGame {
  scope: "room"
}
```

### 1.10 Declare a scope-bound action (room context)

```
action JoinRoom {
  scope: "room"
  input: { name: String! }
  output: Player!
}
```

Call-site: `room.joinRoom(name)`. The runtime binds `room.id` automatically.

### 1.11 Extend an existing record

```
extend record GameRoom {
  currentRound: RoundState
  currentTeamId: ID
}
```

### 1.12 Declare an opaque byte stream

```
opaque stream AudioFrames {
  qos: best_effort_push
  max_size: 8192
}
```

### 1.13 Add a liveness presence check

```
record Player @liveness(source: "ws:player", timeout: 5000, on_lost: MARK_ABSENT) {
  id: ID!
  name: String!
}
```

### 1.14 Bound numeric input

```
record GameSettings {
  wordsPerPlayer: Int! @default(value: 10) @range(min: 1, max: 100)
}
```

### 1.15 Import shared types

```
use "core/identity" { UUID, DeviceID }
use "./round" { RoundState }
```

### 1.16 Mark a field deprecated

```
record Player {
  avatar: String
  avatarUrl: String @deprecated(since: "2", reason: "use avatar")
}
```

### 1.17 Declare a map field

```
record GameRoom {
  # Single-level map: peerId → vote count
  wordCountVotes: Map<ID, Int>!

  # Nested map: roundId → peerId → direction
  roundVotes: Map<ID, Map<ID, VoteDir>>!

  # Map with a record value
  exclusions: Map<ID, PlayerExclusion>!
}
```

Default TS mapping: `Record<K, V>`. Wire mapping: CBOR map or LWW-Map CRDT when `@crdt(type: LWW_MAP)` is applied. Keys must be scalar (SPEC §4.8).

---

## 2. Intent → syntax

| Intent | Syntax |
|--------|--------|
| Create a data type | `record Name { ... }` |
| Create a closed value set | `enum Name { A, B, C }` |
| Create an opaque type | `scalar Name` |
| Create an operation | `action Name { ... }` |
| Operation with arguments | `action X { input: { a: T! } }` |
| Operation returning data | `action X { output: T }` |
| Operation in room context | `action X { scope: "room" }` |
| Bind argument to scope | inside input, use `@this` on argument |
| Reliable state replication | `record X @sync(qos: RELIABLE)` |
| Real-time numeric field | `field: Int! @sync(qos: REALTIME)` |
| Lazy-loaded field | `field: T! @sync(mode: LAZY)` |
| Atomic blob (no diff) | `record X @atomic` or `field: T! @atomic` |
| LWW-replicated map | `record X @crdt(type: LWW_MAP, key: "updated_at")` |
| CRDT set | `record X @crdt(type: OR_SET)` |
| Persisted record | `record X @store` |
| Private to owner | `field: T! @auth(read: "owner")` |
| Scoped to room | `record X @scope(name: "room")` |
| Presence tracking | `record X @liveness(source: "...", timeout: 3000)` |
| Bounded numeric | `field: Int! @range(min: 0, max: 100)` |
| Default value | `field: T! @default(value: V)` |
| Add fields to existing type | `extend record X { ... }` |
| Import types | `use "path" { A, B }` |
| Byte-transparent channel | `opaque stream Name { qos: ..., max_size: ... }` |
| Override topic path | `@topic(pattern: "custom/{id}/path")` |
| Map field | `field: Map<K, V>!` |
| Nested map field | `field: Map<K, Map<K2, V>>!` |
| Broadcast event | `event Name { ... }` (see SPEC §5.5) |
| Mark intended transport | `@transport(kind: "tauri")` (see SPEC §7.14) |
| Composite CRDT document | `@crdt_doc_member(doc, map)` + `@crdt_doc_topic(doc, pattern)` |
| Soft-delete in composite doc | `@crdt_doc_member(..., soft_delete: { flag, ts_field })` |
| Wire-case override | `@rename_case(kind: PASCAL)` (see SPEC §7.18) |
