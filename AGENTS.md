# Alaq v6 — AGENTS manifesto

Read this before any change in this repo. These rules are normative, not advisory.

## Ecosystem layout

- **`@alaq/quark`** — reactive primitive. Zero deps. Do not add deps.
- **`@alaq/nucl`** — enhanced primitive on quark. Depends on quark only.
- **`@alaq/atom`** — state model on nucl. Used by application code.
- **`@alaq/fx`** — reactive effects and timings.
- **`@alaq/link`** — transport core (ws/webrtc/http, QoS, CRDT primitives, SyncBridge).
- **`@alaq/link-state`** — client-side replica (SyncStore, SyncNode, Ghost Proxies).
- **`@alaq/graph`** — SDL spec compiler (see `packages/graph/SPEC.md`). This is the source of truth for wire protocols across the ecosystem.
- **`@alaq/graph-*`** — target-specific generators (plugins). Named by transport/platform, not by product. Examples: `@alaq/graph-link-state`, `@alaq/graph-tauri`, `@alaq/graph-zenoh`.

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

## Memory discipline

Check `architecture.yaml` for package roles before assuming. Check `SPEC.md` for SDL semantics before writing. Do not guess.
