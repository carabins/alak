# @alaq/link

Transport core for the alaqlink stack: a pluggable `LinkHub`, three drivers (ws / http / webrtc), a CRDT engine, a `SyncBridge`, and clock sync. Zero runtime dependencies outside `@alaq/rune`.

## Status

`6.0.0-alpha.0` — **unstable**. The driver surface, wire framing, and CRDT op shape move between alpha releases. Pin exact versions; treat alpha-to-alpha upgrades as source-breaking.

## What it is

`@alaq/link` is the L2 transport core of the v6 ecosystem. It owns the bytes on the wire: QoS routing, message codec, driver lifecycle, CRDT op application, and peer clock sync. Everything above it — `@alaq/link-state`, `@alaq/link-state-vue`, the generators — speaks through `LinkHubImpl` and `SyncBridge`, never directly to a socket.

It does **not** know about your schema. Records, actions, and scopes are a generator-side concern (`@alaq/graph-link-state`, `@alaq/graph-link-server`). The hub routes strings and bytes; typing happens one layer up.

See [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) for v6 layering and the tier model. This package lives in **L2 / alaqlink** and is the runtime target of tiers T0 (ws+http), T1 (+webrtc), and T2 (+zenoh via an external driver).

## Install

```sh
bun add @alaq/link
```

```sh
npm install @alaq/link
```

Requires Node >=20 or Bun >=1.3.

## Quickstart

Minimal client wiring — one hub, one WebSocket driver, one bridge:

```ts
import { LinkHubImpl, WebSocketDriver, SyncBridge, CRDTEngine } from '@alaq/link'
import { SyncStore } from '@alaq/link-state'

const hub = new LinkHubImpl()
hub.addDriver(new WebSocketDriver('ws-main'))
await hub.connect('wss://example.org/link')

const store = new SyncStore()
const bridge = new SyncBridge({
  hub,
  store,
  engine: new CRDTEngine({ schema: {} }),
})
bridge.attach()
```

For the full runtime setup — bridge wiring, CRDT schema, server side via `@alaq/link/server`, clock sync, reconnects — see [`../link-state/RUNTIME.md`](../link-state/RUNTIME.md). The cookbook is normative for how these pieces compose.

## What this package gives you

- **`LinkHubImpl`** — central orchestrator. Routes by QoS (`reliable` / `unreliable` / `ordered-reliable`), tracks peers, dispatches channels, answers RPCs.
- **Drivers** — `WebSocketDriver` (client→server), `HttpDriver` (fallback / long-poll), `WebRTCDriver` (P2P). All implement `LinkDriver`. Add more via the same interface.
- **`SyncBridge`** — glues a `SyncStore` on one side to the hub on the other. Watches store paths, encodes CRDT ops, applies remote ops, handles snapshots.
- **`CRDTEngine`** with the standard primitive set: `LWWRegister`, `GCounter`, `PNCounter`, `ORSet`, `LWWMap`, `RGA`. Configured by `FieldSchema` map.
- **`ClockSync`** — peer RTT and offset estimation via `PING` / `PONG` server-message codes.
- **`CrownManager`** — single-holder election over a connected peer set.
- **Codecs** — `jsonCodec`, `msgpackCodec`, `getDefaultCodec()`. Swap at hub construction.
- **Wire types** — `WireMessage`, `Op` (READ/WRITE/SUB/RPC), `MsgFlag`, `ServerMsg`, `QoS`.

## What it does not do

- **No schema.** `.aql` lives in [`@alaq/graph`](../graph); typed wrappers come from [`@alaq/graph-link-state`](../graph-link-state) / [`@alaq/graph-link-server`](../graph-link-server).
- **No state model.** Reactive records and per-path nodes are in [`@alaq/link-state`](../link-state).
- **No Vue / React bindings.** Those are separate adapters (`@alaq/link-state-vue`).
- **No auth, no session.** The hub carries whatever the app puts in `metadata`; policy is a layer above.
- **No Zenoh driver.** Zenoh is tier-2-only and ships as a separate package by design (see `architecture.yaml` — `forbidden_dependencies`).

## Package layout

`src/hub.ts` is `LinkHubImpl`. `src/bridge.ts` is `SyncBridge`. `src/crdt/` holds the engine and primitive types. `src/drivers/` has `ws.ts`, `http.ts`, `webrtc.ts`. `src/codec.ts` carries the codec registry. `src/clock.ts` and `src/crown.ts` are infrastructure. `src/types.ts` is the wire and driver contract — read it first.

## Related packages

- [`@alaq/link-state`](../link-state) — `SyncStore` and `SyncNode<T>` on top of this transport.
- [`@alaq/link-state-vue`](../link-state-vue) — Vue 3 composables over `SyncNode`.
- [`@alaq/graph`](../graph) — the SDL compiler that feeds generators.
- [`@alaq/graph-link-state`](../graph-link-state) / [`@alaq/graph-link-server`](../graph-link-server) — generators that emit typed wrappers around the runtime on this package.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License. See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you `npm install @alaq/link`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run them.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to propose changes.
- [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — why v6 is shaped the way it is.

Issues: <https://github.com/carabins/alak/issues>.
