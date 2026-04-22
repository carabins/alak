# Alaqlink pipeline — verification protocol

**Audience:** AI agent (or human) with a clean context. Everything needed to verify the stack is here.

This document is a **procedural checklist**. Follow sections in order. For each step: run the command, compare output to expected, report pass/fail with observed output. Don't skip, don't improvise.

**Working directory:** `A:\source\alak`
**Shell:** bash (Git Bash on Windows). Forward slashes in paths, `/dev/null` not `NUL`.
**Runtime:** Bun 1.3+, Node 20+ optional.

If a step fails, **stop and report**. Do not try to fix. The goal is diagnosis, not repair.

---

## 0. Environment sanity

### 0.1 Verify Bun
```bash
bun --version
```
**Expected:** `1.3.0` or later. Observed today: `1.3.0`.

### 0.2 Verify cwd and key root files
```bash
pwd
ls A:/source/alak/AGENTS.md A:/source/alak/PHILOSOPHY.md A:/source/alak/CONTRIBUTING.md A:/source/alak/architecture.yaml A:/source/alak/LICENSE A:/source/alak/LICENSE-APACHE
```
**Expected:** `pwd` ends with `/source/alak`. All six files listed without "No such file" error.

### 0.3 Verify packages directory
```bash
ls A:/source/alak/packages | head -30
```
**Expected:** listing includes (at minimum) `graph/`, `graph-link-state/`, `graph-link-server/`, `graph-zenoh/`, `link/`, `link-state/`, `link-state-vue/`, `quark/`, `nucl/`, `atom/`, `fx/`, `mcp/`.

### 0.4 Git status (informational only)
```bash
cd A:/source/alak && git status --porcelain | head -20
```
Not a test gate. Just lists working-tree state for the report.

---

## 1. What alaqlink is (mental model)

Read this once before running anything. You must be able to explain each box without looking at code.

```
┌──────────────────────────── compile-time ─────────────────────────────┐
│                                                                        │
│  schema/*.aql ──► @alaq/graph ──► IR (JSON)                           │
│                        │                                               │
│                        ├──► @alaq/graph-link-state  → client TS       │
│                        ├──► @alaq/graph-link-server → server TS       │
│                        ├──► @alaq/graph-zenoh       → Rust (Zenoh)    │
│                        └──► @alaq/mcp               → AI tool surface │
│                                                       (compile, diff) │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────── runtime (client) ─────────────────────────┐
│                                                                        │
│   Vue component                                                        │
│      │ useGameRoomInScope(id)                                          │
│      ▼                                                                 │
│   @alaq/link-state-vue ─ useNode ─► Ref<T>                             │
│      │                                                                 │
│      ▼                                                                 │
│   @alaq/link-state    SyncStore + SyncNode                             │
│      │                                                                 │
│      ▼                                                                 │
│   @alaq/link         LinkHub + SyncBridge + CRDT engine                │
│      │                WebSocket/WebRTC/HTTP drivers                    │
│      ▼                                                                 │
│   wire (WebSocket by default)                                          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────── runtime (server) ─────────────────────────┐
│                                                                        │
│   @alaq/link/server    createLinkServer({ onAction })                  │
│      │                                                                 │
│      ▼                                                                 │
│   generated dispatcher    createActionDispatcher({ handlers, ctx })    │
│      │                                                                 │
│      ▼                                                                 │
│   hand-written handlers   { createRoom, joinRoom, leaveRoom, ... }     │
│      │                                                                 │
│      ▼                                                                 │
│   state mutation + ServerMsg.SNAPSHOT broadcast                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

`@alaq/mcp` is a sibling tool to the generators: it does not produce code, it exposes the `@alaq/graph` compile/diff surface to AI agents over JSON-RPC stdio (MCP).

### 1.1 Key rules (from AGENTS.md, PHILOSOPHY.md, SPEC.md)

- **SDL is the single source of truth.** Types, wire shapes, CRDT schema, all derived.
- **Generators are plugins.** Named by transport/platform, never by product. `@alaq/graph-zenoh` good; `@alaq/graph-kotelok` forbidden.
- **Core is neutral.** `@alaq/graph` doesn't know about Zenoh, Tauri, Vue. It emits IR.
- **Transport tiers:** Tier 0 (ws+http), Tier 1 (+webrtc), Tier 2 (+zenoh native), Tier 3 (zenoh-wasm PWA).
- **Closed directive set** lives in `@alaq/graph/SPEC.md` §7. Adding a directive requires spec bump.
- **Stability:** v6 is in `6.0.0-alpha.0`. Tool/IR surface may shift until `6.0.0`. SDL semantics frozen at SPEC.md v0.3.

### 1.2 Files to know (absolute paths for this working tree)

- `A:\source\alak\AGENTS.md` — manifest, read first
- `A:\source\alak\PHILOSOPHY.md` — normative "why" doc
- `A:\source\alak\CONTRIBUTING.md` — contributor rules
- `A:\source\alak\architecture.yaml` — package registry, tiers, forbidden deps
- `A:\source\alak\LICENSE` — TVR (custom, repo-level)
- `A:\source\alak\LICENSE-APACHE` — Apache-2.0 (npm artifacts)
- `A:\source\alak\packages\graph\SPEC.md` — SDL spec v0.3, normative, 1088 lines
- `A:\source\alak\packages\link-state\RUNTIME.md` — runtime cookbook, 1112 lines
- `A:\source\alak\packages\mcp\src\bin.ts` — MCP stdio entry point
- `A:\source\alak\packages\mcp\src\cli.ts` — one-shot MCP CLI wrapper

---

## 2. All test suites green

Run each, expect `0 fail` and the noted pass count.

```bash
cd A:/source/alak/packages/graph && bun test 2>&1 | tail -3
```
**Expected:** `Ran 127 tests across 8 files`, `0 fail`.

```bash
cd A:/source/alak/packages/graph-link-state && bun test 2>&1 | tail -3
```
**Expected:** `Ran 130 tests across 9 files`, `0 fail`.

```bash
cd A:/source/alak/packages/graph-link-server && bun test 2>&1 | tail -3
```
**Expected:** `Ran 35 tests across 3 files`, `0 fail`.

```bash
cd A:/source/alak/packages/graph-zenoh && bun test 2>&1 | tail -3
```
**Expected:** `Ran 81 tests across 4 files`, `0 fail`.

```bash
cd A:/source/alak/packages/link-state && bun test 2>&1 | tail -3
```
**Expected:** `Ran 25 tests across 4 files`, `0 fail`.

```bash
cd A:/source/alak/packages/link-state-vue && bun test 2>&1 | tail -3
```
**Expected:** `Ran 8 tests across 1 file`, `0 fail`.

```bash
cd A:/source/alak/packages/quark && bun test 2>&1 | tail -3
```
**Expected:** `Ran 107 tests across 7 files`, `0 fail`.

```bash
cd A:/source/alak/packages/nucl && bun test 2>&1 | tail -3
```
**Expected:** `Ran 43 tests across 7 files`, `0 fail`.

```bash
cd A:/source/alak/packages/atom && bun test 2>&1 | tail -3
```
**Expected:** `Ran 38 tests across 11 files`, `0 fail`.

```bash
cd A:/source/alak/packages/fx && bun test 2>&1 | tail -3
```
**Expected:** `Ran 9 tests across 1 file`, `0 fail`.

```bash
cd A:/source/alak/packages/mcp && bun test 2>&1 | tail -3
```
**Expected:** `Ran 50 tests across 6 files`, `0 fail`. (Was 34 / 3 before the runtime-observation tools landed in 2026-04-19; see `DIGEST.md`.)

```bash
cd A:/source/alak/packages/plugin-logi && bun test 2>&1 | tail -3
```
**Expected:** `Ran 8 tests`, `0 fail`.

```bash
cd A:/source/alak/packages/plugin-idb && bun test 2>&1 | tail -3
```
**Expected:** `Ran 20 tests`, `0 fail`. (Browser e2e harness in `packages/plugin-idb/playwright/` is separate — see `DIGEST.md` 2026-04-19 late entry.)

```bash
cd A:/source/alak/packages/plugin-tauri && bun test 2>&1 | tail -3
```
**Expected:** `Ran 17 tests`, `0 fail`.

**Grand total: ~920 tests across 14 packages, 0 failures.** (637 core + 283 plugin/mcp additions from 2026-04-19; re-count exact total on next run.)

---

## 3. Compile-time pipeline: SDL → IR → TS

### 3.1 Verify SDL parses

```bash
cd A:/source/alak && bun -e "
import { parseSource } from './packages/graph/src/index'
const src = \`
schema S { version: 1, namespace: \\\"s\\\" }
record Player {
  id: ID!
  name: String!
}
\`
const { ir, diagnostics } = parseSource(src)
console.log('errors:', diagnostics.filter(d => d.severity === 'error').length)
console.log('records:', Object.keys(ir.schemas.s.records))
"
```
**Expected:**
```
errors: 0
records: [ "Player" ]
```

### 3.2 Verify multi-file linker

```bash
cd A:/source/alak && bun -e "
import { compileSources } from './packages/graph/src/index'
const res = compileSources([
  { path: 'a.aql', source: 'schema S { version: 1, namespace: \\\"s\\\" }\n record A { id: ID! }' },
  { path: 'b.aql', source: 'schema S { version: 1, namespace: \\\"s\\\" }\n record B { a: A! }' },
])
console.log('errors:', res.diagnostics.filter(d => d.severity === 'error').length)
console.log('records:', Object.keys(res.ir.schemas.s.records).sort())
console.log('first:', res.diagnostics.find(d => d.severity === 'error')?.code)
"
```
**Expected (currently fails — see §3.2 note):**
```
errors: 1
records: [ "A", "B" ]
first: E009
```

**§3.2 note — known bug.** Two `.aql` files declaring the same `schema S { ... }` and cross-referencing each other's records do not link cleanly: the linker emits `E009 — field type references undefined type "A"` even though `A` is present in `res.ir.schemas.s.records`. The IR contains both records, the type-check phase still treats the second file's reference as undefined. The previous CHECK.md run also flagged this; it is not fixed today. Real consumers work around it by colocating cross-referencing records in one file, or by using fully-qualified namespaces.

### 3.3 Verify TS generator

```bash
cd A:/source/alak && bun -e "
import { compileSources } from './packages/graph/src/index'
import { generate } from './packages/graph-link-state/src/index'
const res = compileSources([
  { path: 'p.aql', source: 'schema S { version: 1, namespace: \\\"s\\\" }\n record Player { id: ID!, name: String! }' },
])
const gen = generate(res.ir, { vue: true })
const c = gen.files[0].content
console.log('file:', gen.files[0].path)
console.log('IPlayer:', c.includes('export interface IPlayer'))
console.log('PlayerNode:', c.includes('export interface PlayerNode'))
console.log('createPlayerNode:', c.includes('export function createPlayerNode'))
console.log('usePlayer:', c.includes('export function usePlayer'))
console.log('usePlayerInScope:', c.includes('export function usePlayerInScope'))
"
```
**Expected:**
```
file: s.generated.ts
IPlayer: true
PlayerNode: true
createPlayerNode: true
usePlayer: true
usePlayerInScope: true
```

**§3.3 note.** The generator does **not** currently emit a `kotelokSchema` / `<ns>Schema: Record<...>` constant. Old CHECK.md asserted such an export existed; it does not in the current `@alaq/graph-link-state` output. The actual exports per record are: `I<Name>`, `<Name>Node`, `create<Name>Node`, `Use<Name>Result`, `use<Name>`, `use<Name>InScope`, plus a single `createApi(store)` factory. No top-level schema-as-Record constant. If a downstream tool needs runtime schema metadata it should consume the IR directly via `@alaq/graph` or `@alaq/mcp`.

The header still reads `// AUTOGENERATED by @alaq/graph-link-state v0.1.0-draft` — the version string in the generated banner has not been bumped to `6.0.0-alpha.0`. Cosmetic, not a behavioural bug.

### 3.4 Verify Zenoh/Rust generator

```bash
cd A:/source/alak && bun -e "
import { compileSources } from './packages/graph/src/index'
import { generate } from './packages/graph-zenoh/src/index'
const res = compileSources([
  { path: 'p.aql', source: 'schema S { version: 1, namespace: \\\"s\\\" }\n record Player { id: ID!, name: String! }' },
])
const gen = generate(res.ir)
const c = gen.files[0].content
console.log('file:', gen.files[0].path)
console.log('Serialize derive:', c.includes('#[derive(Debug, Clone, Serialize, Deserialize)]'))
console.log('pub struct Player:', c.includes('pub struct Player'))
console.log('publish_player:', c.includes('pub async fn publish_player'))
"
```
**Expected:**
```
file: s.rs
Serialize derive: true
pub struct Player: true
publish_player: true
```

### 3.5 Verify server generator

```bash
cd A:/source/alak && bun -e "
import { compileSources } from './packages/graph/src/index'
import { generate } from './packages/graph-link-server/src/index'
const res = compileSources([
  { path: 's.aql', source: \`
schema S { version: 1, namespace: \\\"s\\\" }
record Player { id: ID!, name: String! }
record GameRoom @scope(name: \\\"room\\\") { id: ID!, players: [Player!]! }
action JoinRoom { scope: \\\"room\\\", input: { name: String! }, output: Player! }
\` },
])
const gen = generate(res.ir)
const c = gen.files[0].content
console.log('file:', gen.files[0].path)
console.log('ActionHandlers:', c.includes('export interface ActionHandlers'))
console.log('joinRoom signature:', c.includes('joinRoom(ctx'))
console.log('createActionDispatcher:', c.includes('export function createActionDispatcher'))
"
```
**Expected:**
```
file: s.server.generated.ts
ActionHandlers: true
joinRoom signature: true
createActionDispatcher: true
```

---

## 4. Zenoh generator cargo-verification

Proves the Rust emitter produces code that actually compiles against real `zenoh` + `serde` + `tokio` crates.

### 4.1 Verify Rust toolchain
```bash
cargo --version
rustc --version
```
**Expected:** `cargo 1.75+`, `rustc 1.75+`. Observed today: `cargo 1.91.0`, `rustc 1.91.0`.

### 4.2 Run cargo check via scaffold

```bash
cd A:/source/alak && bun run packages/graph-zenoh/scripts/check-kotelok.ts 2>&1 | tail -10
```
**Expected:** ends with `[check-kotelok] cargo check OK`. First run may take a few minutes to fetch crates. Subsequent runs typically complete in under a second (observed today: `Finished dev profile ... in 0.59s`).

Two warnings are normal and expected:
```
[check-kotelok] gen warning: Directive @auth is preserved as a comment only in v0.1 of @alaq/graph-zenoh.
[check-kotelok] gen warning: Directive @range is preserved as a comment only in v0.1 of @alaq/graph-zenoh.
```

**If fails:** note errors. Common causes: missing zenoh/tokio in `artifacts/graph-zenoh-check/Cargo.toml`, offline network preventing crate fetch, breaking change to the SDL fixtures in `packages/graph/test/fixtures/kotelok/`.

---

## 5. Live end-to-end (PENDING REPLACEMENT)

`Kotelok-2/` was extracted from this repo (the directory is now empty in the working tree). The live e2e protocol that previously occupied this section — server boot, smoke client, `WELCOME / CreateRoom / JoinRoom / SNAPSHOT` round-trip — has no in-tree consumer to run against today.

When a new reference consumer is in place (the user has indicated one will be provided), this section should be reconstructed: regenerate from SDL, boot the server, drive a smoke client end-to-end. Until then, treat this section as a **gap**. The compile-time pipeline (§2–§4) and the MCP surface (§6) are still verifiable; the runtime read/write paths are exercised only by `@alaq/link-state` / `@alaq/link` unit tests in §2.

---

## 6. MCP server health

`@alaq/mcp` exposes two tools to AI agents: `schema_compile` and `schema_diff`. It ships two binaries declared in `packages/mcp/package.yaml`:

- `alaq-mcp` — long-running newline-delimited JSON-RPC stdio server (`src/bin.ts`)
- `alaq-mcp-call` — one-shot CLI wrapper that handles `initialize` + a single `tools/call`, then exits (`src/cli.ts`)

### 6.1 Both binaries declared in package.yaml

```bash
cd A:/source/alak && bun -e "
import { parse } from 'yaml'
import { readFileSync } from 'node:fs'
const y = parse(readFileSync('packages/mcp/package.yaml','utf8'))
console.log(JSON.stringify(y.bin, null, 2))
"
```
**Expected:**
```
{
  "alaq-mcp": "./src/bin.ts",
  "alaq-mcp-call": "./src/cli.ts"
}
```

### 6.2 Stdio server: initialize + tools/list returns 2 tools

```bash
cd A:/source/alak && printf '%s\n%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | bun packages/mcp/src/bin.ts 2>/dev/null
```
**Expected:** two JSON-RPC response lines on stdout. The first carries `serverInfo: {"name":"@alaq/mcp","version":"6.0.0-alpha.0"}`. The second carries `result.tools` — a 2-element array whose `name` fields are exactly `schema_compile` and `schema_diff`.

### 6.3 CLI wrapper --list returns the same 2 tools

```bash
cd A:/source/alak && bun packages/mcp/src/cli.ts --list 2>/dev/null
```
**Expected:** pretty-printed JSON `{ "tools": [ ... ] }` with two entries, names `schema_compile` and `schema_diff`. (No third tool — `runtime_observe` was removed.)

### 6.4 Sandbox check: rootDir escape is refused

```bash
cd A:/source/alak && bun packages/mcp/src/cli.ts schema_compile '{"paths":["../../../etc/passwd"],"rootDir":"./packages/graph"}' 2>&1; echo "EXIT: $?"
```
**Expected:** non-zero exit (`EXIT: 1`) and stderr line containing `escapes rootDir` and `refusing to read`. Observed today:
```
JSON-RPC error -32000: schema_compile: path "../../../etc/passwd" escapes rootDir "A:\source\alak\packages\graph" — refusing to read
EXIT: 1
```

---

## 7. Critical pipeline invariants

These are previously-fixed P0 regressions or structural rules. They must remain true.

### 7.1 Ghost-loop guard present

```bash
grep -n "isGhost" A:/source/alak/packages/link/src/bridge.ts
```
**Expected:** at minimum two lines — an import of `isGhost` and a guard `if (isGhost(value) || value === undefined) return`. Without this guard, `SyncBridge.watch` enters an infinite fetch loop on missing paths.

### 7.2 onAction is awaited in server

```bash
grep -n "await config.onAction" A:/source/alak/packages/link/server/index.ts
```
**Expected:** a line in the FETCH handler with `await config.onAction?.(...)`. Without `await`, server returns `{}` silently to the client.

### 7.3 FieldSchema is re-exported

```bash
grep "FieldSchema" A:/source/alak/packages/link/src/index.ts
```
**Expected:** `export type { FieldSchema, CRDTEngineConfig } from './crdt/index'`. Without this, consumers must import from the `@alaq/link/crdt` subpath.

### 7.4 msgpackr lazy-loaded (no static import for Vite)

```bash
grep -n "loadMsgpackSync\|_msgpackAttempted\|msgpackr" A:/source/alak/packages/link/src/codec.ts | head -10
```
**Expected:** uses an internal `loadMsgpackSync` function that resolves `'msgpackr'` via a runtime-built name (so static analyzers like Vite don't try to bundle it). No top-level `import 'msgpackr'`.

### 7.5 `.d.ts` bundles present (or rebuildable)

```bash
ls A:/source/alak/packages/link/dist/src/index.d.ts A:/source/alak/packages/graph/dist/index.d.ts A:/source/alak/packages/link-state-vue/dist/index.d.ts 2>&1
```
**Expected:** all three files exist. If missing (the `dist/` tree is gitignored), rebuild from repo root:
```bash
cd A:/source/alak && bun run build:types 2>&1 | tail -5
```
**Expected:** no errors in the tail; per-package success.

### 7.6 Subscriber uses `Arc<Session>`

```bash
grep -n "session: Arc<Session>" A:/source/alak/packages/graph-zenoh/src/publishers-gen.ts
```
**Expected:** at least two lines (scoped + unscoped subscriber emission). Without `Arc<Session>`, `tokio::spawn` triggers `E0521` lifetime errors.

### 7.7 All 19 `packages/*/package.yaml` parse as valid YAML

```bash
cd A:/source/alak && bun -e "
import { parse } from 'yaml'
import { readFileSync, readdirSync } from 'node:fs'
const dirs = readdirSync('packages').filter(d => {
  try { readFileSync('packages/'+d+'/package.yaml','utf8'); return true } catch { return false }
})
let bad = 0
for (const d of dirs) {
  try {
    const y = parse(readFileSync('packages/'+d+'/package.yaml','utf8'))
    if (!y.name) { console.log('  no name:', d); bad++ }
  } catch (e) { console.log('  parse fail:', d, e.message); bad++ }
}
console.log('count:', dirs.length, 'bad:', bad)
"
```
**Expected:** `count: 19 bad: 0`.

### 7.8 License declared on the publishable v6 packages with explicit Apache-2.0

The repo is dual-licensed: `LICENSE` is TVR (custom, repo-level); `LICENSE-APACHE` (Apache 2.0) covers npm artifacts. Every publishable package must declare `license: Apache-2.0` in its `package.yaml`.

```bash
cd A:/source/alak && bun -e "
import { parse } from 'yaml'
import { readFileSync, readdirSync } from 'node:fs'
const dirs = readdirSync('packages').filter(d => {
  try { readFileSync('packages/'+d+'/package.yaml','utf8'); return true } catch { return false }
})
let bad = 0
for (const d of dirs) {
  const y = parse(readFileSync('packages/'+d+'/package.yaml','utf8'))
  if (y.license !== 'Apache-2.0') { console.log('  not Apache-2.0:', d, '→', y.license); bad++ }
}
console.log('count:', dirs.length, 'non-compliant:', bad)
"
```
**Expected:** `count: 25 non-compliant: 0`. All 25 packages declare `license: Apache-2.0`. (Before the 2026-04-20 backfill, only `@alaq/graph` and `@alaq/mcp` declared it and `@alaq/atom` had `MIT`. Keep this check so a regression is caught the next time a package is added.)

---

## 8. Documentation coverage

### 8.1 AGENTS.md exists and has rules
```bash
grep -c "^##\|^-" A:/source/alak/AGENTS.md
```
**Expected:** 20+ (headings + bullet rules). Observed today: `28`.

### 8.2 PHILOSOPHY.md exists and pins the alpha version
```bash
head -1 A:/source/alak/PHILOSOPHY.md
grep -n "6\.0\.0-alpha\.0" A:/source/alak/PHILOSOPHY.md
```
**Expected:** title line on stdout, plus at least one match line referencing `6.0.0-alpha.0` in the stability section.

### 8.3 SPEC.md is v0.3
```bash
head -5 A:/source/alak/packages/graph/SPEC.md
```
**Expected:** `**Version:** 0.3` on line 3.

### 8.4 SPEC.md has EBNF grammar
```bash
grep -c '```ebnf' A:/source/alak/packages/graph/SPEC.md
```
**Expected:** `1` (grammar block in §2).

### 8.5 RUNTIME.md exists and has 8 recipes
```bash
grep -c "^### 9\." A:/source/alak/packages/link-state/RUNTIME.md
```
**Expected:** `8` (recipes 9.1 through 9.8).

### 8.6 CONTRIBUTING.md exists
```bash
wc -l A:/source/alak/CONTRIBUTING.md
```
**Expected:** non-empty. Observed today: `57`.

---

## 9. Architecture boundaries

These are hard rules from `architecture.yaml > forbidden_dependencies`.

### 9.1 `@alaq/graph` has no plugin deps

```bash
grep "alaq/graph-" A:/source/alak/packages/graph/package.yaml
```
**Expected:** **no output**. Core must not depend on plugins.

### 9.2 Plugins don't depend on each other

```bash
for pkg in graph-link-state graph-link-server graph-zenoh; do
  echo "=== $pkg ==="
  grep "alaq/graph-" A:/source/alak/packages/$pkg/package.yaml | grep -v "name:" | grep -v "homepage" | grep -v "directory" || echo "  (none)"
done
```
**Expected:** for each plugin, output is either `(none)` or only declarations of `@alaq/graph` itself (in deps/devDeps) — never another `@alaq/graph-*`.

### 9.3 No product-specific plugin names

```bash
ls A:/source/alak/packages | grep -E "graph-(kotelok|valkyrie|busynca|sokol)" || echo "(none)"
```
**Expected:** `(none)`. Plugins named by transport/platform, not product.

---

## 10. Report template

After running all sections, produce this report. Be precise.

```markdown
# Verification report — <date>

## Results

| Section | Pass/Fail | Observed |
|---|---|---|
| 0.1 Bun version | ? | ? |
| 0.2 Root files present | ? | ? |
| 0.3 Packages dir | ? | ? |
| 2 All packages green | ? | tests total = ?, expect = ? |
| 3.1 SDL parse | ? | ? |
| 3.2 Multi-file linker | ? | E009? |
| 3.3 TS generator | ? | exports listed |
| 3.4 Zenoh generator | ? | ? |
| 3.5 Server generator | ? | ? |
| 4.2 cargo check | ? | time = ?s |
| 6.1 mcp bin block | ? | ? |
| 6.2 mcp stdio tools/list | ? | tools = ? |
| 6.3 mcp cli --list | ? | tools = ? |
| 6.4 mcp sandbox refusal | ? | exit = ? |
| 7.1–7.6 Invariants | ? | any failing |
| 7.7 yaml parse 19/19 | ? | bad = ? |
| 7.8 license sample | ? | which declare it |
| 8.1–8.6 Docs | ? | any missing |
| 9.1–9.3 Boundaries | ? | any violated |

## Total
- Packages green: X / 11
- Tests: N / 637
- Invariants intact: Y / 8
- Docs present: Z / 6

## Anomalies found
(list with file:line, if any)

## Recommended next step
(one line based on findings)
```

---

## Appendix: What a clean run proves

If **every section passes** (modulo the documented §3.2 / §3.3 / §5 notes), you have:

1. **Correct SDL compilation** — parser, validator, single-file pipeline all green.
2. **Three working generators** — TS (client), TS (server), Rust (Zenoh wire).
3. **Compile-verified Rust** — generated code survives `cargo check` against real crates.
4. **AI tool surface live** — `@alaq/mcp` exposes `schema_compile` + `schema_diff` over stdio JSON-RPC, with rootDir sandboxing.
5. **CRDT schema auto-derived** — no manual duplication from `@crdt`/`@sync` directives.
6. **Type bundles available** — packages emit `.d.ts` (or are rebuildable via `build:types`), no shim files needed.
7. **Boundaries enforced** — core doesn't know about plugins, plugins don't cross-couple, no product-named plugins.
8. **Documentation sufficient** — AGENTS, PHILOSOPHY, CONTRIBUTING, SPEC v0.3, RUNTIME cover manifest, why, contributor flow, normative spec, runtime cookbook.
9. **Zero-regression P0 fixes** — ghost-loop, awaited onAction, re-exported types, lazy msgpackr, Arc<Session>.

Known **gaps** today (not regressions caught by this protocol — pre-existing):

- §3.2 multi-file linker emits spurious `E009` when two files share a `schema { namespace }` and cross-reference records.
- §3.3 `@alaq/graph-link-state` does not emit a runtime schema-as-Record constant; consumers needing runtime schema must read IR via `@alaq/graph` or `@alaq/mcp`.
- §5 live e2e is missing entirely (no in-tree reference consumer).

If any section fails outside the documented notes, start with the first failure — upstream problems cascade.
