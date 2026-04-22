# @alaq/graph-zenoh

Generator: compiles `.aql` IR into a Rust module — serde structs, enums, topic constants, and `zenoh::Session`-backed publish / subscribe / request-reply helpers. For **Tier 2 (native)** consumers: Tauri, CLI tools, servers.

## Status

`6.0.0-alpha.0` — **unstable**. Emitted output shape, Rust API, and `GenerateOptions` move between alpha releases. Byte-level wire-parity with Sokol-Bus is deferred beyond v0.1 — the current output is a valid Rust module with the right topic shapes.

## What it is

The Rust / Zenoh target of the alaqlink stack. Same IR from [`@alaq/graph`](../graph) as the TypeScript generators, different emission: per namespace, a single `.rs` file you drop into a Cargo project.

Output sections, in order:

1. Banner + `use` imports (feature-gated on which directives the schema actually uses).
2. `pub mod topics` — topic-prefix constants derived from the schema.
3. User-defined scalars as `pub type X = String;`.
4. Enums with `#[serde(rename_all = "SCREAMING_SNAKE_CASE")]`.
5. Record structs with `#[derive(Serialize, Deserialize)]` and `impl` blocks carrying scope/CRDT/atomic metadata from directives.
6. Per-record `publish_<record>` / `subscribe_<record>` helpers over `zenoh::Session`.
7. Per-action `call_<action>` request/reply helpers.
8. Opaque streams — emitted as TODO comments with warnings (runtime support pending).
9. A trailing `Cargo.toml` suggestion block-comment.

Wire mapping is normative per `@alaq/graph` SPEC §11 for default-target implementations.

This generator targets **Tier 2** consumers per [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — native apps with `zenoh` as primary transport. It is **not** for browser code; use [`@alaq/graph-link-state`](../graph-link-state) there.

## Install

```sh
bun add -d @alaq/graph-zenoh @alaq/graph
```

```sh
npm install -D @alaq/graph-zenoh @alaq/graph
```

Requires Node >=20 or Bun >=1.3 (the generator itself runs in TS). Consumers of the emitted Rust depend on the `zenoh` crate (default `0.11`) and — conditional on directives in the schema — `serde_cbor` (for `@atomic`) and `automerge` (for `@crdt`).

## Quickstart

Given this SDL:

```aql
schema Kotelok { version: 1, namespace: "kotelok" }

record Player @scope(name: "room") {
  id: ID!
  name: String!
}
```

Run the generator:

```ts
import { compileSources } from '@alaq/graph'
import { generate } from '@alaq/graph-zenoh'

const { ir } = compileSources([{ path: 'players.aql', source }])
const { files } = generate(ir!, { zenohVersion: '0.11' })
// files[0] → { path: 'kotelok.rs', content: '…' }
```

Expected output shape (abridged):

```rust
// kotelok.rs
pub mod topics {
    pub const ROOM_PLAYER: &str = "kotelok/room/{roomId}/player/{id}";
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub name: String,
}

pub async fn publish_player(
    session: &zenoh::Session,
    room_id: &str,
    value: &Player,
) -> zenoh::Result<()> { /* … */ }

pub async fn subscribe_player(
    session: &zenoh::Session,
    room_id: &str,
) -> zenoh::Result<impl Stream<Item = Player>> { /* … */ }
```

`generate(ir, options)` is pure: no filesystem access, no network. The caller decides where to write `files[*].path`. Filenames use a namespace-safe form (dots in `core.identity` become underscores).

## What this package gives you

- **`generate(ir, options): GenerateResult`** — IR → Rust source files.
- **`GenerateOptions`** — `namespace`, `header`, `zenohVersion` (default `"0.11"`), `automerge` (default `true`, stubs in v0.1), `cbor` (default `true`).
- **Emitted per namespace:**
  - Topic-prefix constants.
  - User scalar aliases, enums, record structs with derives.
  - Impl blocks encoding `@scope`, `@crdt`, `@atomic` metadata.
  - Publish / subscribe helpers per record.
  - Request/reply helpers per action.
  - Cargo-dep suggestions in a trailing comment (feature-flagged on directives the schema actually uses).
- Stable `GENERATOR_NAME` / `GENERATOR_VERSION` exports.
- Re-exports `IR`, `IRSchema`, `IRRecord`, `IRAction`.

## What it does not do

- **Not for browsers.** Zenoh-WASM is a Tier-3 concern, out of scope.
- **No TypeScript output.** See [`@alaq/graph-link-state`](../graph-link-state) / [`@alaq/graph-link-server`](../graph-link-server).
- **No Cargo project scaffolding.** The generator emits one `.rs` per namespace plus a Cargo.toml *hint* in a footer comment; wiring into a crate is the consumer's job.
- **No runtime validation of `@crdt` semantics.** Automerge integration is stubs-only in v0.1.
- **Opaque streams are emitted as TODO comments** with a diagnostic and a planned topic (`<namespace>/stream/<name>`).
- A set of directives (`@auth`, `@store`, `@liveness`, `@range`, `@deprecated`, `@added`) is preserved as comments only in v0.1; a single advisory warning is emitted per kind.

## Package layout

`src/index.ts` is the orchestrator. `src/types-gen.ts` emits scalars, enums, and record structs. `src/publishers-gen.ts` emits pub/sub helpers. `src/actions-gen.ts` emits action request/reply helpers. `src/topics-gen.ts` emits the `topics` module. `src/emit.ts` holds headers / sections / the Cargo footer / the `GENERATOR_*` constants. `src/utils.ts` has `LineBuffer`, `buildTypeContext`, and `hasDirective`.

## Related packages

- [`@alaq/graph`](../graph) — the SDL compiler that produces the IR this generator consumes.
- [`@alaq/graph-link-state`](../graph-link-state) — client TypeScript sibling (browser-friendly).
- [`@alaq/graph-link-server`](../graph-link-server) — server TypeScript sibling.
- [`@alaq/graph-tauri`](../graph-tauri) *(planned)* — Rust + TS glue for Tauri v2 command pairs.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License. See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you `npm install @alaq/graph-zenoh`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run them.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to propose changes.
- [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — why v6 is shaped the way it is.

Issues: <https://github.com/carabins/alak/issues>.
