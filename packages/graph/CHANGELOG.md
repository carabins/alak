# @alaq/graph — SPEC Changelog

Normative history of the `.aql` SPEC. Current SPEC version: **0.3.8**.
Source of truth for behaviour: `./SPEC.md`. This file records *what changed when* and *why*.

Versioning policy:
- **Minor bump** (0.2 → 0.3): new directives, new scalars, new type constructors, new enum values in existing spec enums, new validation codes. Backwards-compatible for existing `.aql`.
- **Major bump** (0.x → 1.0): grammar changes, directive removals, IR breaking changes. Requires migration document.

---

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
- **R500/R501** (`specVersion` metadata in generated code, runtime compatibility check on connect): no `specVersion` references in any generator as of 0.3.8. **(deferred to v0.4)**
