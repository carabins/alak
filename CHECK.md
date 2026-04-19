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
**Expected:** `1.3.0` or later.

### 0.2 Verify cwd
```bash
pwd
ls packages | head -20
```
**Expected:** `A:/source/alak`. Listing shows `graph/`, `graph-link-state/`, `graph-link-server/`, `graph-zenoh/`, `link/`, `link-state/`, `link-state-vue/`, `quark/`, `nucl/`, `atom/`, `fx/`, plus utilities.

### 0.3 Verify no accidental work-in-progress
```bash
cd A:/source/alak && git status --porcelain | head -20
```
**Expected:** either clean or only previously-known changes. Not a test gate, informational.

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
│                        └──► @alaq/graph-zenoh       → Rust (Zenoh)    │
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

### 1.1 Key rules (from AGENTS.md and SPEC.md)

- **SDL is the single source of truth.** Types, wire shapes, CRDT schema, all derived.
- **Generators are plugins.** Named by transport/platform, never by product. `@alaq/graph-zenoh` good; `@alaq/graph-kotelok` forbidden.
- **Core is neutral.** `@alaq/graph` doesn't know about Zenoh, Tauri, Vue. It emits IR.
- **Transport tiers:** Tier 0 (ws+http), Tier 1 (+webrtc), Tier 2 (+zenoh native), Tier 3 (zenoh-wasm PWA).
- **Closed directive set** lives in `@alaq/graph/SPEC.md` §7. Adding a directive requires spec bump.

### 1.2 Files to know (absolute paths for this working tree)

- `A:\source\alak\AGENTS.md` — manifest, 64 lines, read first
- `A:\source\alak\architecture.yaml` — package registry, tiers, forbidden deps
- `A:\source\alak\packages\graph\SPEC.md` — SDL spec v0.3, normative, ~1100 lines
- `A:\source\alak\packages\link-state\RUNTIME.md` — runtime cookbook, 1112 lines
- `A:\source\alak\Kotelok-2\` — reference consumer project
- `A:\source\alak\Kotelok-2\FINDINGS.md` — DX observations from live-test, open backlog

---

## 2. Package health check

### 2.1 All test suites green

Run each, expect `0 fail` and the noted pass count:

```bash
cd A:/source/alak/packages/graph && bun test 2>&1 | tail -3
```
**Expected:** `127 tests across 8 files`, `0 fail`.

```bash
cd A:/source/alak/packages/graph-link-state && bun test 2>&1 | tail -3
```
**Expected:** `130 tests across 9 files`, `0 fail`.

```bash
cd A:/source/alak/packages/graph-link-server && bun test 2>&1 | tail -3
```
**Expected:** `35 tests across 3 files`, `0 fail`.

```bash
cd A:/source/alak/packages/graph-zenoh && bun test 2>&1 | tail -3
```
**Expected:** `81 tests across 4 files`, `0 fail`.

```bash
cd A:/source/alak/packages/link-state && bun test 2>&1 | tail -3
```
**Expected:** `25 tests across 4 files`, `0 fail`.

```bash
cd A:/source/alak/packages/link-state-vue && bun test 2>&1 | tail -3
```
**Expected:** `8 tests across 1 file`, `0 fail`.

```bash
cd A:/source/alak/packages/quark && bun test 2>&1 | tail -3
```
**Expected:** `107 tests`, `0 fail`.

```bash
cd A:/source/alak/packages/nucl && bun test 2>&1 | tail -3
```
**Expected:** `43 tests`, `0 fail`.

```bash
cd A:/source/alak/packages/atom && bun test 2>&1 | tail -3
```
**Expected:** `38 tests`, `0 fail`.

```bash
cd A:/source/alak/packages/fx && bun test 2>&1 | tail -3
```
**Expected:** `9 tests`, `0 fail`.

**Grand total: 603 tests across 10 packages, 0 failures.**

**Pre-existing failures to ignore:** `packages/flex/test/ui-bug.test.ts` (Pixi), `packages/flex/test/e2e/visual.spec.ts` (Playwright config). Not in scope.

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
"
```
**Expected:**
```
errors: 0
records: [ "A", "B" ]
```
Two files merged into one namespace.

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
console.log('usePlayer:', c.includes('export function usePlayer'))
console.log('kotelokSchema:', c.includes('Schema: Record'))
"
```
**Expected:**
```
file: s.generated.ts
IPlayer: true
PlayerNode: true
usePlayer: true
kotelokSchema: true
```

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
console.log('ActionHandlers:', c.includes('export interface ActionHandlers'))
console.log('joinRoom signature:', c.includes('joinRoom(ctx'))
console.log('createActionDispatcher:', c.includes('export function createActionDispatcher'))
"
```
**Expected:**
```
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
**Expected:** `cargo 1.75+`, `rustc 1.75+`.

### 4.2 Run cargo check via scaffold

```bash
cd A:/source/alak && bun run packages/graph-zenoh/scripts/check-kotelok.ts 2>&1 | tail -10
```
**Expected:** ends with `cargo check OK`. First run may take ~3 minutes to download crates. Subsequent runs: <5 seconds.

**If fails:** note errors. Common causes: missing zenoh/tokio in `artifacts/graph-zenoh-check/Cargo.toml`, offline network preventing crate fetch.

---

## 5. Kotelok-2 reference project

This is the living example. Anything that works here should work in a new project.

### 5.1 TypeScript compiles
```bash
cd A:/source/alak/Kotelok-2/client && bun x tsc --noEmit -p tsconfig.json 2>&1 | tail -20
```
**Expected:** **zero errors**. No `alaq-shim.d.ts` involved — file should not exist.

```bash
ls A:/source/alak/Kotelok-2/client/src/alaq-shim.d.ts 2>&1
```
**Expected:** `No such file or directory`.

### 5.2 Regenerate from SDL
```bash
cd A:/source/alak/Kotelok-2 && bun run scripts/gen.ts 2>&1 | tail -10
```
**Expected:** writes `client/src/generated/kotelok2.generated.ts` and `server/generated/kotelok2.server.generated.ts` (or equivalent paths). No errors.

### 5.3 Generated output shape

```bash
grep -E "export (interface|function|enum|type|const)" A:/source/alak/Kotelok-2/client/src/generated/kotelok2.generated.ts | head -20
```
**Expected:** lists like
```
export enum RoomStatus
export interface IPlayer
export interface IGameRoom
export interface PlayerNode
export interface GameRoomNode
export function createGameRoomNode
export interface UseGameRoomResult
export function useGameRoom
export function useGameRoomInScope
export const kotelok2Schema: Record
```
(exact names vary with SDL).

### 5.4 Server starts

```bash
cd A:/source/alak/Kotelok-2/server && (timeout 5 bun run index.ts &) && sleep 3 && echo "server up"
```
**Expected:** `server up` prints before the server is killed by timeout.

### 5.5 End-to-end smoke

Start server in one terminal (background):
```bash
cd A:/source/alak/Kotelok-2/server && bun run index.ts &
SERVER_PID=$!
sleep 2
```

Run smoke client:
```bash
cd A:/source/alak/Kotelok-2 && bun run scripts/smoke.ts 2>&1 | tail -10
```
**Expected output contains:**
```
WELCOME
CreateRoom → <room-id>
JoinRoom → {...player object...}
SNAPSHOT ← {...room state...}
```
All four: `WELCOME`, `CreateRoom`, `JoinRoom`, `SNAPSHOT`.

Clean up:
```bash
kill $SERVER_PID 2>/dev/null
```

**If smoke hangs:** server not reachable. Check port 3456 isn't busy, no firewall block on WebSocket.

---

## 6. Critical pipeline invariants

### 6.1 Ghost-loop guard present

```bash
grep -n "isGhost" A:/source/alak/packages/link/src/bridge.ts
```
**Expected:** a line importing `isGhost` and a line with `if (isGhost(value) || value === undefined) return`. Without this guard, `SyncBridge.watch` enters an infinite fetch loop on missing paths (closed P0 issue).

### 6.2 onAction is awaited in server

```bash
grep -n "await config.onAction" A:/source/alak/packages/link/server/index.ts
```
**Expected:** a line in `FETCH` handler with `await config.onAction?.(...)`. Without `await`, server returns `{}` silently to client (closed P0 issue).

### 6.3 FieldSchema is re-exported

```bash
grep "FieldSchema" A:/source/alak/packages/link/src/index.ts
```
**Expected:** `export type { FieldSchema, CRDTEngineConfig } from './crdt/index'`. Without this, consumers must import from `@alaq/link/crdt` subpath (closed P0 issue).

### 6.4 msgpackr lazy-loaded (no static import for Vite)

```bash
grep -A 2 "loadMsgpackSync\|_msgpackAttempted" A:/source/alak/packages/link/src/codec.ts | head -15
```
**Expected:** uses `(globalThis as any).require` with a variable name `'msgpackr'`, not static `require('msgpackr')`. This hides msgpackr from static analyzers.

### 6.5 `.d.ts` bundles present

```bash
ls A:/source/alak/packages/link/dist/src/index.d.ts A:/source/alak/packages/graph/dist/index.d.ts A:/source/alak/packages/link-state-vue/dist/index.d.ts 2>&1
```
**Expected:** all three files exist (or rebuild via `bun run build:types` from repo root if missing — `dist/` is gitignored).

If missing:
```bash
cd A:/source/alak && bun run build:types 2>&1 | tail -5
```
**Expected:** final line like `build:types OK` or per-package success lines with no errors.

### 6.6 Subscriber uses `Arc<Session>`

```bash
grep -n "session: Arc<Session>" A:/source/alak/packages/graph-zenoh/src/publishers-gen.ts
```
**Expected:** two lines — for scoped and unscoped subscribers. Without `Arc<Session>`, `tokio::spawn` E0521 lifetime error (closed P0 issue).

---

## 7. Documentation coverage

### 7.1 AGENTS.md exists and has rules
```bash
grep -c "^##\|^-" A:/source/alak/AGENTS.md
```
**Expected:** 20+ (headings + bullet rules).

### 7.2 SPEC.md is v0.3
```bash
head -5 A:/source/alak/packages/graph/SPEC.md
```
**Expected:** `**Version:** 0.3` on line 3.

### 7.3 SPEC.md has EBNF grammar
```bash
grep -c "```ebnf" A:/source/alak/packages/graph/SPEC.md
```
**Expected:** `1` (grammar block in §2).

### 7.4 RUNTIME.md exists and has 8 recipes
```bash
grep -c "^### 9\." A:/source/alak/packages/link-state/RUNTIME.md
```
**Expected:** `8` (recipes 9.1 through 9.8).

### 7.5 Kotelok-2 FINDINGS.md is present

```bash
grep -c "\[blocker\]\|\[friction\]\|\[nit\]" A:/source/alak/Kotelok-2/FINDINGS.md
```
**Expected:** 30+. Open backlog of DX issues, not all resolved.

---

## 8. Architecture boundaries

These are hard rules from `architecture.yaml > forbidden_dependencies`.

### 8.1 `@alaq/graph` has no plugin deps

```bash
grep "alaq/graph-" A:/source/alak/packages/graph/package.yaml
```
**Expected:** **no output**. Core must not depend on plugins.

### 8.2 Plugins don't depend on each other

```bash
for pkg in graph-link-state graph-link-server graph-zenoh; do
  echo "=== $pkg ==="
  grep "alaq/graph-" A:/source/alak/packages/$pkg/package.yaml | grep -v "$pkg" | grep -v "alaq/graph\""
done
```
**Expected:** either empty or only `@alaq/graph` in devDeps. Never another `@alaq/graph-*`.

### 8.3 No product-specific plugin names

```bash
ls A:/source/alak/packages | grep -E "graph-(kotelok|valkyrie|busynca|sokol)"
```
**Expected:** **no output**. Plugins named by transport/platform, not product.

---

## 9. Spec → reality round-trip

Proves SDL is the real source of truth.

### 9.1 Change SDL, regenerate, verify diff in output

```bash
cp A:/source/alak/Kotelok-2/schema/players.aql /tmp/players.aql.bak
```

Add a field:
```bash
cat A:/source/alak/Kotelok-2/schema/players.aql
# Note current fields of Player record
```

Add a new field `status: String` to `Player` in `players.aql`. Then:
```bash
cd A:/source/alak/Kotelok-2 && bun run scripts/gen.ts 2>&1 | tail -3
grep "status" A:/source/alak/Kotelok-2/client/src/generated/kotelok2.generated.ts | head -3
```
**Expected:** new `status` field visible in `IPlayer` interface.

Restore:
```bash
cp /tmp/players.aql.bak A:/source/alak/Kotelok-2/schema/players.aql
cd A:/source/alak/Kotelok-2 && bun run scripts/gen.ts 2>&1 | tail -1
```

This is a manual step. Skip if uncomfortable with regenerating files.

---

## 10. Report template

After running all sections, produce this report. Be precise.

```markdown
# Verification report — <date>

## Results

| Section | Pass/Fail | Observed |
|---|---|---|
| 0.1 Bun version | ? | ? |
| 0.2 CWD + packages | ? | ? |
| 2.1 All packages green | ? | tests total = ? |
| 3.1 SDL parse | ? | ? |
| 3.2 Multi-file linker | ? | ? |
| 3.3 TS generator | ? | ? |
| 3.4 Zenoh generator | ? | ? |
| 3.5 Server generator | ? | ? |
| 4.2 cargo check | ? | time = ?s |
| 5.1 Kotelok-2 TS compiles | ? | errors = ? |
| 5.2 Regenerate | ? | ? |
| 5.5 E2E smoke | ? | ? |
| 6.1-6.6 Invariants | ? | any failing |
| 7.1-7.5 Docs | ? | any missing |
| 8.1-8.3 Boundaries | ? | any violated |

## Total
- Packages green: X / 10
- Tests: N / 603
- Invariants intact: Y / 6
- Docs present: Z / 5

## Anomalies found
(list with file:line, if any)

## Recommended next step
(one line based on findings)
```

---

## Appendix: What a clean run proves

If **every section passes**, you have:

1. **Correct SDL compilation** — parser, linker, validator, all 22 error codes + 4 warnings work.
2. **Three working generators** — TS (client), TS (server), Rust (Zenoh wire).
3. **Compile-verified Rust** — generated code survives `cargo check` against real crates.
4. **Runtime read-path working** — live in Kotelok-2 Lobby, Vue composables, SyncStore ghost-loop fixed.
5. **Runtime write-path working** — actions flow client → server → SNAPSHOT broadcast, awaited end-to-end.
6. **CRDT schema auto-derived** — no manual duplication from `@crdt`/`@sync` directives.
7. **Type bundles available** — 11 packages emit `.d.ts`, no `alaq-shim` workarounds.
8. **Boundaries enforced** — core doesn't know about plugins, plugins don't cross-couple.
9. **Documentation sufficient** — AGENTS.md, SPEC.md, RUNTIME.md, FINDINGS.md cover spec, runtime, and open backlog.
10. **Zero-regression P0 fixes** — ghost-loop, awaited onAction, re-exported types, lazy msgpackr, Arc<Session>.

If any section fails, start with the first failure — upstream problems cascade.
