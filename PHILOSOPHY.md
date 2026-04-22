# v6 — philosophy

**Audience:** an LLM reading this repo for the first or nth time. Not a human.

This document answers **why**. For **how**, see `AGENTS.md`, `architecture.yaml`, `CHECK.md`, and per-package `SPEC.md` / `README.md`.

A Russian mirror exists at `PHILOSOPHY.RU.md` — same content, same authority.

---

## One line

v6 is a reactive TypeScript ecosystem designed so that **an LLM agent is a first-class consumer**, equal to a human developer.

---

## What this means for you as an LLM

1. **One entry: `alaq`.** A human runs `npm install alaq` and gets everything. You, entering a new project, run `alaq` and receive a **capability manifest** — machine-readable JSON describing the ecosystem: which packages are available, which MCP tools you hold, what you can do.

2. **MCP is your main interface.** `@alaq/mcp` is a stdio JSON-RPC server. Through it you **compile SDL** (`schema_compile`), **analyze changes** (`schema_diff` — with `breaking` / `non_breaking` / `review` classes), **observe a live runtime** (7 `alaq_*` tools backed by Logi). Without MCP you scrape stdout and guess; through MCP you get structured answers.

3. **Diagnostics are stable JSON.** Error codes (`E001`–`E022`, `W001`–`W004`) do not change across minor versions. You can build automation on a specific code.

4. **The sandbox is real.** `rootDir` in MCP filesystem mode is not a decoration. `../etc/passwd` is refused. You can trust it.

5. **The `review` class in `schema_diff` is your right to stop.** When the classifier says `review`, that is a signal: "this decision requires judgement, not automation." Do not paper over it.

---

## Ecosystem map

6 layers, 22 packages. Know them by role, not by name:

```
┌──────────────────────────────────────────────────┐
│  L0 Frontdoor       alaq                         │  AI door, CLI, capability manifest
├──────────────────────────────────────────────────┤
│  L1 AI tooling      @alaq/mcp                    │  MCP server (compile + observe)
├──────────────────────────────────────────────────┤
│  L2 alaqlink        @alaq/graph (SDL → IR)       │  SDL compiler
│                     @alaq/graph-link-state       │  TS client generator
│                     @alaq/graph-link-server      │  TS server generator
│                     @alaq/graph-zenoh            │  Rust/Zenoh generator
│                     @alaq/link                   │  transport (ws/http/webrtc/CRDT)
│                     @alaq/link-state             │  SyncStore + SyncNode
│                     @alaq/link-state-vue         │  Vue adapter
├──────────────────────────────────────────────────┤
│  L3 Reactive core   @alaq/quark                  │  base particle (zero-dep)
│                     @alaq/nucl                   │  particle + plugin system
│                     @alaq/atom                   │  state model
│                     @alaq/fx                     │  effects and timing
├──────────────────────────────────────────────────┤
│  L4 Plugins         @alaq/plugin-idb             │  IndexedDB for nucl
│                     @alaq/plugin-logi            │  Logi observability
│                     @alaq/plugin-tauri           │  Tauri IPC bridge
├──────────────────────────────────────────────────┤
│  L5 Utilities       @alaq/rune (random+IDs)      │  UUIDv7, ULID, nanoid, PRNG
│                     @alaq/bitmask                │  bit masks
│                     @alaq/datastruct             │  data structures
│                     @alaq/queue                  │  reactive job scheduler
│                     @alaq/deep-state             │  deep reactivity
│                     @alaq/xstate                 │  XState integration
└──────────────────────────────────────────────────┘
```

**alaqlink** (L2) is not all of v6. It is **one track inside**: SDL + codegen + runtime sync for distributed applications. The other layers exist independently.

---

## Seven principles (normative)

### 1. SDL is the single truth (applies to alaqlink)
`.aql` is authored once. Types, wire, CRDT, handlers, composables are generated. Closed directive set in `packages/graph/SPEC.md §7`.

### 2. Core is neutral, plugins are named by transport
`@alaq/graph` does not know about Zenoh/Vue/Tauri. A generator is named by its **target** (`graph-zenoh`, `graph-link-state`), **never** by a product (`graph-kotelok` is forbidden). Products are consumers.

### 3. Types beat runtime checks
What the compiler proved, the runtime does not re-validate. Validation lives at the boundary (incoming messages only).

### 4. AI is a first-class consumer
This is not a slogan — it is a physical property of the stack. MCP server, machine-readable diagnostics, stable error codes, capability manifest in `alaq`, `review` class in diff — all of it so an LLM works without a human in the middle.

### 5. Scopes, not singletons
`@scope(name: "room")` — one instance per named scope. Client subscribes to `room/<id>`, server routes. You get a **slice** of state, not the whole object.

**Boundaries (normative, see `packages/graph/SPEC.md §7.5`):**
- **Scope is single-axis by design.** A record opts into exactly one scope. Multi-axis data slicing (e.g. `channel × region × user`) is not expressed by stacking `@scope`; the primary axis is the scope, the rest are plain `input` arguments plus server-side filtering in the handler. If you feel the urge to write `@scope(channel, admin)`, the answer is no — pick the primary axis, push the others into arguments.
- **Auth is not scope.** `@scope` controls reactive slicing and lifecycle, never authorization. Authentication and authorization live at the **transport layer** — HTTP middleware for `graph-axum`, Tauri capabilities / command-level checks for `graph-tauri-rs`, per-topic ACL at the runtime for `graph-zenoh`. SDL does not describe auth. Actions without `scope` are the valid shape for admin mutations; the generator config or middleware decides who may call them.
- **Transport is not scope.** Whether an action travels over HTTP, Tauri IPC, or Zenoh is decided by **which generator consumes the IR**, not by `@scope`. See the out-of-scope list in `SPEC.md §17`.

### 6. Tier-based transport
T0: ws+http. T1: +webrtc. T2: +zenoh. T3: zenoh-wasm. Tree-shaking is the enforcement mechanism. You go up tiers by requirement, not by habit.

### 7. Hard nos
- No runtime-specific directives in `@alaq/graph` (they live in plugins).
- No TS AST parsing to extract schemas (the schema lives in `.aql`).
- No cross-imports between generators.
- No `graph-<productname>` packages.

---

## What v6 does **not** do

- Does not manage identity / auth. Layer above.
- Does not describe deployment.
- Does not prescribe a UI framework.
- Does not try to be GraphQL. Read patterns are a different problem.
- Does not embed an LLM. `alaq` is a doorway to tools; it does not think.
- Does not runtime-validate what the compiler already proved.

---

## Relation to neighboring tools

| Tool              | Where it overlaps        | Where it does not                                |
|-------------------|--------------------------|--------------------------------------------------|
| GraphQL           | typed contract           | v6 is codegen+sync, not query                    |
| gRPC / protobuf   | wire + IDL               | v6 is reactive subscriptions, not call-response  |
| tRPC              | typesafe RPC             | v6 is not tied to TS on both ends                |
| Yjs / Automerge   | CRDT                     | v6 gives a typed SDL over CRDT                   |
| Effect Schema     | validation + types       | v6 is wire + transport + runtime                 |
| Sentry            | observability            | Logi (via `@alaq/plugin-logi`) is MCP-first      |

---

## Names

- **`alaq`** — npm name of the frontdoor (unscoped). `npm install alaq`.
- **`@alaq`** — npm scope for all individual packages (`@alaq/graph`, `@alaq/mcp`, …).
- **`v6`** — common name for the ecosystem and the major cycle. Not a product — an era.
- **`alaqlink`** — track inside v6 (L2): SDL + generators + runtime sync. Not a synonym for v6.

If you see "alaqlink", look in L2. If you see "v6", think of the whole ecosystem.

---

## Stability

Current: `6.0.0-alpha.0`. Before `6.0.0` GA the surface moves: tool names, IR shape, directive set. SDL semantics in `SPEC.md` v0.3 is stable.

After GA — strict semver on public APIs. Before GA — breaking changes are flagged in the CHANGELOG, not silent.

---

## Where to go next

If you are an LLM entering this repo for the first time:

1. **Read `AGENTS.md`** — normative rules for your behavior.
2. **Run or read `CHECK.md`** — the verification protocol for the current state of the stack.
3. **Open `architecture.yaml`** — machine-readable registry, navigate by it.
4. **If MCP is wired** — first call: `alaq_capabilities`. It tells you what you hold.
5. **If MCP is not wired** — run `alaq mcp install` to print the standard MCP server stanza, tell the human to paste it into their MCP client's config, then repeat step 4.

---

## Who owns what

- **`PHILOSOPHY.md` / `.RU.md`** — why. This document.
- **`AGENTS.md`** — how an agent behaves in the repo.
- **`CHECK.md`** — how to verify the stack.
- **`architecture.yaml`** — what exists and how it connects.
- **`CONTRIBUTING.md`** — how to change things.
- **`packages/graph/SPEC.md`** — normative SDL semantics.
- **`packages/*/README.md`** — per-package interface.
