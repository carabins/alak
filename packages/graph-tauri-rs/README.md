# @alaq/graph-tauri-rs

Generator: compiles `.aql` IR into a set of Rust files for a **Tauri v2**
application — serde types, an `#[async_trait] trait <Ns>Handlers`, thin
`#[tauri::command]` delegators, and a `register_<ns>_commands!` macro that
expands into `tauri::generate_handler![...]`. For **desktop/mobile** consumers
embedding the generated code into `src-tauri/`.

## Status

`6.0.0-alpha.0` — **unstable**. Output shape, method conventions, and
`GenerateOptions` move between alpha releases. Events are a stub in v0.1
(await `IR.leadingComments` / P.1 in `@alaq/graph`).

## What it emits

One subdirectory per namespace, containing six `.rs` files:

```
belladonna_reader/
├── mod.rs         pub mod + re-exports
├── types.rs       user scalars, enums, records, <Action>Input,
│                  + `pub use alaq_graph_tauri_rt::AppError;`
├── handlers.rs    #[async_trait] pub trait <Ns>Handlers
├── commands.rs    #[tauri::command] adapters delegating to handlers
├── register.rs    #[macro_export] register_<ns>_commands!()
└── events.rs      STUB — awaits IR leadingComments (P.1)
```

### Conventions (normative for v0.1)

- **Flat namespace.** `belladonna.reader` → `belladonna_reader/`.
  Non-alphanumerics collapse to `_` so the path is Rust-safe.
- **snake_case invoke names.** `RenderMarkdown` → `invoke('render_markdown', …)`.
  Matches the pair-generator `@alaq/graph-tauri` (C.1 / C.2 convention).
  No `#[serde(rename_all = "camelCase")]` — SDL field names already travel
  as snake through the stack.
- **One `Input` struct per action.** `<Action>Input` is emitted for every
  action, even when SDL declares no input fields (a `Default`-able empty
  struct). Keeps handler signatures uniform. The TS caller wraps as
  `{ input: { … } }` per Tauri v2 convention.
- **Trait DI.** The user implements `<Ns>Handlers` once per application and
  registers `Arc<dyn <Ns>Handlers>` into Tauri state. The generated
  delegator pulls it via `State<'_, Arc<dyn …>>`.
- **AppHandle forwarded.** Every trait method takes `&tauri::AppHandle` so
  handlers can touch windows / state / plugins without hard-wiring a
  concrete struct layout.
- **Typed errors.** Handlers return `Result<T, AppError>` where `AppError`
  is the single canonical enum defined in
  [`alaq-graph-tauri-rt`](../../crates/alaq-graph-tauri-rt/src/error.rs)
  (`Handler` / `BadInput` / `Unavailable` / `Internal`). It serialises as
  `{ "kind": "<variant>", "message": "…" }` through Tauri v2's serde
  return-type handling. The generator **does not** emit `AppError` into
  `types.rs`; instead it emits `pub use alaq_graph_tauri_rt::AppError;`
  so a single definition serves every namespace across the app (C3). The
  runtime crate is therefore a **required** dependency of consumer apps
  (not merely optional, as in earlier revisions).
- **Output typing** (from IR v0.3.1 `outputList` / `outputListItemRequired`):
  - `output: [T!]!` → `Vec<T>`
  - `output: T!`    → `T`
  - no output       → `()` (fire-and-forget action)
- **Register macro, not function.** `tauri::generate_handler!` consumes its
  arguments at macro-expansion time, so forwarding through a plain function
  is not possible. Users write
  `.invoke_handler(register_belladonna_reader_commands!())` in their
  `Builder::default()` chain.

### What it does NOT do (v0.1)

- **Events / streams.** Await `leadingComments` in IR (P.1 in `@alaq/graph`).
  `events.rs` is emitted as a stub so `pub mod events;` in `mod.rs` still
  compiles.
- **Handler impls.** You write those yourself. The generator only emits
  the trait.
- **Cargo.toml generation.** The consumer wires up `tauri`, `serde`,
  `async-trait`, and optionally `alaq-graph-tauri-rt` manually.
- **Directive-aware codegen** beyond preserving selected directives as
  doc comments (`@auth`, `@store`, `@liveness`, `@deprecated`, `@added`,
  `@scope`, …) and surfacing a `warning` diagnostic per first-seen
  preserved directive.

## Install

```sh
bun add -d @alaq/graph-tauri-rs @alaq/graph
```

The generated Rust code expects these crates in the consumer's `Cargo.toml`:

```toml
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
async-trait = "0.1"
# required — canonical `AppError` lives here (C3); generated `types.rs`
# contains `pub use alaq_graph_tauri_rt::AppError;`
alaq-graph-tauri-rt = { path = "<workspace>/crates/alaq-graph-tauri-rt" }
```

## Quickstart

```ts
import { parseSource } from '@alaq/graph'
import { generate } from '@alaq/graph-tauri-rs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const src = readFileSync('schema/reader.aql', 'utf8')
const { ir, diagnostics } = parseSource(src, 'reader.aql')
if (!ir) throw new Error(diagnostics.map(d => d.message).join('\n'))

const out = generate(ir)
for (const f of out.files) {
  const p = join('src-tauri/src', f.path)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, f.content)
}
```

Then in your Rust crate (`src-tauri/src/lib.rs` or `main.rs`):

```rust
mod generated;
use std::sync::Arc;
use generated::belladonna_reader::{BelladonnaReaderHandlers, AppError};

struct MyHandlers;

#[async_trait::async_trait]
impl BelladonnaReaderHandlers for MyHandlers {
    async fn render_markdown(
        &self,
        _app: &tauri::AppHandle,
        input: generated::belladonna_reader::RenderMarkdownInput,
    ) -> Result<generated::belladonna_reader::RenderedDoc, AppError> {
        // … your implementation
        todo!()
    }
    // … one async fn per SDL action
}

fn main() {
    let handlers: Arc<dyn BelladonnaReaderHandlers> = Arc::new(MyHandlers);
    tauri::Builder::default()
        .manage::<Arc<dyn BelladonnaReaderHandlers>>(handlers)
        .invoke_handler(register_belladonna_reader_commands!())
        .run(tauri::generate_context!())
        .expect("tauri run");
}
```

## `GenerateOptions`

```ts
export interface GenerateOptions {
  namespace?: string               // default: emit every namespace
  header?: boolean                 // default: true — AUTOGENERATED banner
  rtCrate?: string                 // default: "alaq_graph_tauri_rt"
                                   //          (reserved for future use)
  handlersMode?: 'trait'           // v0.1 only supports 'trait'
                                   // 'functions' returns an error diagnostic
}
```

## Pair with `@alaq/graph-tauri`

For TS-side `invoke`-wrappers symmetric to this generator, use
[`@alaq/graph-tauri`](../graph-tauri). Both generators consume the same IR
and agree on `invoke` names, field-case, and `{ input: … }` payload shape.

## Consuming generated code

### Atomic migration from hand-written `#[tauri::command]` (E0428)

`#[tauri::command]` expands into a hidden `__cmd__<fn_name>` item at the
**crate root**. If you currently have a hand-rolled
`#[tauri::command] async fn render_markdown(...)` in `commands/reader.rs`
and introduce the generator's `commands::render_markdown` in the same
crate, `rustc` rejects the build with **E0428 "the name
`__cmd__render_markdown` is defined multiple times"**. This is a Tauri
macro limitation, not a bug in this generator.

**Consequence:** migration from hand-rolled commands to generated commands
must be **atomic within a single commit**. You cannot migrate "one command
at a time" while keeping the old ones — the names collide at the crate
level.

Migration shape (one commit):

1. Delete every hand-rolled `#[tauri::command]` function whose name matches
   an SDL action (e.g. remove `commands::reader::render_markdown` entirely,
   not just its body).
2. Add `mod generated;` in `lib.rs` / `main.rs` pointing at the generator
   output.
3. Write `impl <Ns>Handlers for MyHandlers { ... }` — one `async fn` per
   action, same count as you deleted in step 1.
4. Replace your old `tauri::generate_handler![cmd1, cmd2, ...]` call with
   `register_<ns>_commands!()` in the `Builder::default()` chain.

If you need a partial migration (e.g. feature-flag a new path), rename
either the SDL action (`RenderMarkdownV2`) or move one side to a separate
crate — the collision is per-crate. See **О22** below for whether the
generator should detect this at build time.

### Compile-smoke without a full consumer crate

A pattern that works for CI: drop a test file in
`crates/alaq-graph-tauri-rt/tests/smoke_<consumer>.rs` that pulls the
generated tree via `#[path]` attributes:

```rust
// tests/smoke_belladonna.rs
#[path = "../../../../../pharos/Belladonna/src-tauri/src/generated/belladonna_reader/mod.rs"]
mod belladonna_reader;

#[test]
fn types_check() {
    // Referencing one exported symbol is enough —
    // `cargo check --tests` will type-check the whole module.
    let _: Option<belladonna_reader::RenderMarkdownInput> = None;
}
```

Runs as part of `cargo test -p alaq-graph-tauri-rt`. If SDL → Rust breaks,
CI of the runtime crate catches it before the consumer app tries to
compile. Works on Windows — `#[path]` with `..` segments resolves against
the test file's directory (unlike the `#[path]`-in-nested-mod edge case
in `@alaq/graph-axum`, O20).

## Open design questions

Tracked in [`../../stress.md`](../../stress.md):

- **О22** — should the generator (or `@alaq/graph` validator) detect
  `#[tauri::command]` name collisions? Only visible at Rust-linker level
  (E0428). Alternative: namespace-prefix generated commands
  (`invoke('belladonna_reader__render_markdown', ...)`) — breaks UX
  symmetry with `@alaq/graph-tauri`. For v0.1: documented-as-convention
  ("one command name per crate; migration is atomic").
- **О23** — `Map<K, V>` with nullable inner types emits
  `HashMap<Option<K>, Option<V>>`. Semantically rare; likely a user
  oversight. Options: (a) leave as-is + SPEC §4.2 example, (b) change IR
  default for Map-inner to required (breaking), (c) emit a generator
  warning. Leaning toward (c) via shared helper in `@alaq/graph`.
- **О24** — `@deprecated` → `#[deprecated]` native mapping in v0.2.
  SDL `@deprecated(since: "1.2.0", reason: "use X")` maps cleanly onto
  Rust `#[deprecated(since = "1.2.0", note = "use X")]`. Open: arg-name
  unification vs per-target translation.
- **О21** — `GENERATOR_VERSION` const drifts from `package.yaml` version
  across sister generators. Auto-generate on build vs leave manual until
  out of alpha/draft.

## Related packages

- [`@alaq/graph`](../graph) — the SDL compiler producing the IR this
  generator consumes.
- [`@alaq/graph-tauri`](../graph-tauri) — TS-side sibling generator
  (`invoke` wrappers, same IR, same `{ input }` payload).
- [`@alaq/graph-axum`](../graph-axum) — HTTP-side sibling generator (axum
  router, same snake_case convention).
- [`alaq-graph-tauri-rt`](../../crates/alaq-graph-tauri-rt) — optional
  Rust runtime crate with `BasicAppError` and `HandlerExt` helpers
  consumable from the generated output.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License.
  See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you
  `npm install @alaq/graph-tauri-rs`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or
vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans
  working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run
  them.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to propose
  changes.
- [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — why v6 is shaped the way
  it is.

Issues: <https://github.com/carabins/alak/issues>.
