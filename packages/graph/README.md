# @alaq/graph

SDL compiler for the alaqlink stack. Parses `.aql` schemas into a typed IR with stable diagnostic codes. Zero runtime dependencies.

## Status

`6.0.0-alpha.0` — **unstable**. Breaking changes to the IR shape, directive set, and diagnostic codes are expected before 6.0.0 GA. Pin exact versions and treat alpha-to-alpha upgrades as source-breaking.

## What it is

`@alaq/graph` is the front half of the alaqlink toolchain: a lexer, parser, linker, IR builder, and validator for the `.aql` schema definition language. It takes a set of source files and emits a single merged, typed intermediate representation plus a list of diagnostics. That's the entire surface.

It does not generate code, speak a transport, or touch a network. Downstream generators (see below) consume the IR independently. The compiler is platform-neutral — it runs in Node, Bun, and the browser.

The `why` of the stack lives in [`../../PHILOSOPHY.md`](../../PHILOSOPHY.md). The normative SDL definition lives in [`./SPEC.md`](./SPEC.md). This README is a pointer, not a tutorial.

## Install

```sh
bun add @alaq/graph
```

```sh
npm install @alaq/graph
```

Requires Node >=20 or Bun >=1.3.

## Quickstart

### Single source

```ts
import { parseSource } from '@alaq/graph'

const source = `
schema Kotelok {
  version: 1
  namespace: "kotelok"
}

record Player {
  id: ID!
  name: String!
  avatar: String
  myWords: [String!]! @auth(read: "owner")
}
`

const { ir, diagnostics } = parseSource(source, 'players.aql')

const errors = diagnostics.filter(d => d.severity === 'error')
if (errors.length) {
  // Each diagnostic is { code, severity, message, file?, line, column }
  console.error(errors)
} else {
  // ir.schemas['kotelok'].records['Player'] is the parsed record.
  console.log(Object.keys(ir!.schemas))
}
```

### Multi-file

```ts
import { compileSources } from '@alaq/graph'

const { ir, diagnostics, files } = compileSources([
  { path: 'identity.aql', source: identitySrc },
  { path: 'players.aql',  source: playersSrc  },
  { path: 'lobby.aql',    source: lobbySrc    },
])
```

`compileSources` is pure — no filesystem access. For disk-backed compilation use the `compileFiles(paths)` wrapper. Both return the same `CompileResult` shape: merged `ir`, combined `diagnostics`, and a `files` map of per-file IR keyed by input path.

## What this package gives you

- Lexer and parser for `.aql` source.
- Linker that merges multiple files under a shared namespace (including `extend record` across files).
- IR builder — a stable, transport-neutral intermediate representation.
- Validator with semantic checks (directive arity, scope/QoS rules, `use` resolution, identifier shape).
- Diagnostics as structured JSON with stable error codes.
- TypeScript types for every IR node (`IR`, `IRRecord`, `IRAction`, `IRDirective`, ...).

## What this package does not do

- No code generation. Generators are separate packages:
  - [`@alaq/graph-link-state`](../graph-link-state) — reactive state bindings.
  - [`@alaq/graph-link-server`](../graph-link-server) — server-side handler scaffolding.
  - [`@alaq/graph-zenoh`](../graph-zenoh) — Zenoh transport bindings.
- No runtime transport. That lives in [`@alaq/link`](../link) and the generators above.
- No schema extraction from TS source. Schemas are authored in `.aql`, not inferred from code. This is intentional — see `PHILOSOPHY.md` §7.

## Diagnostics

Every diagnostic carries a stable code. Errors are `E001`–`E022`, warnings are `W001`–`W004`. Codes do not get reused across versions; if a check is retired, its code is retired with it. The catalog — with message templates, trigger conditions, and examples — lives in [`./SPEC.md`](./SPEC.md) §12.

Consumers should treat `d.code` as the stable key for programmatic handling. The `d.message` field is human-readable and may be reworded between patch releases.

## SDL specification

[`./SPEC.md`](./SPEC.md) is the single source of truth for the `.aql` language: grammar (EBNF), type system, directive catalog, module semantics, IR schema, validation rules, and the diagnostic catalog. It is normative. If the compiler disagrees with `SPEC.md`, the compiler is wrong — file an issue.

## AI tooling

[`@alaq/mcp`](../mcp) exposes this compiler through the Model Context Protocol. Agents can parse, lint, and diff schemas without shelling out. Diagnostics are emitted as machine-readable JSON with the same stable codes — that's the whole point of keeping them stable.

## Package layout

`src/` contains the pipeline stages as flat modules: `lexer.ts` → `parser.ts` → `linker.ts` → `ir.ts` → `validator.ts`. `errors.ts` holds the diagnostic factory and message templates. `types.ts` defines the public IR and diagnostic types. `index.ts` is the thin orchestrator that wires the stages into `parseSource`, `compileSources`, and `compileFiles`.

## License

This is a deliberate dual-license setup, not an oversight:

- **Source code in this repository** is licensed under the TVR License. See [`../../LICENSE`](../../LICENSE) at the repo root.
- **Published npm artifacts** (what you get when you `npm install @alaq/graph`) are distributed under **Apache-2.0**.

If you consume the package from npm, Apache-2.0 applies. If you fork or vendor the source from GitHub, TVR applies. Do not conflate the two.

## Contributing

- [`../../AGENTS.md`](../../AGENTS.md) — conventions for agents and humans working in this repo.
- [`../../CHECK.md`](../../CHECK.md) — pre-commit checks and how to run them.

Issues: <https://github.com/carabins/alak/issues>.
