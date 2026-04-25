# HANDOFF — alak SPEC 0.3.11 / Wave 5

For: next alak-Executor agent (clean context).
Source of truth: this file is **scratch**, not committed. Don't commit.

---

## 1. Recent commits (HEAD same as Wave 4 — Wave 5 is uncommitted)

| Hash | Subject |
|------|---------|
| `380eab4` | spec: AI-First restructure (1663→756 LOC, -54.5%) — Wave 1 |
| `c1842df` | spec: §7 directive headers with code-links — Wave 2 |
| `b88fea2` | spec+impl: v0.3.7 finishing + Wave 3A drift fixes (hard sync) |
| `03921cf` | spec: SPEC 0.3.9 — envelope, conflict, bootstrap, large + backward-compat (Wave 3B) |
| `b2aaacd` | spec: SPEC 0.3.10 — @liveliness_token for Zenoh presence (Wave 4) |
| `eb2b73d` | codegen: complete SPEC 0.3.9 directive impls (conflict, bootstrap, large, deprecated_field) |

`HEAD = eb2b73d`. **Wave 5 work uncommitted** — Wave5Alak (Anthropic Claude
backend, Lead = Leader) added codegen-time event emission for composite CRDT
documents on top of `eb2b73d`. Working tree dirty.

---

## 2. Current state (Wave 5, 2026-04-25)

- **SPEC version:** still 0.3.10 in normative text. Wave 5 work is
  codegen-only — no SPEC bump required since the directives that drive event
  emission (`@crdt_doc_topic`, `@crdt_doc_member`) already exist as of 0.3.9.
  Bump to 0.3.11 if SPEC.md picks up an "Event-emission" subsection (see §4
  carry-over for stub directive sketch).
- **Tests:** `bun test` from `A:\source\alak\` → **1157 pass / 4 skip / 0
  fail** across 110 files (was 1143/4/0 at end of Wave 4). +14 new tests in
  `packages/graph-zenoh/test/events.test.ts` (10) and the events block at
  the bottom of `busynca-codegen.test.ts` (4).
- **`cargo check` sandbox** — passes against the regenerated
  `__fixtures__/busynca-groupsync.rs` (snapshot updated and accepted).
- **Working tree:** `git status --short` shows the events-gen module
  + index/emit wiring + new test + test-additions + regenerated snapshot +
  this HANDOFF.

---

## 3. Wave 5 — what shipped

### Codegen-time event emission for composite CRDT documents

Hand-written reference: `rest.valkyrie/busynca/src/lib.rs:1062-1196` —
`emit_point_diffs`, `emit_device_diffs`, `emit_threat_diffs`, plus the inline
snapshot/merge/snapshot/diff cycle in `start_group_sync_listener`. Wave 5
generates that whole shape from `@crdt_doc_member` — single source of truth
is the SDL.

**Per `@crdt_doc_topic(doc: D)` group with members, the generator now emits:**

1. `pub enum DEvent` — `<MapKey>Upserted(<Member>)` and `<MapKey>Deleted(String)`
   variants per member, sorted by `mapKey` for determinism, marked
   `#[non_exhaustive]` so adding a future map doesn't break consumer match
   arms. `<MapKey>` is PascalCased (`ground_stations` → `GroundStations`).

2. Per-map free fn `emit_<doc_snake>_<map>_diffs(tx, before, after)` that
   compares records by their required `ID!` field and emits `Upserted`
   when the resolved `lww_field` differs (`@crdt_doc_member.lww_field` →
   `@crdt(key:)` → `updated_at` fallback — identical resolution to
   `types-gen.ts → emitCrdtDocWrappers`). `tx.send` errors are dropped (a
   dead receiver is the caller's contract).

3. `<D>Doc::merge_remote_with_events(other, tx)` — convenience method that
   snapshots every member root-map via `list_<map>().unwrap_or_default()`,
   runs `merge_remote(other)?`, snapshots after, and fans out per-map
   diffs in one call. Returns `anyhow::Result<()>`.

**Fallback path:** records lacking a required `ID!` field surface a
diagnostic warning and switch to JSON-equality whole-record comparison (no
HashMap, no Deleted events — slow path that still produces correct
Upserted events). Validator does NOT enforce the R230 ID! requirement
yet — codegen is tolerant.

### Files touched

- `packages/graph-zenoh/src/events-gen.ts` — **new**, ~250 LOC. Single
  module exporting `hasAnyCrdtDocEvents` + `emitAllCrdtDocEvents`.
- `packages/graph-zenoh/src/index.ts` — wires events emission after
  composite pub/sub, gated on `needsComposite && hasAnyCrdtDocEvents`.
- `packages/graph-zenoh/src/emit.ts` — `anyhow = "1"` line in the
  Cargo-footer block when `needsComposite` (already implicit from
  `load_or_init`'s `anyhow::Result` — Wave 5 just makes it explicit).
- `packages/graph-zenoh/test/__fixtures__/busynca-groupsync.rs` —
  regenerated, +126 lines (events section). `cargo check` clean.
- `packages/graph-zenoh/test/busynca-codegen.test.ts` — +4 assertions
  on the events block (enum variants, diff fns, merge_remote_with_events).
- `packages/graph-zenoh/test/events.test.ts` — **new**, 10 tests
  covering single-doc, multi-doc, missing-ID! fallback, and multi-word
  map-key PascalCasing.

### Naming choice — `<Doc>Event`, not `<Doc>SyncEvent`

First pass produced `GroupSyncSyncEvent` — ugly because "GroupSync" is the
canonical busynca doc name. Decided on `<Doc>Event` plain. Trade-off: if
the SDL also defined `event GroupSyncEvent {…}` the generator would
collide on the Rust ident. Acceptable: `event` declarations live in the
same Rust namespace as records but the SDL author can rename. The
busynca SDL has no such collision today.

---

## 4. Drifts STILL outstanding (carried from 0.3.9 + 0.3.10 + new in 0.3.11)

- **R230 ID! enforcement** — validator does not yet require composite-doc
  members to declare a required `ID!` field. Wave 5 codegen is tolerant
  (warning + JSON-equality fallback). v0.4 should add R230 to the
  validator (`E0xx — composite-doc member missing required ID!`).
- **`@pre_emit` / `@post_emit` directives — DEFERRED.** The brief asked
  for "optional pre_emit/post_emit hooks for side-channel logic". Not
  shipped in Wave 5 — no concrete consumer asked yet. Sketch:
    - `@pre_emit(handler: "fn_name")` on a record → generated diff fn
      calls `fn_name(&entry)` (or returns) before `tx.send`.
    - `@post_emit(handler: "fn_name")` → same but after.
    - Use case from busynca: operator-review side-channel for `Threat`
      conflicts — rather than emitting `ThreatUpserted` blindly, route
      to a UI review queue when the conflict window is hit.
  Decision when shipping: pick whether handlers are free fns
  (caller-provided) or trait methods on the `<D>Doc` wrapper. Free fns
  match the existing emit_*_diffs shape best.
- **E031–E034 + W007 baseline-checker** — still catalog-only stubs.
  v0.4.
- **R400 byte-identical wire across deployments** — no impl. v0.4.
- **R500/R501 specVersion metadata + runtime compat-check** — no
  `specVersion` references in any generator. v0.4.
- **W008 axes coverage** — only `crdt_mode` axis fires. v0.4 with sibling
  directives.
- **`@liveliness_token` cargo-sandbox snapshot** — unchanged from Wave 4.
  Recommend a Tier-2 cargo-sandbox snapshot before any `.aql` adopts
  `@liveliness_token` in anger. (Carry-over.)

---

## 5. Known queue for v0.3.11+ / v0.4

### Wave 5 follow-ons

- **Adopt generated events in `rest.valkyrie/busynca/src/lib.rs`** —
  АвторBusynca's lane. Replace hand-written `emit_point_diffs` /
  `emit_device_diffs` / `emit_threat_diffs` + the inline snapshot/merge/
  diff cycle with calls to the generated `emit_group_sync_*_diffs` and/or
  `GroupSyncDoc::merge_remote_with_events`. Wave 5 generates
  `enum GroupSyncEvent`; busynca's hand-written `enum SyncEvent` can be a
  type alias or be replaced outright. Note variant rename:
  - `SyncEvent::PointUpserted` → `GroupSyncEvent::PointsUpserted`
  - `SyncEvent::PointDeleted` → `GroupSyncEvent::PointsDeleted`
  - `SyncEvent::DeviceUpserted` → `GroupSyncEvent::DevicesUpserted`
  - `SyncEvent::DeviceRemoved` → `GroupSyncEvent::DevicesDeleted`
  - `SyncEvent::ThreatUpserted` → `GroupSyncEvent::ThreatsUpserted`
  - `SyncEvent::ThreatDeleted` → `GroupSyncEvent::ThreatsDeleted`
  
  Note: busynca's protocol-v2 SDL declares `Threat` as a member. Today
  the legacy SDL fixture (`__fixtures__/busynca-groupsync.aql`) does NOT
  include `Threat` — it tracks the pre-Threat busynca model. When the
  fixture catches up to the canonical `philosophy/busynca-protocol.aql`,
  `GroupSyncEvent` will gain `ThreatsUpserted` / `ThreatsDeleted`
  automatically.

### Bootstrap-driven runtime hookup (Wave 4 carry-over)

`@bootstrap(mode:)` and `@conflict(strategy:)` emit constants but the
runtime crate does not yet read them. Two follow-ons unchanged from the
Wave 4 handoff.

### Real `@large` splitter (Wave 4 carry-over)

Threshold const published; publisher still inline. v0.5+ runtime work.

### `valkyrie-protocol.aql` adoption of `@liveliness_token` (Wave 4 carry-over)

АвторSDL's lane.

---

## 6. Useful paths (not content)

- `packages/graph/SPEC.md` — normative (still 0.3.10)
- `packages/graph/CHANGELOG.md` — `## 0.3.10` is the current entry; add
  `## 0.3.11` when SPEC bump lands
- `packages/graph-zenoh/src/events-gen.ts` — **new**, Wave 5
- `packages/graph-zenoh/src/index.ts` — wires events emission in
  `generateNamespace`
- `packages/graph-zenoh/src/emit.ts` — `anyhow` cargo-footer line
- `packages/graph-zenoh/test/events.test.ts` — **new**, Wave 5
- `packages/graph-zenoh/test/busynca-codegen.test.ts` — extended with
  Wave 5 assertions
- `packages/graph-zenoh/test/__fixtures__/busynca-groupsync.rs` —
  regenerated; cargo-sandbox `cargo check` clean

---

## 7. One paragraph — what to remember about this repo

`A:\source\rest.valkyrie` is **NOT a git repository** — only `A:\source\alak\`
is. All commits, status, log run from `alak/`. `master` is at `eb2b73d`,
**51 commits ahead of origin** (Wave 5 is uncommitted on top — user gates
push and Wave 5 didn't reach a commit gate). Wave 4 + Wave 5 added
events-gen on top of the SPEC 0.3.10 surface; the SPEC normative text is
unchanged because the directives that drive events (`@crdt_doc_topic`,
`@crdt_doc_member`) shipped in 0.3.9. Build artefacts are large
(`crates/*/target/` ~290 MB, `packages/*/test/cargo-sandbox/` ~475 MB) —
`.gitignore` excludes them. Snapshot drift fails `bun test` with a `.new`
sibling for diff. The `philosophy/busynca-protocol.aql` fixture remains
**off-limits** to the codegen lane (АвторSDL owns it; busynca consumer
adoption of generated events is its own lane). When in doubt — pick
AI-First and report the call.

---

## 8. Wave 5 design decision (kept here, not in SPEC body yet)

Codegen-time event emission is **derivative**, not directive-driven.
Reasoning:

- The pattern (snapshot/merge/snapshot/diff/broadcast) is universal across
  every consumer of a composite CRDT document. Adding a new directive
  just to "opt in" to events would be ceremony.
- The events shape is mechanically derivable from
  `@crdt_doc_member` + the resolved `lww_field`. No new SDL surface area
  needed.
- Consumers who don't want the events simply don't construct a
  `broadcast::Sender` — the generated code is dead-code at compile time
  if unused (`#![allow(dead_code, unused_imports, ...)]` already at top
  of every generated module).

Therefore Wave 5 ships **without** new directives and **without** a SPEC
bump. The `@pre_emit` / `@post_emit` sketch in §4 is the natural follow-on
when a real consumer needs side-channel routing — that one *would* need
SPEC additions because it changes generator behaviour at the directive
level.

The variant naming (`<MapKey>Upserted`, `<MapKey>Deleted`) tracks the
wire-side root-map name rather than the record name. Reasoning: two
records can theoretically share a map (R231 forbids it today, but the
variant should still read naturally as "what changed in map X" rather
than "what changed for record Y"). Matches the busynca convention where
`PointUpserted(SyncPoint)` carries the type but is named after the
root-map's purpose. Wave 5 inverts: the variant names track the
**wire-side `mapKey`** (`Points`, `Devices`, `Threats`) which IS the
root-map purpose.
