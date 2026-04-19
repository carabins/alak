# @alaq/link-state — Runtime Cookbook

**Version:** 0.3
**Format:** Markdown
**Status:** informative
**Audience:** AI agents and developers wiring `@alaq/link-state` into a running app

Companion to `@alaq/graph/SPEC.md`. Where `SPEC.md` covers the schema side
(SDL → IR → wire mapping), this document covers the **runtime**: setting
up a `SyncStore`, connecting it to a `LinkHub` through a `SyncBridge`,
defining the CRDT schema, and consuming nodes from Vue.

**Prerequisites:**

- A compiled `.aql` schema via `@alaq/graph`.
- Generated TypeScript via `@alaq/graph-link-state` (record facades, node
  factories, Vue composables).
- A `@alaq/link` transport — a `LinkHub` with at least one driver
  (`WebSocketDriver` for client→server, `WebRTCDriver` for peer-to-peer).
- On the server side: a Bun runtime that can run `createLinkServer` from
  `@alaq/link/server`.

Examples throughout reference **Kotelok-2** (`Kotelok-2/client/src/runtime/*`,
`Kotelok-2/server/runtime/handlers.ts`) as a working reference implementation.

---

## 1. Mental model

### 1.1 Layers

```
 .aql source   →   IR (JSON)   →   generated TS   →   runtime objects
 (SPEC.md)       (@alaq/graph)    (@alaq/graph-      (SyncStore, LinkHub,
                                   link-state)        SyncBridge, …)
```

Generators are the only thing that consumes IR. Runtime never sees `.aql`.

Runtime packages split by responsibility:

| Package              | Owns                                            |
|----------------------|-------------------------------------------------|
| `@alaq/link-state`   | `SyncStore`, `SyncNode`, list/map accessors     |
| `@alaq/link`         | `LinkHub`, drivers, `SyncBridge`, CRDT engine   |
| `@alaq/link-state-vue` | `provideStore`, `useStore`, `useNode`         |
| `@alaq/link/server`  | `createLinkServer` (Bun WS + action dispatch)   |

### 1.2 Data flow

Write path:

```
app mutation → node.$field(newVal)
             → SyncStore.applyPatch(path, val)     [internal]
             → listeners fire → Bridge.watch cb
             → CRDTEngine.applyLocal → onBroadcast
             → LinkHub.send('crdt', op, 'reliable')
             → WebSocket → server → peers
```

Read path:

```
wire frame → LinkHub.handleIncoming → dispatch('crdt' | 'snapshot')
          → SyncBridge listener
          → CRDTEngine.applyRemote  (or mergeState for SNAPSHOT)
          → store.applyPatch(path, resolvedValue)
          → SyncStore notifies subscribers at `path`
          → SyncNode.up() listener → Vue shallowRef mutation → re-render
```

Action path (client-initiated, server-answered):

```
node.joinRoom(args)
  → base._act('JoinRoom', args)
  → SyncStore.options.onAction('JoinRoom', 'room.<id>', args)
  → hub.request('action', {action, path, args}, 'reliable')
  → server FETCH handler → config.onAction(...) → reply
  → hub resolves Promise → node.joinRoom returns
```

### 1.3 Public vs internal API

These are public:

- `SyncStore` constructor + its options (`SyncStoreOptions`).
- `ISyncNode.value` / `$status` / `$error` / `$meta` / `up` / `down` /
  `$release` / call-as-function (`node()` get, `node(val)` set).
- `SyncListNode.item / at / length`.
- `SyncMapNode.get / peek / keys / entries`.

These are **internal** — generated code uses them; consumers should not:

- `SyncStore.applyPatch` — only `SyncBridge` and generated snapshot
  handlers call this. App-level writes go through the node callable.
- `ISyncNode._get` / `_node` / `_act` — used by generated record facades.
- `SyncStore._subscribePath` / `_resolvePath` / `_version`.

If you find yourself reaching for a `_`-prefixed member, re-read §9.

---

## 2. Setting up a client

### 2.1 Minimal setup (no network)

Useful for prototyping a UI against an in-memory store.

```ts
import { SyncStore } from '@alaq/link-state'

const store = new SyncStore()

// Generated facade:
// import { createGameRoomNode } from './generated/kotelok2.generated'
const room = createGameRoomNode(store, 'demo')

room.$players.up((players) => {
  console.log('players changed:', players)
})

// Seed some state directly (dev only — bypasses the bridge):
store.applyPatch('room.demo.id', 'demo')
store.applyPatch('room.demo.players', [])
```

No wire traffic, no CRDT, no server. Every `applyPatch` fires local listeners
only. This is not a production configuration.

### 2.2 Production setup

Three objects, one file. This is the canonical wiring — copy it into
`src/runtime/store.ts`:

```ts
// src/runtime/store.ts
import { SyncStore } from '@alaq/link-state'
import { SyncBridge, type FieldSchema } from '@alaq/link'
import { getHub, type Hub } from './link'

export const kotelok2Schema: Record<string, FieldSchema> = {
  'room.*.id':        { type: 'lww' },
  'room.*.players':   { type: 'or-set' },
  'room.*.players.*': { type: 'lww' },
}

export interface Runtime {
  store:  SyncStore
  bridge: SyncBridge
  hub:    Hub
}

export function createRuntime(): Runtime {
  const hub = getHub()

  const store = new SyncStore({
    async onAction(action, path, args) {
      return hub.request('action', { action, path, args }, 'reliable')
    },
  })

  const bridge = new SyncBridge({ hub, store, schema: kotelok2Schema })

  return { store, bridge, hub }
}

// Lazy singleton + HMR teardown (§5.4).
let _runtime: Runtime | null = null
export function runtime(): Runtime {
  if (!_runtime) _runtime = createRuntime()
  return _runtime
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    try { _runtime?.bridge.destroy() } catch {}
    _runtime = null
  })
}
```

The hub itself lives in a separate file so HMR drops one thing at a time.

```ts
// src/runtime/link.ts
import { LinkHubImpl, WebSocketDriver, jsonCodec } from '@alaq/link'

export type Hub = InstanceType<typeof LinkHubImpl>
let _hub: Hub | null = null

export function getHub(): Hub {
  if (!_hub) {
    _hub = new LinkHubImpl()
    _hub.addDriver(new WebSocketDriver())
  }
  return _hub
}

export async function connect(opts: {
  url: string; roomId?: string; clientId: string; name?: string
}): Promise<Hub> {
  const hub = getHub()
  try { hub.disconnect() } catch {} // safe on never-connected

  await hub.connect(opts.url, {
    codec: jsonCodec,
    metadata: { name: opts.name, roomId: opts.roomId, clientId: opts.clientId },
  })
  return hub
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    try { _hub?.disconnect() } catch {}
    _hub = null
  })
}
```

Reference: `Kotelok-2/client/src/runtime/store.ts`, `Kotelok-2/client/src/runtime/link.ts`.

### 2.3 Importing the CRDT schema

`SyncBridge` needs a schema map: `Record<path, FieldSchema>`. At time of
writing the schema is written by hand (see §7). A schema emitter may
generate this file in a future release; until then, keep the schema
co-located with the runtime file so regenerations of record facades
don't invalidate it.

Paths mirror the storage shape: for a scoped record at `room.<id>`, every
field lives at `room.<id>.<fieldName>`. Wildcards (`*`) match one path
segment (§7.2).

### 2.4 Multi-store / multi-room

One `SyncStore` per connection. If your app opens two simultaneous rooms,
you have two options:

1. **Single store, namespaced paths.** Store holds `room.a.*` and
   `room.b.*`; each generated facade is created with its own id.
   Recommended.
2. **Two stores + two bridges.** Only justified if you need different
   CRDT schemas or different transports per room.

Never share a `SyncBridge` across stores — the bridge owns its `CRDTEngine`
clock and its remote-op listener.

---

## 3. Setting up a server

### 3.1 `createLinkServer` basics

```ts
// server/index.ts
import { createLinkServer, jsonCodec } from '@alaq/link'
import { createServerState, dispatchAction, purgePeer } from './runtime/handlers'

const state = createServerState()
let linkServer: ReturnType<typeof createLinkServer>

linkServer = createLinkServer({
  port: 3456,
  codec: jsonCodec,
  onAction: async (action, path, args, peerId) => {
    return dispatchAction(
      { state, peers: linkServer.peers, codec: jsonCodec },
      action, path, args, peerId,
    )
  },
})

console.log(`link server on :${linkServer.port}`)
```

The late-bound `linkServer` holder is unavoidable today — `onAction`
needs `peers`, but `peers` is only returned from `createLinkServer`.

### 3.2 `onAction` handler — async and awaited

The server awaits `onAction` before encoding the reply. That means:

- **You may return a `Promise`** — the result is awaited and serialized.
- **Throwing or rejecting** produces `undefined` on the wire; the client
  Promise resolves with `undefined` rather than rejecting. Treat errors
  as return values:

```ts
case 'JoinRoom': {
  const roomId = path.replace(/^room\./, '')
  const room = state.rooms.get(roomId)
  if (!room) return { error: 'room-not-found' }
  // …
  return player
}
```

Historical note: before the P0 fix, the server did **not** await
`onAction`, which caused async handlers to ship `{}` on the wire. Any
code you still see that returns `Promise<T>` synchronously from the
handler now works; no workaround needed.

### 3.3 Broadcasting state changes

The server is not a `LinkHub` peer — it speaks the wire protocol directly.
Broadcast by encoding a `ServerMsg.SNAPSHOT` (or `ServerMsg.CRDT_OP`) and
`peer.ws.send(msg)` per-peer:

```ts
import { encodeMessage, ServerMsg, type Codec } from '@alaq/link'

function broadcastRoomState(
  peers: Map<string, ServerPeer>,
  codec: Codec,
  room: Room,
) {
  const path = `room.${room.id}`
  const msg = encodeMessage(
    ServerMsg.SNAPSHOT,
    {
      [`${path}.id`]:      room.id,
      [`${path}.players`]: room.players,
    },
    codec,
  )
  for (const [, peer] of peers) {
    if (peer.metadata.roomId !== room.id) continue
    try { peer.ws.send(msg) } catch {}
  }
}
```

The payload is a flat `Record<path, value>`; clients' `SyncBridge`
iterates entries and calls `store.applyPatch(path, val)`.

Use `ServerMsg.CRDT_OP` when the mutation is a single CRDT op
(add/remove/set) rather than a full-state snapshot. Snapshots are
cheaper when the state is small; CRDT ops are cheaper when the state is
large and deltas are frequent.

### 3.4 Scope-based routing

Clients send `metadata.roomId` in their `HELLO`. The server stores it on
the peer record; broadcasts filter by it. To derive the scope id inside
`onAction`, strip the scope prefix from `path`:

```ts
case 'JoinRoom': {
  const roomId = path.replace(/^room\./, '')  // path = "room.abc"
  const room = state.rooms.get(roomId) ?? createRoom(roomId)
  // …
}
```

Reference: `Kotelok-2/server/runtime/handlers.ts`.

---

## 4. Bridging: `SyncStore` ↔ `LinkHub`

### 4.1 `SyncBridge` config

```ts
new SyncBridge({
  hub,                       // LinkHub instance
  store,                     // SyncStore instance (duck-typed)
  schema: kotelok2Schema,    // Record<path, FieldSchema>
})
```

The bridge subscribes to two hub channels automatically:

- `hub.on('crdt', …)` — each remote CRDT op is fed to `CRDTEngine.applyRemote`;
  the resolved value is written to the store via `applyPatch`.
- `hub.on('snapshot', …)` — a full state payload from the server is merged
  into the CRDT engine, then applied path-by-path.

### 4.2 Watching paths

Local writes are **not** broadcast until you call `bridge.watch(path)`:

```ts
const rt = runtime()
const unwatch = rt.bridge.watch(`room.${props.id}`)
// later:
unwatch()
```

`watch(path)` subscribes the bridge to every change under `path`. A single
watch on a scope root is usually enough; nested writes propagate.

Timing: call `watch` **after `hub.connect()`** and **after every
reconnect**. The easiest place is the screen that owns the scope (the
Kotelok-2 lobby calls `rt.bridge.watch(\`room.${id}\`)` in `onMounted`).

### 4.3 Ghost-proxy guard

`SyncStore` uses `@alaq/deep-state` ghost proxies — unpopulated paths
resolve to a proxy that `isGhost(val) === true`. The bridge refuses to
broadcast ghosts:

```ts
// inside bridge.watch
if (isGhost(value) || value === undefined) return
```

Without this guard the initial subscribe-push (which always fires the
current value) would feed a ghost into `applyLocal`, serialize the
proxy, broadcast it, receive it back, apply it, fire the listener
again — infinite loop.

You never need to think about this unless you're writing your own bridge.
If you are, always bail on `isGhost(val) || val === undefined` before
calling `applyLocal`.

### 4.4 Reconnection and re-subscription

The current bridge does not auto-resubscribe on hub reconnect. If the
WebSocket drops, call `hub.connect(...)` again and re-invoke
`bridge.watch(...)` for every path you care about. In practice the lobby
screen calls both on `onMounted` so a page refresh is equivalent to a
reconnect.

If you need persistent watches across reconnects, wrap `bridge.watch` in
your own helper that reinstalls itself on a `hub.onPeerJoin` event from
the server peer.

---

## 5. Vue integration

### 5.1 `provideStore` in the root

Call `provideStore(store)` once, in the component that lives at the root
of every tree that needs the store. In a typical Vite + Vue setup, this
is `App.vue`:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provideStore } from '@alaq/link-state-vue'
import { runtime } from './runtime/store'

const rt = runtime()
provideStore(rt.store)
</script>

<template>
  <router-view />
</template>
```

`provideStore` uses `vue.provide` under an internal `Symbol.for` key.
`useStore` uses `vue.inject` with the same key.

### 5.2 `useNode` and `useNodeWithDefault`

`useNode(node)` returns a `Ref<T | undefined>` that mirrors the node's
value and auto-unsubscribes on scope dispose:

```ts
import { useNode } from '@alaq/link-state-vue'

const player = store.get('room.abc.players.0')
const playerRef = useNode(player)   // Ref<IPlayer | undefined>
```

`useNodeWithDefault(node, defaultVal)` collapses `undefined`/ghost to
`defaultVal`, so templates can skip `v-if`:

```ts
const hp = useNodeWithDefault(store.get('player.hp'), 100)
// hp.value is always number — 100 while pending, then the real HP
```

Both must run inside an active effect scope (`setup()` or `effectScope()`).
Outside Vue, use `toRefNoScope(node)` and call `release()` manually.

### 5.3 Generated composables (`useGameRoomInScope`)

`@alaq/graph-link-state` emits per-record composables:

```ts
import { useGameRoomInScope } from './generated/kotelok2.generated'

const { node, value, status } = useGameRoomInScope(props.id)
// node:   GameRoomNode   — full facade, actions + sub-nodes
// value:  Ref<IGameRoom | undefined>
// status: Ref<'pending' | 'ready' | 'error' | undefined>
```

Inside the template:

```vue
<p>status: {{ status }}</p>
<ul v-if="value && value.players?.length">
  <li v-for="p in value.players" :key="p.id">{{ p.name }}</li>
</ul>
```

Under the hood: `useGameRoomInScope(id)` = `useGameRoom(useStore(), id)`.
`useStore()` throws if `provideStore` was not called upstream — see §10.1.

### 5.4 Lifecycle: scope, navigation, HMR

- **Scope**: `useNode` auto-releases its subscription when the current
  effect scope tears down. No manual cleanup needed inside components.
- **Navigation**: generated `useXxxInScope(id)` captures `id` at setup
  time. If you navigate `/room/a` → `/room/b` without unmounting the
  screen, the scope id is stale. Force an unmount (route-level key,
  `v-if` gate) or restructure around `MaybeRefOrGetter<string>` once
  available.
- **HMR**: add `import.meta.hot.dispose` to `runtime/store.ts` and
  `runtime/link.ts` that drops the singletons. Vite's module-graph
  reload then gives you a fresh hub/store per edit; React-Devtools-style
  "lost state on every save" is acceptable here because the canonical
  state lives on the server.

---

## 6. Actions

### 6.1 Defining actions in SDL

```aql
# schema/lobby.aql
action CreateRoom {
  output: ID!
}

action JoinRoom {
  scope: "room"
  input: { name: String!, clientId: String! }
  output: Player!
}

action StartGame {
  scope: "room"
  output: Boolean!
}
```

Scope-bound actions receive the scope instance id implicitly from the
call site (SPEC §6 R072).

### 6.2 Calling via generated node

```ts
// Unscoped — static function on the API root:
import { createRoom } from './generated/kotelok2.generated'
const roomId = await createRoom(store)

// Scope-bound — method on the node:
const { node } = useGameRoomInScope(roomId)
const player = await node.joinRoom({ name: 'alice', clientId })
const started = await node.startGame()
```

Each generated method is:

```ts
joinRoom: (input) => base._act('JoinRoom', input) as Promise<IPlayer>
```

The cast is optimistic — runtime does not validate the shape. Treat it
as a typed suggestion, not a guarantee.

### 6.3 `SyncStore.onAction` contract

```ts
onAction?: (action: string, path: string, args: any) => Promise<any>
```

- `action` — PascalCase name from SDL (e.g. `'JoinRoom'`).
- `path` — dotted storage path the action was called on. Empty string for
  unscoped actions. For scope-bound actions: the scope path (e.g.
  `'room.abc'`).
- `args` — the `input: { … }` object from SDL, or `undefined`.
- Returns: a Promise resolving to the action's `output` shape.

Canonical implementation — forward to `hub.request` on the reliable channel:

```ts
const store = new SyncStore({
  async onAction(action, path, args) {
    return hub.request('action', { action, path, args }, 'reliable')
  },
})
```

The server's `createLinkServer({ onAction })` reads the same `action`,
`path`, `args` and awaits the handler's return value.

### 6.4 Error handling

Three failure modes:

1. **Network failure** — `hub.request` rejects (timeout: 10 s, no driver).
   The generated method's Promise rejects; wrap in `try/catch`.
2. **Server threw** — today the server does not propagate errors; the
   client receives `undefined`. Return an explicit `{ ok: false, … }`
   shape from `onAction` handlers until the transport grows error frames.
3. **Shape mismatch** — the server returns something that doesn't match
   the TS cast. No runtime guard today. Validate on the consumer side
   if critical.

---

## 7. CRDT semantics

### 7.1 When to use which CRDT

| CRDT type       | Use for                                              | SDL directive                              |
|-----------------|------------------------------------------------------|--------------------------------------------|
| `lww`           | Scalar fields, enums, timestamps, single values      | default; or `@crdt(type: LWW_REGISTER)`    |
| `lww-map`       | Keyed maps where each key has a last-writer value    | `@crdt(type: LWW_MAP, key: "updated_at")`  |
| `or-set`        | Membership sets (players, tags) — add/remove concurrently safe | `@crdt(type: OR_SET)`          |
| `pn-counter`    | Counters that go up **and** down (inventory, scores) | `@crdt(type: PN_COUNTER)`                  |
| `rga`           | Ordered lists where insert position matters (shared text, playlists) | `@crdt(type: RGA)`         |

Rules of thumb:

- **If every write is authoritative (server-only writes), `lww` is fine
  for everything.** Kotelok-2 uses `lww` for scalars and `or-set` only
  because player join/leave can happen concurrently on different tabs.
- **Pick `rga` only if order matters and concurrent inserts happen.**
  For append-only logs, an `or-set` of `{id, ts}` ordered client-side
  is simpler and cheaper.
- **`lww-map` over `Map<K, V>`** (SPEC §4.8) is the canonical mapping
  when the map is the state, not a derived view.

### 7.2 FieldSchema paths and wildcards

The schema is `Record<path, FieldSchema>`. Paths are dotted storage paths.
One wildcard segment is `*`:

```ts
{
  'room.*.id':        { type: 'lww' },
  'room.*.players':   { type: 'or-set' },
  'room.*.players.*': { type: 'lww' },
}
```

Resolution (`CRDTEngine.resolveSchema`):

1. Exact match.
2. Walk ancestors, try `${prefix}.*` at each level.
3. Default: `{ type: 'lww' }`.

So `room.abc.id` matches `room.*.id`. `room.abc.players.3` matches
`room.*.players.*`. Unknown paths silently default to LWW — that's
usually what you want for scalar leaves, but it means a misspelled key
won't raise.

Scope prefix note: generated scoped nodes store at `<scopeName>.<id>`.
`room.abc` for a room-scoped record. If you rename the scope in SDL,
update your CRDT schema paths; no compile-time check catches this drift.

### 7.3 CRDT ops on the wire

`SyncBridge` broadcasts one of two payloads per mutation:

- `CRDTOp` on channel `crdt` — one op, for a single `applyLocal`.
- `CRDTState` on channel `crdt` (full state) — sent on initial sync.

The server relays both by broadcasting the raw frame to every peer in
the same room (`ServerMsg.CRDT_OP` / `ServerMsg.CRDT_STATE` in
`createLinkServer`). Initial state for a newly joined peer is delivered
via `ServerMsg.SNAPSHOT` — the server constructs this from its own
authoritative state, not from other peers.

---

## 8. Reactive accessors (v0.3+)

### 8.1 `$field.item(i)` — list items

`SyncListNode<T, N>` wraps an `ISyncNode<T[]>` with per-index access:

```ts
const players = node.$players                // SyncListNode<IPlayer, PlayerNode>

const first = players.item(0)                // PlayerNode (reactive)
first.$name.up(name => console.log('name →', name))

players.at(0)                                // IPlayer | undefined (snapshot, no node)
players.length                               // current count
```

`item(i)` returns a child node whose shape is chosen by the generator
(scalar `ISyncNode<T>` for scalars, record facade for records, nested
`SyncListNode` / `SyncMapNode` for composites).

### 8.2 `$field.get(key)` — map entries

`SyncMapNode<K, V, N>` wraps an `ISyncNode<Record<K, V>>`:

```ts
const votes = node.$roundVotes               // SyncMapNode<ID, VoteDir, ISyncNode<VoteDir>>

const roundA = votes.get('round-a')          // reactive node for votes['round-a']
votes.peek('round-a')                        // VoteDir | undefined
votes.keys()                                 // ID[]
votes.entries()                              // [ID, VoteDir][]
```

Missing keys return ghost-free `undefined` from `peek`; `get(k)` always
returns a live node (the underlying path may be a ghost until a value
arrives).

### 8.3 Per-entry vs whole-collection subscriptions

- Subscribe to the **whole** `$players.up(cb)` when the UI rerenders
  every player on every change (simple list, < ~20 entries). One
  listener, every mutation fires the callback with the full array.
- Subscribe **per item** (`players.item(i).up(...)` or the generated
  record composable) when a single field inside one entry updates
  frequently (a countdown, a ping). Only that entry's subscribers fire.

Mix is fine: outer subscription for length changes, inner for hot
fields.

---

## 9. Cookbook — copy-paste recipes

### 9.1 Minimal two-tab chat app

`schema/chat.aql`:

```aql
schema Chat { version: 1, namespace: "chat" }

record Message {
  id: ID!
  author: String!
  text: String!
  at: Timestamp!
}

record ChatRoom @scope(name: "room") @sync(qos: RELIABLE) {
  id: ID!
  messages: [Message!]!
}

action SendMessage {
  scope: "room"
  input: { text: String!, author: String! }
  output: Message!
}
```

`runtime/store.ts` — CRDT schema:

```ts
export const chatSchema: Record<string, FieldSchema> = {
  'room.*.id':         { type: 'lww' },
  'room.*.messages':   { type: 'or-set' },
  'room.*.messages.*': { type: 'lww' },
}
```

`ChatScreen.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useChatRoomInScope } from '../generated/chat.generated'
import { connect, getClientId } from '../runtime/link'
import { runtime } from '../runtime/store'

const props = defineProps<{ id: string }>()
const { node, value } = useChatRoomInScope(props.id)
const draft = ref('')

onMounted(async () => {
  await connect({ url: 'ws://localhost:3456', roomId: props.id, clientId: getClientId() })
  runtime().bridge.watch(`room.${props.id}`)
})

async function send() {
  await node.sendMessage({ text: draft.value, author: 'me' })
  draft.value = ''
}
</script>

<template>
  <ul><li v-for="m in value?.messages" :key="m.id">{{ m.author }}: {{ m.text }}</li></ul>
  <form @submit.prevent="send"><input v-model="draft" /></form>
</template>
```

Server dispatcher mutates `room.messages`, broadcasts SNAPSHOT, both tabs
rerender.

### 9.2 Add a new scoped record

```aql
extend record GameRoom {
  currentRound: RoundState
}

record RoundState {
  phase: RoundPhase!
  timeLeft: Int! @sync(qos: REALTIME)
}
```

Add to CRDT schema:

```ts
{
  'room.*.currentRound':          { type: 'lww' },   // whole sub-record LWW
  'room.*.currentRound.phase':    { type: 'lww' },
  'room.*.currentRound.timeLeft': { type: 'lww' },
}
```

Regenerate. `node.$currentRound.$phase` is now reactive.

### 9.3 Add a new action with reply

```aql
action StartGame {
  scope: "room"
  output: Boolean!
}
```

Client (auto-generated on the facade):

```ts
const ok = await node.startGame()
if (ok) router.push('/round')
```

Server — add a case to the dispatcher:

```ts
case 'StartGame': {
  const roomId = path.replace(/^room\./, '')
  const room = state.rooms.get(roomId)
  if (!room) return false
  room.status = 'PLAYING'
  broadcastRoomState(peers, codec, room)
  return true
}
```

### 9.4 Add an LWW-Map field

```aql
record GameRoom {
  wordCountVotes: Map<ID, Int>! @crdt(type: LWW_MAP, key: "updated_at")
}
```

CRDT schema:

```ts
{ 'room.*.wordCountVotes': { type: 'lww-map' } }
```

Client — mutations go through the CRDT engine's `lww-map` op shape. Bridge
does the wrapping as long as the write is a whole-map replacement; for
targeted set/delete ops, bypass the bridge and call `crdt.applyLocal`
directly (advanced).

Reactive read:

```ts
const votes = node.$wordCountVotes.get('peer-7')   // ISyncNode<number>
const n = useNode(votes)                           // Ref<number | undefined>
```

### 9.5 Subscribe to a specific player in a list

```ts
const { node } = useGameRoomInScope(roomId)

// First player's name, reactive, per-field:
const name = useNode(node.$players.item(0).$name)
```

Only mutations to `room.<id>.players.0.name` wake this listener.

### 9.6 Handle disconnection gracefully

Watch the hub's crown transfer or peer-join count for liveness:

```ts
onMounted(() => {
  const rt = runtime()
  const offJoin  = rt.hub.onPeerJoin(() => (connected.value = true))
  const offLeave = rt.hub.onPeerLeave(() => (connected.value = rt.hub.peers.size > 0))
  onBeforeUnmount(() => { offJoin(); offLeave() })
})
```

On reconnect, re-invoke `bridge.watch(scopePath)` and refire any scoped
`join*` action — the server's `HELLO` path evicts the stale peer and
creates a fresh one.

### 9.7 Reset store on room leave

```ts
onBeforeUnmount(async () => {
  try { await node.leaveRoom({ clientId }) } catch {}
  unwatch?.()
  // No explicit store-clear today; navigate away and the scope path
  // stops being read. Full teardown = drop the runtime singleton:
  //   _runtime?.bridge.destroy(); _runtime = null
})
```

Clearing the store wholesale is appropriate on logout, not on room exit.

### 9.8 Debug: inspect store state

Expose the runtime in DevTools:

```ts
(window as any).__rt = runtime()
// __rt.store._resolvePath('room.abc')   — raw value at path (internal; debug only)
// __rt.bridge.getState()                — full CRDT state snapshot
// __rt.hub.peers                        — Map<peerId, Peer>
// __rt.hub.clockOffset                  — ms offset from crown holder
```

---

## 10. Troubleshooting

### 10.1 `useStore() throws: 'No SyncStore provided'`

Cause: no ancestor called `provideStore(store)`. The injection tree is
empty by the time the child composable runs.

Fix: put `provideStore(rt.store)` in `App.vue`'s `<script setup>`, at
the root of every `<router-view />`. If the error originates in a
`<Teleport>`ed component, provide in the **logical** root (the one
rendering the teleport target's source), not the DOM root.

### 10.2 `Type 'Promise<X>' missing properties of 'Ref<T>'`

You wrote `const foo: Ref<T> = node.something()` where `something()`
returns a Promise (an action). Wait for it:

```ts
const foo = ref<T>()
onMounted(async () => { foo.value = await node.something() })
```

This is a Vue-template typing issue, not a runtime bug.

### 10.3 "Snapshot received but state is empty"

The snapshot keys don't match what your store is reading. Common causes:

- **Scope path mismatch.** Server sends `room.abc.id`, client reads
  `rooms.abc.id`. Check the scope name in SDL — the generated facade
  uses it verbatim (`\`${scopeName}.${id}\``).
- **Codec mismatch.** Server uses `msgpackCodec`, client uses `jsonCodec`
  (or vice versa). Both sides must agree; default is msgpack
  (see §11.3).
- **No `bridge.watch`** for the scope path — snapshots still work
  (they're one-way, server → client), but this is worth checking.

### 10.4 "Action returns `undefined`"

Two possibilities:

1. **The server handler didn't return anything** (or returned `undefined`).
   Check the `case` in your dispatcher.
2. **Pre-P0 fix:** the server did not await async `onAction` handlers,
   so a `Promise<X>` got serialized as `{}`. Now fixed in
   `packages/link/server/index.ts` — `const result = await config.onAction?.(…)`.
   If you see this on a current build, you're returning `Promise<undefined>`.

### 10.5 "Ghost proxy infinite loop"

Historical. The bridge used to feed the initial subscribe-push (always a
ghost proxy on a fresh store) into `applyLocal`, which serialized the
proxy, broadcast it, received it back, applied it, pushed again. Fixed
in P0 — `bridge.watch` now bails on `isGhost(value) || value === undefined`.
If you're hitting something that looks like this on a current build, check
whether you wrote a custom bridge and forgot the guard.

---

## 11. Performance

### 11.1 Snapshot frequency

Server snapshots are full-state: every keyed value in the room is
re-sent. At room sizes > a few KB, switch to `CRDT_OP` frames for
individual mutations and reserve `SNAPSHOT` for welcome-packets only.

### 11.2 Subscription granularity

Every `up(cb)` is a node in the listener map. A room with 100 players,
each with 5 subscribed fields, = 500 listeners. Fine. 10 000 = start
measuring.

If you subscribe per-entry in a long list, be sure to release: generated
facades' `$release()` drops the subscription; list items created via
`item(i)` are bound to the parent list node's lifecycle via Vue's
`onScopeDispose`.

### 11.3 Codec choice

Two codecs ship with `@alaq/link`:

- `jsonCodec` — JSON, human-readable, always available, larger wire.
- `msgpackCodec` — msgpack-lite via `msgpackr`, smaller and faster;
  currently imported unconditionally in `codec.ts` (tracked as a
  friction point — expected to become lazy in a future release).

Use `jsonCodec` for development and any app where you'll inspect frames
in DevTools. Use `msgpackCodec` in production when wire size matters.
**Both sides must use the same codec** — no handshake negotiation today.
If you forget, HELLO decodes as garbage and the session dies quietly.

---

## 12. Limits (honest)

The runtime in its current form is minimal by design. These are not
bugs; they're absent features you should know about before scaling.

### 12.1 No persistence layer

`SyncStore` is in-memory. `@store` in SDL is parsed but the persistence
backend is not shipped. Refreshing the tab loses every local-only value;
state backed by the server is restored via `SNAPSHOT` on connect.

### 12.2 No hub-level offline queue

Writes while disconnected are not buffered. `hub.send(...)` with no
active driver returns silently (no throw, no queue). Check
`hub.activeDrivers` before mutating, or wrap writes in a queue of your
own.

### 12.3 No schema version negotiation at runtime

Generated code includes `specVersion` metadata but the hub does not
verify it on connect. Mismatched schemas between client and server will
decode OK but ship nonsense. Keep both sides built from the same IR.

### 12.4 No built-in auth / permissions

`@auth(read / write)` in SDL is documented but not enforced at runtime.
There is no identity token, no signed frame, no ACL check. If you need
authentication, wrap `createLinkServer`'s `fetch` handler (for HTTP
auth on upgrade) and pass a trusted `clientId` in `metadata`. Never
trust `args.clientId` from a client — read `peerId` instead, which the
server assigned.

### 12.5 No server-side authoritative `SyncStore`

The server keeps its own ad-hoc state map and manually encodes
`SNAPSHOT`. There is no server-side `SyncStore` / `SyncBridge` story
yet. For small games this is fine; for anything requiring CRDT merges
at authority, you need to run the CRDT engine server-side manually —
feasible, not documented here.

---

## Appendix A — Reference files (Kotelok-2)

| What | Path |
|------|------|
| Client runtime store   | `Kotelok-2/client/src/runtime/store.ts` |
| Client runtime link    | `Kotelok-2/client/src/runtime/link.ts` |
| Root provide           | `Kotelok-2/client/src/App.vue` |
| Lobby screen           | `Kotelok-2/client/src/screens/LobbyScreen.vue` |
| Server dispatcher      | `Kotelok-2/server/runtime/handlers.ts` |
| Generated TS (sample)  | `Kotelok-2/client/src/generated/kotelok2.generated.ts` |
| SDL sources            | `Kotelok-2/Kotelok/schema/aql/*.aql` |

These are kept intentionally small — read them once, copy patterns.

---

## Appendix B — Full `SyncStoreOptions` reference

```ts
export interface SyncStoreOptions {
  /** Called when a ghost proxy path is dereferenced. Use for lazy fetch. */
  onFetch?: (path: string) => Promise<any>

  /** Called the first time a listener subscribes to `path`. */
  onSubscribe?: (path: string) => void

  /** Called when the last listener on `path` unsubscribes. */
  onUnsubscribe?: (path: string) => void

  /** Routes actions out of the store. Canonical impl: hub.request. */
  onAction?: (action: string, path: string, args: any) => Promise<any>
}
```

All four callbacks are optional. Omitting `onAction` makes generated
action methods warn and resolve to `undefined`.

---

**End of document.** For schema-side concerns (directives, `@crdt`,
scopes, validation), go to `packages/graph/SPEC.md`.
