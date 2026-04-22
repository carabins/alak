# @alaq/link-state-vue

Vue 3 adapter for [`@alaq/link-state`](../link-state). Bridges `ISyncNode<T>` into Vue's reactivity and shares a `SyncStore` via provide/inject.

## Status

`6.0.0-alpha.0` — **unstable**. Surface is small and intentionally thin, but follows the alpha cadence of its runtime sibling.

## What it is

A minimal, ~4-file Vue 3 adapter that turns a `SyncNode` into a `Ref` with automatic cleanup on scope disposal. It also provides the canonical pattern for passing a `SyncStore` down a component tree.

Layer L2 in [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md). The non-Vue part of the stack does not depend on this package — it stays Vue-free so non-Vue consumers don't pull a UI framework.

## Install

```sh
bun add @alaq/link-state-vue
```

```sh
npm install @alaq/link-state-vue
```

Requires Node >=20 or Bun >=1.3. **Peer dependency:** `vue ^3`. `@alaq/link-state` is also required (that's where `SyncStore` and `ISyncNode` come from).

## Quickstart

```vue
<!-- App.vue — wire the store once, high in the tree -->
<script setup lang="ts">
import { SyncStore } from '@alaq/link-state'
import { provideStore } from '@alaq/link-state-vue'

const store = new SyncStore()
provideStore(store)
</script>
```

```vue
<!-- PlayerCard.vue — read a node as a Ref -->
<script setup lang="ts">
import { useNode, useStore } from '@alaq/link-state-vue'

const store = useStore()
const player = useNode(store.get('player.42'))
// player.value: T | undefined — updates when the store path changes.
</script>

<template>
  <div v-if="player">{{ player.name }}</div>
  <div v-else>loading…</div>
</template>
```

For a value that is never `undefined` in templates, use `useNodeWithDefault(node, fallback)`. For non-Vue contexts (workers, tests) use `toRefNoScope(node)`, which returns `{ ref, release }` and leaves lifecycle to you.

## What this package gives you

- **`useNode(node)`** — `Ref<T | undefined>`. Auto-unsubscribes on `onScopeDispose`. Throws if called outside a Vue scope.
- **`useNodeWithDefault(node, defaultValue)`** — `Ref<T>`. Substitutes `defaultValue` whenever the node is ghost / pending / nullish.
- **`toRefNoScope(node)`** — `{ ref, release }` for manual lifecycle outside a Vue scope.
- **`provideStore(store)`** / **`useStore()`** — provide/inject pair over a fixed `InjectionKey<SyncStore>`.
- **`SYNC_STORE_KEY`** — the exported key, for advanced cases where the default flow is not enough.
- Types: `UseNodeOptions`, `ScopedNodeRef<T>`, plus re-exports of `Ref` and `ISyncNode`.

## What it does not do

- **No SyncStore.** Construction lives in `@alaq/link-state`; this package only adapts it.
- **No transport.** See [`@alaq/link`](../link).
- **No React / Svelte / Solid equivalents.** Those would be separate adapters with the same shape.
- **No router or store-of-stores abstraction.** `provideStore` wires exactly one `SyncStore`; apps that need more should compose.

## Package layout

`src/use-node.ts` — the three composables. `src/use-store.ts` — `provideStore` / `useStore` / `SYNC_STORE_KEY`. `src/types.ts` — `UseNodeOptions`, `ScopedNodeRef`, re-exports. `src/index.ts` — barrel.

## Related packages

- [`@alaq/link-state`](../link-state) — `SyncStore` and `SyncNode<T>` (runtime sibling).
- [`@alaq/link`](../link) — transport.
- [`@alaq/graph-link-state`](../graph-link-state) — generator; with `vue: true` it emits typed `use<Record>` composables that call into this package.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License. See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you `npm install @alaq/link-state-vue`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run them.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to propose changes.
- [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — why v6 is shaped the way it is.

Issues: <https://github.com/carabins/alak/issues>.
