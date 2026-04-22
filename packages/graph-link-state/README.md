# @alaq/graph-link-state

Generator: compiles `.aql` IR into TypeScript — typed record interfaces, `SyncNode<T>` facades, action methods, and (opt-in) Vue composables over [`@alaq/link-state`](../link-state).

## Status

`6.0.0-alpha.0` — **unstable**. Emitted output shape, directive handling, and `GenerateOptions` move between alpha releases. Pin the generator version alongside `@alaq/graph` and `@alaq/link-state`; regenerate on every upgrade.

## What it is

The client-side generator of the alaqlink stack. It reads an `IR` from [`@alaq/graph`](../graph) and emits a single self-contained `.ts` file per namespace: `I<Record>` interfaces, `<Record>Node` facades wrapping `ISyncNode`, unscoped action wrappers, a root API factory, optional Vue `use<Record>` composables, and an optional CRDT `FieldSchema` const for `SyncBridge`.

The package is transport-neutral. Wire-specific behavior — Zenoh topics, Rust types, Tauri bridges — lives in sibling generators (`@alaq/graph-zenoh`, `@alaq/graph-tauri`). This one targets the TypeScript runtime in `@alaq/link-state`.

It sits in **L2 / alaqlink** per [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md). `.aql` is the single truth (Principle 1); this generator is one of the valid emitters of that truth.

## Install

```sh
bun add -d @alaq/graph-link-state @alaq/graph
```

```sh
npm install -D @alaq/graph-link-state @alaq/graph
```

Requires Node >=20 or Bun >=1.3. Runtime dependency at consumer build time: [`@alaq/link-state`](../link-state) (and [`@alaq/link-state-vue`](../link-state-vue) if you opt into `vue: true`).

## Quickstart

Given this SDL:

```aql
schema Kotelok { version: 1, namespace: "kotelok" }

record Player {
  id: ID!
  name: String!
  avatar: String
}
```

Run the generator:

```ts
import { compileSources } from '@alaq/graph'
import { generate } from '@alaq/graph-link-state'

const { ir } = compileSources([{ path: 'players.aql', source }])
const { files } = generate(ir!, { vue: true })
// files[0] → { path: 'kotelok.generated.ts', content: '…' }
```

Expected output shape (abridged):

```ts
// kotelok.generated.ts
export interface IPlayer {
  id: string
  name: string
  avatar?: string | null
}

export interface PlayerNode extends ISyncNode<IPlayer> {
  readonly $id: ISyncNode<string>
  readonly $name: ISyncNode<string>
  readonly $avatar: ISyncNode<string | null | undefined>
}

// Vue composable (only with { vue: true }):
export function usePlayer(id: string): { player: Ref<IPlayer | undefined> /* … */ }

// CRDT schema for SyncBridge (only with { crdtSchema: true }, the default):
export const kotelokSchema: Record<string, FieldSchema> = { /* … */ }
```

The `generate(ir, options)` function is pure: no filesystem access, no network. The caller decides where to write `files[*].path`.

## What this package gives you

- **`generate(ir, options): GenerateResult`** — IR → TypeScript source files.
- **`GenerateOptions`** — `namespace`, `runtimeImport`, `quarkImport`, `header`, `splitFiles` (reserved), `vue`, `vueImport`, `crdtSchema`, `fieldSchemaImport`.
- **Emitted surface per namespace:**
  - `I<Record>` TypeScript interfaces (with JSDoc for `@range`, `@auth`, `@deprecated`).
  - `<Record>Node` facades — `ISyncNode<IRecord>` with per-field `$<name>` sub-node getters and (where applicable) action methods.
  - Unscoped action function wrappers.
  - A root API factory keyed off a `SyncStore`.
  - **Optional:** `use<Record>` / `use<Record>InScope` Vue composables (`vue: true`).
  - **Optional:** `<namespace>Schema: Record<string, FieldSchema>` for `new SyncBridge({ schema })` (`crdtSchema: true`, default).
- Stable `GENERATOR_NAME` / `GENERATOR_VERSION` exports for test assertions.
- Re-exports `IR`, `IRSchema`, `IRRecord`, `IRAction` for "generator of generators" composition.

## What it does not do

- **No server code.** Action handlers are the job of [`@alaq/graph-link-server`](../graph-link-server). The client output calls into `_act` on a node — server wiring emits the dispatcher.
- **No Rust / native output.** See [`@alaq/graph-zenoh`](../graph-zenoh).
- **No schema parsing.** Bring your own IR from [`@alaq/graph`](../graph).
- **No runtime.** The generated code imports `@alaq/link-state` (and `@alaq/link-state-vue` with `vue: true`) — install those separately.
- **Opaque streams are emitted as TODO comments** with a diagnostic. v0.1 has no runtime contract for them yet.
- A small set of directives (`@store`, `@liveness`, `@added`, `@topic`) is preserved as comments only; a single advisory warning is emitted per kind.

## Package layout

`src/index.ts` is the orchestrator. `src/enums-gen.ts` / `types-gen.ts` / `nodes-gen.ts` / `actions-gen.ts` / `api-gen.ts` / `vue-gen.ts` / `crdt-schema-gen.ts` are the per-section emitters. `src/emit.ts` holds headers / section dividers / the `GENERATOR_*` constants. `src/utils.ts` has `LineBuffer` and `buildTypeContext`.

## Related packages

- [`@alaq/graph`](../graph) — the SDL compiler that produces the IR this generator consumes.
- [`@alaq/link-state`](../link-state) — runtime target (`SyncStore`, `SyncNode`).
- [`@alaq/link-state-vue`](../link-state-vue) — Vue composables the `vue: true` output calls into.
- [`@alaq/graph-link-server`](../graph-link-server) — server-side sibling generator.
- [`@alaq/graph-zenoh`](../graph-zenoh) — Rust / Zenoh sibling generator.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License. See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you `npm install @alaq/graph-link-state`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run them.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to propose changes.
- [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — why v6 is shaped the way it is.

Issues: <https://github.com/carabins/alak/issues>.
