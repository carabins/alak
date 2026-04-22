# @alaq/graph-tauri

Generator: compiles `.aql` IR into a TypeScript module — `I<Record>`
interfaces, `I<Action>Input` types, plain typed wrappers over Tauri v2's
`invoke`, and a `createTauriApi()` root surface. For **Tauri v2 webview**
consumers calling into the Rust backend. Symmetric pair to
[`@alaq/graph-tauri-rs`](../graph-tauri-rs) (same IR, same `invoke` names,
same `{ input }` payload shape).

## Status

`6.0.0-alpha.0` — **unstable**. Output shape, method conventions, and
`GenerateOptions` move between alpha releases. Events and state are stubs
in v0.1 (await `IR.leadingComments` / P.1 in `@alaq/graph`).

## What it emits

One self-contained `.ts` file per namespace: `<namespace>.tauri.generated.ts`.
Sections, in order:

1. Header banner + `import { invoke } from '@tauri-apps/api/core'`.
2. Enums — TS `enum` per SDL enum.
3. User scalars — `export type X = string`.
4. `I<Record>` — readonly record interfaces.
5. `I<Action>Input` — one per action, always emitted (empty if no SDL input).
6. Action wrappers — `export async function <camelName>(input): Promise<Out>`.
7. `createTauriApi()` — root surface collecting every wrapper.
8. Events / state — STUB exports + `warning` diagnostic (placeholder until P.1).

### Conventions (normative for v0.1, agreed in C.1 + C.2)

- **Flat namespace.** `belladonna.reader` → `belladonna.reader.tauri.generated.ts`.
  Dots are preserved in the filename (every OS/bundler accepts them).
- **snake_case invoke name, camelCase export name.** `RenderMarkdown` →
  `export async function renderMarkdown(...)` invoking `render_markdown`.
  Single regex pipe (`([a-z0-9])([A-Z])` + `([A-Z]+)([A-Z][a-z])`) covers
  `HTTPSConnect` → `https_connect`, `V2Action` → `v2_action`, etc.
- **Payload shape.** `invoke('<snake>', { input: { ... } })` — Tauri v2
  wraps every argument object under a named key, and both this generator
  and `@alaq/graph-tauri-rs` agree the key is `input`. Bare arg-spreading
  (`invoke('x', { a, b })`) is **not** emitted.
- **Case-preservation.** Field names in `I<Record>` / `I<Action>Input` are
  snake_case verbatim from SDL — no `#[serde(rename_all = "camelCase")]`,
  no `rename` transform at the TS side. Matches the Rust-side generators.
- **Typed errors.** Invoke rejections surface whatever the Rust side
  serialises. `@alaq/graph-tauri-rs` emits `AppError` as
  `{ kind: '<variant>', message: '...' }` — TS callers get the raw
  rejection and can narrow by `kind` if needed. No generated `try/catch`
  wrapper in v0.1.
- **Output typing** (from IR v0.3.1 `outputList` / `outputListItemRequired`):
  - `output: [T!]!` → `Promise<I<T>[]>`
  - `output: T!`    → `Promise<I<T>>` (or `Promise<primitive>` for scalars)
  - no output       → `Promise<void>` (action awaits but discards)
- **`I<Action>Input` is always emitted.** Even when SDL declares zero input
  fields (`action Latest { output: ... }`) — `ILatestInput` is an empty
  interface. Keeps the call-site uniform and `createTauriApi()`
  stable-shape.
- **`@scope` is a no-op for Tauri.** Tauri IPC has no scope semantics (unlike
  `graph-link-state`, where scope drives `room.${id}` path fragments).
  Scoped actions emit a plain `invoke` like any other, with `scope` surfaced
  in a `// SDL:` comment only. See **О19** below.

### What it does NOT do (v0.1)

- **Events / streams.** `events-gen.ts` emits a placeholder
  `__eventsNotSupported()` export + `warning` diagnostic. Unblocked by P.1
  (`leadingComments` + `# @event: Name` marker).
- **State / nucl atoms.** `state-gen.ts` emits `__stateNotSupported()` stub
  + `warning` diagnostic. Rust-backed reactive state is wired manually via
  `@alaq/plugin-tauri` `tauriPlugin(...)` in v0.1.
- **Opaque streams.** Emitted as a per-stream `warning`, no code.
- **Transport tree-shaking hints** (`@local`, `@transport`, etc.) — deferred.

## Install

```sh
bun add -d @alaq/graph-tauri @alaq/graph
```

```sh
npm install -D @alaq/graph-tauri @alaq/graph
```

Requires Node >=20 or Bun >=1.3 (the generator itself runs in TS). The
generated `.ts` file imports `invoke` from `@tauri-apps/api/core`; your app
must have `@tauri-apps/api` as a runtime dependency (declared as a peer in
this package's `package.yaml`):

```sh
bun add @tauri-apps/api
```

## Quickstart

Given this SDL:

```aql
schema Belladonna { version: 1, namespace: "belladonna.reader" }

record RenderedDoc {
  html: String!
  filename: String!
}

action RenderMarkdown {
  input:  { path: String! }
  output: RenderedDoc
}
```

Run the generator:

```ts
import { parseSource } from '@alaq/graph'
import { generate } from '@alaq/graph-tauri'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const { ir } = parseSource(source, 'reader.aql')
if (!ir) throw new Error('parse failed')

const { files, diagnostics } = generate(ir)
for (const f of files) {
  const p = join('ui/src/generated', f.path)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, f.content)
}
// files[0] → { path: 'belladonna.reader.tauri.generated.ts', content: '…' }
```

Expected output (abridged):

```ts
// belladonna.reader.tauri.generated.ts
import { invoke } from '@tauri-apps/api/core'

export interface IRenderedDoc {
  readonly html: string
  readonly filename: string
}

export interface IRenderMarkdownInput {
  readonly path: string
}

export async function renderMarkdown(
  input: IRenderMarkdownInput,
): Promise<IRenderedDoc> {
  return invoke<IRenderedDoc>('render_markdown', { input })
}

export function createTauriApi() {
  return {
    renderMarkdown: (input: IRenderMarkdownInput) => renderMarkdown(input),
  }
}
```

`generate(ir, options)` is pure: no filesystem access, no network. The
caller decides where to write `files[*].path`.

## Consuming generated code

### Runtime dependency

The emitted module imports `invoke` directly from `@tauri-apps/api/core`.
Add the Tauri API package to your webview project:

```sh
bun add @tauri-apps/api
```

No `@alaq/*` runtime package is required — the generated file has no other
imports. This is intentional: a generator consumer who only needs typed
`invoke` wrappers should not be forced to install the Nucl plugin.

### Import site

```ts
// Top of your Reader-View component / store:
import {
  renderMarkdown,
  createTauriApi,
  type IRenderedDoc,
} from './generated/belladonna.reader.tauri.generated'

const api = createTauriApi()
const doc: IRenderedDoc = await api.renderMarkdown({ path: '/abs/file.md' })
```

### `pluginImport` override

If you want to route `invoke` through a proxy (e.g. for Logi tracing, or
to use a fake IPC in dev-browser mode), pass `pluginImport`:

```ts
generate(ir, { pluginImport: '@alaq/plugin-tauri/ipc' })
```

**Caveat:** as of v0.1, `@alaq/plugin-tauri` does **not** re-export `invoke`
under an `/ipc` subpath — `index.ts` exports `tauriPlugin`, `createRealIPC`,
`hasTauri`, `createFakeIPC` only. The option is kept as an escape hatch;
the default (`@tauri-apps/api/core`) is what actually works in v0.1. See
**О18** below for tracking.

### Pair with `@alaq/graph-tauri-rs`

For Rust-side `#[tauri::command]` handlers symmetric to this TS generator,
use [`@alaq/graph-tauri-rs`](../graph-tauri-rs). Both consume the same IR
and agree on invoke names, field-case, payload shape, and output
list/scalar mapping. A `reader.aql` regenerated through both produces a
TS wrapper calling `invoke('render_markdown', { input: ... })` and a Rust
delegator receiving `RenderMarkdownInput` — drop-in compatible without
manual glue.

## `GenerateOptions`

```ts
export interface GenerateOptions {
  /** Target one namespace. Default: emit every namespace. */
  namespace?: string

  /** Emit the AUTOGENERATED banner. Default: true. */
  header?: boolean

  /**
   * Module specifier the generated file imports `invoke` from.
   * Default: '@tauri-apps/api/core'.
   *
   * As of v0.1, `@alaq/plugin-tauri` does not re-export `invoke` under an
   * `/ipc` subpath — use the default unless you have a custom proxy
   * module. See О18.
   */
  pluginImport?: string
}
```

## Package layout

`src/index.ts` is the orchestrator. `src/enums-gen.ts` / `types-gen.ts` /
`actions-gen.ts` / `api-gen.ts` emit per-section. `src/events-gen.ts` and
`src/state-gen.ts` emit v0.1 stubs. `src/emit.ts` holds the header /
section dividers / `GENERATOR_NAME` / `GENERATOR_VERSION` constants.
`src/utils.ts` has `LineBuffer`, `buildTypeContext`, `snakeCase`, and
`mapActionOutputType`.

## Open design questions

Tracked in [`../../stress.md`](../../stress.md):

- **О18** — should `@alaq/plugin-tauri` add a `/ipc` subpath re-exporting
  `invoke` (with graceful fake-IPC fallback + Logi bridge)? Would shift
  the default `pluginImport`. Overlaps with О5.
- **О19** — scoped actions in Tauri generators: no-op as now, emit an
  advisory warning, or reject `@scope` at the validator level for
  `.tauri.aql` targets?
- **О21** — `GENERATOR_VERSION` drifts from `package.yaml` version across
  sister generators (`graph-tauri`, `graph-tauri-rs`, `graph-axum`). Auto-
  generate from `package.yaml` on build, or leave manual until out of
  alpha/draft.
- **О23** — `Map<K, V>` with nullable inner types: emit a warning from
  `@alaq/graph` (shared across all generators) vs. SPEC §4.2 example
  vs. nothing.

## Related packages

- [`@alaq/graph`](../graph) — the SDL compiler that produces the IR this
  generator consumes.
- [`@alaq/graph-tauri-rs`](../graph-tauri-rs) — Rust-side sibling generator
  (trait + `#[tauri::command]` delegators + `register_<ns>_commands!`).
- [`@alaq/graph-axum`](../graph-axum) — HTTP-side sibling generator
  (axum router, same snake_case + `Json<Input>` convention).
- [`@alaq/graph-link-state`](../graph-link-state) — client-side generator
  for the Zenoh-backed reactive stack.
- [`@alaq/plugin-tauri`](../plugin-tauri) — Nucl plugin wrapping Tauri IPC
  (separate concern from this generator; optional peer dep).

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License.
  See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you
  `npm install @alaq/graph-tauri`) are distributed under **Apache-2.0**.

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
