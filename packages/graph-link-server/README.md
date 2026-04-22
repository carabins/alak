# @alaq/graph-link-server

Generator: compiles `.aql` IR into TypeScript server-side scaffolding — a typed `ActionHandlers` interface plus a dispatcher ready to drop into `createLinkServer({ onAction })` from `@alaq/link/server`.

## Status

`6.0.0-alpha.0` — **unstable**. Emitted output shape and `GenerateOptions` move between alpha releases. Pin the generator version alongside `@alaq/graph`, `@alaq/link`, and the client-side [`@alaq/graph-link-state`](../graph-link-state).

## What it is

The server-side sibling of [`@alaq/graph-link-state`](../graph-link-state). Same IR from [`@alaq/graph`](../graph), same namespaces, different target: the output is TypeScript you pair with `@alaq/link/server` at consumer build time.

Per namespace, the generator emits a single self-contained `.ts` file containing:

1. Embedded `I<Record>` interfaces (records reachable from action I/O).
2. An `ActionContext` interface the runtime adapter implements (`broadcastToRoom`, `sendTo`, `peers`, etc.).
3. An `ActionHandlers` interface — one typed method per `action` in the schema.
4. A `createActionDispatcher(handlers)` that routes by action name, extracts scope parameters from the request path, and hands off to the right handler.

The output deliberately does **not** import from the client-side generated module. Each side stays self-contained so server deployments do not pull the client bundle.

Layer **L2 / alaqlink** in [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md). `.aql` is the single truth; this generator is the server-facing emitter of that truth.

## Install

```sh
bun add -d @alaq/graph-link-server @alaq/graph
```

```sh
npm install -D @alaq/graph-link-server @alaq/graph
```

Requires Node >=20 or Bun >=1.3. Runtime: [`@alaq/link`](../link) (the generated dispatcher plugs into `createLinkServer` from `@alaq/link/server`).

## Quickstart

Given this SDL:

```aql
schema Kotelok { version: 1, namespace: "kotelok" }

record Player { id: ID!, name: String! }

action JoinRoom @scope(name: "room") {
  input:  { name: String! }
  output: Player
}
```

Run the generator:

```ts
import { compileSources } from '@alaq/graph'
import { generate } from '@alaq/graph-link-server'

const { ir } = compileSources([{ path: 'players.aql', source }])
const { files } = generate(ir!)
// files[0] → { path: 'kotelok.server.generated.ts', content: '…' }
```

Expected output shape (abridged):

```ts
// kotelok.server.generated.ts
export interface IPlayer { id: string; name: string }

export interface ActionContext {
  readonly peerId: string
  broadcastToRoom(roomId: string, channel: string, data: unknown): void
  sendTo(peerId: string, channel: string, data: unknown): void
  // …
}

export interface ActionHandlers {
  joinRoom(
    ctx: ActionContext,
    roomId: string,              // ← scope parameter, named by default as `<scope>Id`
    input: { name: string },
  ): Promise<IPlayer>
}

export function createActionDispatcher(handlers: ActionHandlers) {
  return async (req: { action: string; path: string; args: unknown }, ctx: ActionContext) => {
    /* routes by req.action, extracts scope from req.path, calls handlers.* */
  }
}
```

Plug into the server:

```ts
import { createLinkServer } from '@alaq/link/server'
import { createActionDispatcher } from './generated/kotelok.server.generated'

const dispatcher = createActionDispatcher({
  async joinRoom(ctx, roomId, input) { /* … */ return player },
})

createLinkServer({ onAction: dispatcher, /* … */ })
```

`generate(ir, options)` is pure: no filesystem access, no network. The caller decides where to write `files[*].path`.

## What this package gives you

- **`generate(ir, options): GenerateResult`** — IR → server-side TypeScript.
- **`GenerateOptions`** — `namespace`, `runtimeImport` (default `@alaq/link/server`), `header`, `fileName`, `scopeParamName` (rename strategy for scope parameters; default `<scope>Id`).
- **Emitted surface per namespace:**
  - Embedded `enum`s and user scalar aliases.
  - Embedded `I<Record>` interfaces reachable from action I/O (no client-bundle import).
  - `ActionContext` interface.
  - `ActionHandlers` interface (one method per `action`).
  - `createActionDispatcher(handlers)` that routes and extracts scope params.
- Stable `GENERATOR_NAME` / `GENERATOR_VERSION` exports.
- Re-exports `IR`, `IRSchema`, `IRRecord`, `IRAction`.

## What it does not do

- **No client code.** See [`@alaq/graph-link-state`](../graph-link-state).
- **No Rust / native output.** See [`@alaq/graph-zenoh`](../graph-zenoh).
- **No server runtime.** The dispatcher is data; `createLinkServer` is in [`@alaq/link`](../link).
- **No action implementations.** You implement the `ActionHandlers` interface; the generator only emits the contract and routing glue.
- **Schemas with zero actions** emit a warning diagnostic and a stub (`export {}`) rather than an empty file — helps when callers accidentally pipe through a records-only namespace.

## Package layout

`src/index.ts` is the orchestrator. `src/handlers-gen.ts` emits embedded record interfaces and the `ActionHandlers` interface. `src/dispatcher-gen.ts` emits `createActionDispatcher`. `src/context-gen.ts` emits `ActionContext`. `src/emit.ts` holds headers / sections / the `GENERATOR_*` constants. `src/utils.ts` has `LineBuffer` and `buildTypeContext`.

## Related packages

- [`@alaq/graph`](../graph) — the SDL compiler that produces the IR this generator consumes.
- [`@alaq/link`](../link) — server runtime (`@alaq/link/server` / `createLinkServer`).
- [`@alaq/graph-link-state`](../graph-link-state) — client-side sibling generator.
- [`@alaq/graph-zenoh`](../graph-zenoh) — Rust / Zenoh sibling generator.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License. See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you `npm install @alaq/graph-link-server`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run them.
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to propose changes.
- [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md) — why v6 is shaped the way it is.

Issues: <https://github.com/carabins/alak/issues>.
