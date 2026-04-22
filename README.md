# alak

> A reactive TypeScript ecosystem designed so an LLM agent is a first-class consumer.

**Status:** `6.0.0-alpha.0`. Surface may shift until `6.0.0` GA. SDL semantics in `packages/graph/SPEC.md` v0.3 is stable.

## What alak is

alak is a monorepo of small packages that together cover reactive state, wire protocols, and AI tooling for distributed TypeScript applications. The ecosystem is organised into **6 layers, 25 packages** (see `architecture.yaml`):

- **L0 Frontdoor** — `alaq` — the single entry; prints a capability manifest for agents.
- **L1 AI tooling** — `@alaq/mcp` — MCP stdio server: compile SDL, diff schemas, observe a live runtime.
- **L2 alaqlink** — `@alaq/graph` (SDL → IR) plus target generators (`graph-link-state`, `graph-link-server`, `graph-zenoh`, `graph-axum`, `graph-tauri`, `graph-tauri-rs`) and the transport (`link`, `link-state`, `link-state-vue`).
- **L3 Reactive core** — `@alaq/quark`, `@alaq/nucl`, `@alaq/atom`, `@alaq/fx`.
- **L4 Plugins** — `@alaq/plugin-logi`, `@alaq/plugin-idb`, `@alaq/plugin-tauri`.
- **L5 Utilities** — `@alaq/rune`, `@alaq/bitmask`, `@alaq/datastruct`, `@alaq/queue`, `@alaq/deep-state`, `@alaq/xstate`.

**alaqlink** (L2) is one track inside v6: SDL + codegen + runtime sync. The other layers exist independently — you can consume just `@alaq/quark` or just `@alaq/atom` without touching SDL.

## Central concepts

- **SDL is the single truth.** `.aql` schemas are authored once; types, wire shapes, CRDT semantics, and handlers are generated. Closed directive set in `packages/graph/SPEC.md §7`.
- **MCP is the AI interface.** `@alaq/mcp` exposes `schema_compile`, `schema_diff`, and 7 runtime-observation tools backed by Logi. Diagnostics are stable JSON (codes `E001`–`E022`, `W001`–`W004`).
- **Core is neutral, plugins are named by transport.** `@alaq/graph` knows nothing about Zenoh, Tauri, or Vue. Generators are named by their target (`graph-zenoh`), never by a product.
- **Tier-based transport.** T0: ws+http. T1: +webrtc. T2: +zenoh. T3: zenoh-wasm. Tree-shaking enforces the tier.

For the full "why", read `PHILOSOPHY.md` (EN) or `PHILOSOPHY.RU.md` (RU, same authority).

## For whom

- Teams building reactive front-ends that talk to a typed server or peer mesh.
- AI agents operating over the repo — every normative rule is written for them as equal readers.

## Development

```bash
bun install              # bun 1.3+
bun test                 # run all package tests
cd packages/<name> && bun test
```

Root scripts are driven by `package.yaml` per package (not `package.json`). See `AGENTS.md` for the package-metadata rule and `CHECK.md` for the end-to-end verification protocol.

## Documentation

- `PHILOSOPHY.md` / `PHILOSOPHY.RU.md` — why the ecosystem is shaped this way.
- `AGENTS.md` — normative rules for agents (and humans) working in this repo.
- `CHECK.md` — verification protocol for the current state of the stack.
- `CONTRIBUTING.md` — contribution flow and licensing.
- `architecture.yaml` — machine-readable package registry.
- `DIGEST.md` — append-only journal of iterations.
- `packages/graph/SPEC.md` — normative SDL semantics (v0.3).
- `packages/*/README.md` — per-package interface.

## License

Dual-licensed:

- **TVR License** (`LICENSE`) — repository as a whole: docs, specs, build scripts, development artefacts.
- **Apache License 2.0** (`LICENSE-APACHE`) — source inside `packages/*/src/` and any npm artefacts built from it.

See `CONTRIBUTING.md` for the inbound = outbound policy.
