# @alaq/link-state

Client-side reactive replica over `@alaq/link`: `SyncStore` with ghost proxies, `SyncNode<T>` facades, and per-entry list/map accessors.

## Status

`6.0.0-alpha.0` — **unstable**. `ISyncNode` shape, store options, and accessor surface move between alpha releases. Pin exact versions.

## What it is

`@alaq/link-state` is the reactive client-replica layer of alaqlink. It sits between [`@alaq/link`](../link) (bytes on the wire) and your UI: a `SyncStore` holds a sparsely-materialized view of remote state, a `SyncNode<T>` wraps a path into a callable reactive primitive, and list/map accessors let components subscribe to a single element without re-rendering on every sibling change.

This is the target of the [`@alaq/graph-link-state`](../graph-link-state) generator. Typed record facades like `PlayerNode` that you see in generated output are `ISyncNode<IPlayer>` with a runtime-added property bag — this package defines that contract.

The package lives in **L2 / alaqlink** per [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md). It is transport-neutral — wire framing, CRDT application, and driver lifecycle all belong to `@alaq/link`.

## Install

```sh
bun add @alaq/link-state
```

```sh
npm install @alaq/link-state
```

Requires Node >=20 or Bun >=1.3. `@alaq/link` is the runtime sibling; you need it to turn a `SyncStore` into a connected replica.

## Quickstart

```ts
import { SyncStore } from '@alaq/link-state'
import { LinkHubImpl, WebSocketDriver, SyncBridge, CRDTEngine } from '@alaq/link'

const store = new SyncStore()

const hub = new LinkHubImpl()
hub.addDriver(new WebSocketDriver('ws-main'))
await hub.connect('wss://example.org/link')

const bridge = new SyncBridge({
  hub,
  store,
  engine: new CRDTEngine({ schema: {} }),
})
bridge.attach()

// Grab a reactive node for a path.
const player = store.get('player.42')

// Read:
player.value       // current snapshot (T | undefined)
player()           // same, callable form
player.$status()   // 'pending' | 'ready' | 'error'

// Subscribe:
const off = player.up(p => console.log('player:', p))
// …
off()

// Write (propagates through the bridge):
player({ id: '42', name: 'Ada' })
```

`SyncStore` accepts `onFetch`, `onSubscribe`, `onUnsubscribe`, `onAction` hooks on construction — those are the integration points `SyncBridge` wires up.

**This README is a pointer, not a tutorial.** The full cookbook — client wiring, server side via `@alaq/link/server`, CRDT schema setup, Vue integration, actions, reactive accessors, troubleshooting, and performance notes — lives in [`./RUNTIME.md`](./RUNTIME.md) (1112 lines, normative). Read it before building anything non-trivial.

## What this package gives you

- **`SyncStore`** — sparse reactive cache keyed by dot-paths. Uses `@alaq/deep-state` ghost proxies to mark un-fetched subtrees. Exposes `get(path)`, `applyPatch(path, value)`, and subscription plumbing the bridge uses.
- **`SyncNode<T>` (`ISyncNode<T>`)** — callable reactive primitive per path. Extends `IQ<T>` from `@alaq/quark`, so `up/down/value` work. Adds `$status`, `$error`, `$meta.isGhost`, `$meta.path`, `$release()`, plus internal `_get` / `_node` / `_act` for generated code.
- **`createSyncNode(store, path, initialProxy)`** — node factory. Called by `store.get()` and by generated facades.
- **`createListNode` / `SyncListNode`** — augments an `ISyncNode<T[]>` with `item(i)`, `at(i)`, `length`. Stable per-index nodes.
- **`createMapNode` / `SyncMapNode`** — same idea for `Record<string, T>` paths.
- **`SyncStatus` / `SyncStoreOptions` / `ISyncNode`** types for downstream consumers.

## What it does not do

- **No transport.** See [`@alaq/link`](../link) for hub, drivers, bridge, CRDT engine.
- **No Vue binding.** See [`@alaq/link-state-vue`](../link-state-vue).
- **No schema or codegen.** See [`@alaq/graph`](../graph) and [`@alaq/graph-link-state`](../graph-link-state).
- **No server side.** The server counterpart is `@alaq/link/server` (part of `@alaq/link`) plus generated dispatcher from [`@alaq/graph-link-server`](../graph-link-server).
- **No action definitions.** Action methods are added by the generator onto specific record nodes.

## Package layout

`src/store.ts` is `SyncStore`. `src/node.ts` is the `createSyncNode` factory and `ISyncNode` runtime. `src/list-node.ts` and `src/map-node.ts` are the per-entry accessor augmentations. `src/types.ts` defines `ISyncNode`, `SyncStatus`, and `SyncStoreOptions`. `src/index.ts` re-exports the public surface.

## Related packages

- [`@alaq/link`](../link) — transport, bridge, CRDT engine. Runtime sibling.
- [`@alaq/link-state-vue`](../link-state-vue) — Vue 3 `useNode` / `provideStore` / `useStore`.
- [`@alaq/graph-link-state`](../graph-link-state) — generator that emits typed facades (`IPlayer`, `PlayerNode`, `usePlayer`) over this runtime.
- [`@alaq/quark`](../quark) — the reactive primitive `ISyncNode` extends.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License. See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you `npm install @alaq/link-state`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run them.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to propose changes.
- [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — why v6 is shaped the way it is.

Issues: <https://github.com/carabins/alak/issues>.
