# Alaq v6 — AGENTS manifesto

Read this before any change in this repo. These rules are normative, not advisory.

## Ecosystem layout

**Reactive core (generic, not alaqlink-specific):**

- **`@alaq/quark`** — reactive primitive. Zero deps. Do not add deps.
- **`@alaq/nucl`** — enhanced primitive on quark. Depends on quark only.
- **`@alaq/atom`** — state model on nucl. Used by application code.
- **`@alaq/fx`** — reactive effects and timings.

**Nucl/Atom plugins (kind-based, extend reactive core):**

- **`@alaq/plugin-logi`** — observability. Streams mutations/actions/errors into a self-hosted Logi endpoint. Shape-only by default, `debugValues` opt-in for dev. Trace-aware (action spans), release-aware (`version+build.rN`).
- **`@alaq/plugin-idb`** — persistence. Two kinds: `idb` (single-value KV) and `idb-collection` (records with indexes). Optimistic sync + `$ready` / `$saved` companion nucls. Integrates with `plugin-logi` when present.
- **`@alaq/plugin-tauri`** — IPC bridge for Tauri v2. Two kinds: `tauri` (state atoms backed by Rust commands + events) and `tauri-command` (ad-hoc invokes). Graceful degradation in non-Tauri environments.

Plugins follow `@alaq/plugin-<function-or-platform>` naming. Plugin for X ≠ plugin-X-for-Y — keep families flat.

**alaqlink stack (SDL-driven synchronized state):**

- **`@alaq/link`** — transport core (ws/webrtc/http, QoS, CRDT primitives, SyncBridge).
- **`@alaq/link-state`** — client-side replica (SyncStore, SyncNode, Ghost Proxies).
- **`@alaq/graph`** — SDL spec compiler (see `packages/graph/SPEC.md`). This is the source of truth for wire protocols across the ecosystem.
- **`@alaq/graph-*`** — target-specific generators. Named by transport/platform, not by product. Examples: `@alaq/graph-link-state`, `@alaq/graph-tauri`, `@alaq/graph-zenoh`.

**AI-facing tooling:**

- **`@alaq/mcp`** — MCP server exposing both compile-time tools (`schema_compile`, `schema_diff`) and runtime observation tools (`alaq_capabilities`, `alaq_trace`, `alaq_atom_activity`, `alaq_hot_atoms`, `alaq_idb_*`). Runtime tools read from Logi HTTP API directly. Dev default endpoint: `http://localhost:2025`.

## Transport tiers

Applications pick a tier explicitly. Tree-shaking is the enforcement mechanism.

- **Tier 0** (lightweight SPA): `ws` + `http` drivers. No Zenoh.
- **Tier 1** (rich web): + `webrtc` for P2P. No Zenoh.
- **Tier 2** (native: Tauri/CLI/server): `zenoh` as primary driver.
- **Tier 3** (PWA mesh peer, rare): `zenoh-wasm`, explicit opt-in only.

## SDL scope

`@alaq/graph` SDL describes: record types, actions (RPC/fire-forget), topics, QoS, encoding, CRDT semantics, opaque tunnels, module imports, schema versioning.

SDL does NOT describe: deployment, identity derivation algorithms, raw discovery bytes outside the main protocol, UI contracts, runtime configuration.

## Package naming

Generator plugins follow `@alaq/graph-<transport-or-platform>`. Never name a plugin after a specific product (e.g. `graph-valkyrie`, `graph-kotelok` are forbidden). Products are consumers, not targets.

## Core vs plugins

- `@alaq/graph` core is transport-neutral. No knowledge of Zenoh, Tauri, or any specific runtime.
- Advanced capabilities (key expressions, storages, liveliness queries) live in driver packages (`@alaq/link-zenoh` etc.), not in `@alaq/link` core.
- `@alaq/graph` directives that target a specific runtime live in the plugin that owns that target.
- `@alaq/plugin-*` packages extend `@alaq/nucl`/`@alaq/atom` kind system. Each plugin is one concern (observability, persistence, IPC). Plugins never depend on other plugins; cross-plugin integration (e.g. `plugin-idb` emitting via `plugin-logi`) uses optional peer dependencies.

## When writing or modifying SDL

1. Read `packages/graph/SPEC.md` — authoritative reference.
2. Use only directives defined in SPEC. Do not invent new ones.
3. One concept, one syntax. If two forms express the same thing, pick the one in SPEC examples.
4. Each `.aql` file owns one namespace. Shared types come from `core/*.aql` via `use`.

## When adding a new generator

1. Place it in `packages/graph-<name>/`.
2. Add package entry to `architecture.yaml`.
3. The generator reads IR from `@alaq/graph`, produces code for one target. It must not import other generators.
4. Output must be transport-agnostic where possible — runtime selects the driver.

## Forbidden patterns

- Reviving or referencing `packages/state.draft/` — deferred experiment, do not use.
- Adding directives to core `@alaq/graph` for a specific runtime — put them in the plugin.
- Generating code that hardcodes Zenoh, Tauri, or any runtime — target abstractions (`@alaq/link` API, `@alaq/link-state` SyncNode).
- Parsing TypeScript AST to extract schemas — schemas live in `.aql`, not in code.

## Package metadata

Packages declare their manifest in `package.yaml`, not `package.json`. Root build scripts generate `package.json` on publish. Do not create `package.json` or per-package `tsconfig.json` by hand — path resolution lives in the root `tsconfig.json`.

Run tests with `bun test ./packages/<name>/test/` (or `cd packages/<name> && bun test`).

## Memory discipline

Check `architecture.yaml` for package roles before assuming. Check `SPEC.md` for SDL semantics before writing. Do not guess.
