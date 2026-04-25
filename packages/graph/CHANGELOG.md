# @alaq/graph — SPEC Changelog

Normative history of the `.aql` SPEC. Current SPEC version: **0.3.9**.
Source of truth for behaviour: `./SPEC.md`. This file records *what changed when* and *why*.

Versioning policy:
- **Minor bump** (0.2 → 0.3): new directives, new scalars, new type constructors, new enum values in existing spec enums, new validation codes. Backwards-compatible for existing `.aql`.
- **Major bump** (0.x → 1.0): grammar changes, directive removals, IR breaking changes. Requires migration document.

---

## 0.3.9 (2026-04-25) — envelope, conflict, bootstrap, large + backward-compat (Wave 3)

Additive (seven new directives, seven new validation codes, three new advisory codes) + drift-fix (four §7 directive signatures aligned with their SPEC headers). Driven by Valkyrie v2 wire planning: a single `@envelope` annotation must drive QoS / ordering / retention / CRDT-mode choices that previously required composing four separate sibling directives, and a baseline-aware backward-compat checker becomes a build-script affordance.

**Wave 3A — DRIFT FIXES** (closes the four drifts found during the Wave 2 §7 header pass):
- **§7.4 `@auth.read/write`.** Closed-set `Access` enforcement: `{public, owner, scope, server}`. Mismatch fires **E003** via the same string-membership path used by `@transport(kind: ...)` (DRIFT-1).
- **§7.x — centralised site validation.** Every directive signature now declares `sites: Site[]` (`'SCHEMA' | 'RECORD' | 'FIELD' | 'ENUM' | 'ENUM_VALUE' | 'ARGUMENT' | 'EVENT' | 'ACTION' | 'OPAQUE'`). Validator runs a single `checkSite()` pass per directive node; mismatches fire **E029**. Existing E028 / E006 / E024 keep their tailored messages and fire alongside E029 only at sites where they were already defined (DRIFT-2).
- **§7.2 `@crdt.key`.** Conditional-required encoded as a per-arg `requiredIf` predicate. `key` is required iff `type` is `LWW_*`; the existing E004 message stays canonical and the generic E023 path is suppressed for that exact pair to avoid double-reporting (DRIFT-3).
- **§7.10 `@range.min/max`.** Explicit `number` arg type (Int or Float literal). Site widened to FIELD | ARGUMENT (action input arguments accept `@range` per real-world fixtures — `pharos/Belladonna/schema/reader.aql`). Per-field type compatibility (R180) remains a separate E015 check (DRIFT-4).
- **§7.11 `@deprecated`, §7.12 `@added`.** Sites widened to include EVENT and ARGUMENT per R068 (events MAY carry deprecation markers).
- **§7.13 `@topic`.** Site widened to include EVENT per R068.

**Wave 3B — new directives + R236 + backward-compat plumbing.**

- **§7.19 — new directive `@envelope(kind: snapshot|stream|event|patch|ask)` on RECORD | EVENT | ACTION.** Single source of truth for QoS/ordering/retention/CRDT-mode. Each preset expands at codegen time into a default tuple; sibling-directive overrides apply per-axis. **W008** fires on incoherent overrides (today: `@envelope(stream|event)` paired with `@crdt`/`@crdt_doc_member` since the preset implies `crdt_mode: none`). R270–R272 normative.
- **§7.20 — new directive `@conflict(strategy: lww|operator_review)` on RECORD.** CRDT merge strategy. Default `lww`; `operator_review` routes conflicts to a side-channel surfaced to UI Кладенец. Meaningful only with `@crdt_doc_member`. R280 normative.
- **§7.21 — new directive `@bootstrap(mode: crdt_sync|full_snapshot)` on SCHEMA.** Composite-document handshake mode. Default `crdt_sync` triggers Automerge sync handshake on (re)connect — closes the **offline-resurrection bug** where `full_snapshot` mode replays a peer's local-only edits as if remote. R290–R291 normative.
- **§7.22 — new directive `@large(threshold_kb: Int!)` on FIELD.** Field-level large-blob splitting. Field type MUST be `Bytes` or `Bytes!`; codegen emits a sub-topic publish (`<topic>/blob/{blob_id}`) for the binary payload and replaces the value in the main message with a `blob_id` reference; below the threshold the field rides inline. R300–R301 normative.
- **§7.15 — R236: hard-delete forbidden on `@crdt_doc_member`.** `soft_delete: { flag, ts_field }` is now **required** by default; missing fires **E030**. Records that genuinely need hard delete (legacy wire contracts, e.g. Busynca `DeviceEntry`) MUST opt out with `@breaking_change(reason: "...")` (§7.25). Reason: hard delete on a CRDT map is not deterministic across rejoining peers — soft-delete + LWW timestamp is the deterministic floor.
- **§7.23 — new directive `@deprecated_field(replaced_by: String?)` on FIELD.** Soft-deprecation. Codegen emits **W009**; baseline-checker (v0.4) classifies removal as soft (W009) vs. breaking (E031). R310 normative.
- **§7.24 — new directive `@retired_topic` on SCHEMA.** Marker permitting `@crdt_doc_topic` removal under the baseline-checker (E032 opt-out). Consumed only by v0.4 checker; parse-time recognition only in v0.3.9. R320 normative.
- **§7.25 — new directive `@breaking_change(reason: String!)` on SCHEMA | RECORD | FIELD | EVENT | ACTION | ENUM.** Opt-in for wire-incompatible changes; required `reason:` self-documents the diff. Doubles as the R236 opt-out. R330 normative.

- **§12 — new validation codes.**
  - **E029** centralised site-mismatch (Wave 3A — DRIFT-2).
  - **E030** hard-delete on `@crdt_doc_member` without `soft_delete` (Wave 3B — R236).
  - **E031** *(deferred to v0.4)* required field type changed without `@breaking_change`.
  - **E032** *(deferred to v0.4)* topic removed without `@retired_topic`.
  - **E033** *(deferred to v0.4)* `@schema_version` downgraded.
  - **E034** *(deferred to v0.4)* `@rename_case` changed without `@breaking_change`.
  - **W007** *(deferred to v0.4)* optional field added in middle of record (array-frozen consumers).
  - **W008** `@envelope` override-coherence.
  - **W009** `@deprecated_field` advisory.

- **CLI `aqc build --baseline=<git-ref>` (stub).** Validates the git-ref resolves and emits a single advisory; full IR-vs-baseline diff (E031–E034 + W007) lands in v0.4. The flag is wired today so build scripts can adopt it without churn.

- **IR additions.** `DirectiveSignature.sites: Site[]`; per-arg `ArgSpec` form supporting `enumValues` and `requiredIf` predicates inline (signature-level fields stay valid for back-compat). Helpers `argType()` / `argEnumValues()` / `argRequiredIf()` consolidate the dual-form lookup.

## 0.3.8 (2026-04-25) — wire-parity close, AI-First SPEC restructure

- **§4.1** — `Float32` formally listed as a built-in scalar (already in code via `BUILTIN_SCALARS`; the legacy sokol/v1 fixture relies on it 11 times). IEEE 754 binary32. Closes the silent gap that produced E009 for any schema that named the scalar.
- **§12** — `E021` added to the catalog (`use` imports an undeclared name from a module). Already emitted by `linker.ts:148-164`; SPEC catalog had skipped from E020 to E022.
- **SPEC restructure (no normative change)**: §8 Cookbook + §9 Intent-to-syntax → `docs/cookbook.md`; §10 IR JSON → `schema/ir.schema.json`; §11 wire mapping → `../graph-zenoh/WIRE.md`; §15 Changelog → this file. SPEC.md drops from ~1660 LOC to ~700 LOC.

## 0.3.7 (2026-04-24) — `@rename_case`, soft-delete in composite documents

Additive (one new directive, extended `@crdt_doc_member`, one new validation code, parser gains object-literal value kind). Driven by the second wave of Valkyrie/Busynca wire-parity: existing Rust types on the wire use `rename_all = "PascalCase"` on enums and `rename_all = "camelCase"` on legacy sokol/v1 records, neither expressible in 0.3.6 SDL. Additionally, Busynca's `SyncPoint` uses a soft-delete pattern (`is_deleted: bool` + `updated_at: i64`) that 0.3.6's hard-delete `@crdt_doc_member` could not match without breaking wire-parity on merge.

- **§7.18 — new directive `@rename_case(kind: PASCAL|CAMEL|SNAKE|SCREAMING_SNAKE|KEBAB|LOWER|UPPER)` on ENUM | RECORD.** Emitted as `#[serde(rename_all = "<variant>")]` by Rust generators. Default behaviour is unchanged for schemas that omit the directive (`SCREAMING_SNAKE_CASE` on enums for `@alaq/graph-zenoh`, no `rename_all` on records). R260–R261 normative. Closes the `PointKind` / `DeviceRole` / `BortSysTelemetry` wire-parity gap with Busynca.
- **§7.15 — extended `@crdt_doc_member` with optional `lww_field` and `soft_delete`.** `lww_field: String` explicitly names the LWW key field (falls back to `@crdt(key: ...)`, then `updated_at`). `soft_delete: { flag: String!, ts_field: String! }` — object literal describing the tombstone-by-flag pattern. When present, `delete_<map>` writes `flag: true` + `ts_field: ts` into the entry's JSON instead of removing the Automerge cell. R234–R235 normative. Matches Busynca's `SyncPoint.is_deleted` convention; `DeviceEntry` leaves `soft_delete` absent for hard-delete semantics. Validator emits **E027** for missing/mistyped targets.
- **§12 — new error `E028`.** `@rename_case` applied to a non-enum, non-record declaration.
- **IR additions.** `DIRECTIVE_SIGS.rename_case` (closed-set `kind`). Extension of `DIRECTIVE_SIGS.crdt_doc_member` (optional `lww_field`, optional `soft_delete`). Parser gains an object-literal value kind in directive-arg position.

## 0.3.6 (2026-04-24) — `Any`, composite CRDT documents

Additive (new built-in scalar, three new directives, two new validation codes). Driven by the Valkyrie/Busynca wire-parity requirement: the existing SDL could not describe a single Automerge document carrying multiple root maps plus a `schema_version` pin, nor a CBOR-opaque extension bag inside an otherwise-typed record.

- **§4.1 — new built-in scalar `Any`.** Runtime-typed opaque CBOR value. Permitted only as a `record` field type or as the value type of a `Map<K, Any>`. Forbidden in action input/output, event fields, list elements, and map keys — enforced by **E026**.
- **§7.15 — new directive `@crdt_doc_member(doc, map)` on RECORD.** Composite Automerge document membership. R230–R233 normative.
- **§7.16 — new directive `@crdt_doc_topic(doc, pattern)` on SCHEMA.** R240–R241 normative.
- **§7.17 — new directive `@schema_version(doc, value)` on SCHEMA.** Drop-and-rebuild migration on version mismatch. R250–R251 normative.
- **§12 — two new errors.** **E026**, **E027**.

## 0.3.5 (2026-04-21) — `@transport` enforcement: W005 → E025

Normative tightening + behavioural for one tight slice (generators refuse on mismatch).

- **§7.14 R221/R224.** Mismatch between `IRSchema.transport` and a generator's `supportedTransports` list is now an **error**, not a warning. Generators emit a single `E025` diagnostic and return `files: []`; no partial artifacts. R222 retained — missing `@transport` ≡ `@transport(kind: "any")`.
- **§12.** **E025** added; **W005** retired (entry kept as a back-compat tombstone).
- **Rationale.** W005 was validation-theatre: `graph-zenoh.generate(http-schema)` printed "W005 mismatch; generation proceeds" and emitted bogus code that downstream consumers happily compiled. The advisory frame trained users to ignore the warning.

## 0.3.4 (2026-04-20) — events, `@transport`, map-key normalisation

Behavioural (parser normalisation, schema-level directives, event keyword) + additive (IR/§10) + normative (§4.8, §7.14, §5.5, W005, E024).

- **New §5.5 "Events" (W9)** — first-class `event Name { … }`. Strict keyword `event`. R065–R069 normative. Wire mapping ties `app.emit("<snake_name>", payload)` to `@alaq/graph-tauri-rs`. IR: `IRSchema.events`. Diagnostic E024 (event with `@scope`).
- **New §7.14 `@transport` (W8)** — schema-level marker directive. R220–R223. Closed value set `{tauri, http, zenoh, any}`.
- **Grammar** — `SchemaDecl` extended: `"schema" Identifier { Directive } "{" SchemaField+ "}"`.
- **IR additions** — `SchemaBlock.transport?`, `SchemaBlock.directives?`. Both optional.
- **W005 (now retired in 0.3.5)** — generator-emitted advisory on `@transport` mismatch.
- **New R023 (§4.8)** — `Map<K, V>` map-key normalisation: `mapKey.required` is always `true`. Parser fixes downstream Rust generators emitting `HashMap<Option<K>, V>` for what is semantically `HashMap<K, V>`.

## 0.3.3 (2026-04-20) — contextual keywords, scope boundaries, §17

Text-only normative clarifications + behavioural (contextual keywords).

- **§7.5 `@scope`** — three normative rules added: R135 (single-axis), R136 (auth is not scope), R137 (transport is not scope).
- **New §17 "Out of scope"** — single normative source for what the SDL deliberately does not describe. R700: adding any of these as first-class requires cross-consumer justification + spec bump.
- **New §2.1 "Reserved names and contextual keywords"** + R005, R006. Parser now accepts `version`, `namespace`, `scope`, `input`, `output`, `qos`, `max_size` as ordinary identifiers in field-name / arg-name / enum-member / type-expression positions. Unblocks `record VersionRef { version: String! }` (Arsenal stress-test F-01).

## 0.3.2 (2026-04-20) — leading comments

Additive.

- **IR additions**: optional `leadingComments: string[]` on `Record`, `Action`, `Enum`, `Scalar`, `Opaque`. Consecutive `#`-comment lines immediately preceding a top-level declaration are surfaced for generator consumption.
- **Lexer change (additive)**: comments now emit `COMMENT` tokens (payload = body with leading `#` and one optional space stripped).

## 0.3 (2026-04-18) — `Map<K, V>`

- **New type constructor**: `Map<K, V>` (§4.8, §2 EBNF). Scalar keys only — see **E022**.
- **R003 clarified**: enum member lists accept comma-less and comma-separated entries.
- **IR additions**: `Field.map`, `Field.mapKey`, `Field.mapValue`; new `TypeRef` definition.
- **New validation code**: **E022** (Map key must be scalar).

---

## Deferred

- **R400** (byte-identical wire across deployments): no implementation. **(deferred to v0.4)**
- **R500/R501** (`specVersion` metadata in generated code, runtime compatibility check on connect): no `specVersion` references in any generator as of 0.3.9. **(deferred to v0.4)**
- **Baseline-checker (Wave 3B B7)**: `aqc build --baseline=<git-ref>` is wired in 0.3.9 as a stub — validates the ref resolves, emits a single advisory. Full IR-vs-baseline diff that fires **E031–E034 + W007** lands in v0.4. The flag is callable today so build scripts can adopt it without churn at the version bump.
