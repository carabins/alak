// @alaq/graph-axum — types.rs emitter.
//
// Emits:
//   • User scalars        → `pub type X = String;`
//   • Enums               → `pub enum`, rename_all chosen by value-casing
//                           heuristic (see utils.pickEnumRenameAll).
//   • Records             → `pub struct` with `#[derive(Debug, Clone,
//                           Serialize, Deserialize)]`. Field names are
//                           snake_cased; when the SDL field already differed
//                           from snake, a `#[serde(rename = "...")]`
//                           preserves the on-wire name.
//   • Action Input        → `pub struct <Action>Input { ... }` ONLY when
//                           the action declares input fields. Empty-input
//                           actions emit no struct (C2 — 2026-04-21): the
//                           dispatcher drops the `Json<Input>` extractor and
//                           the handler trait method drops its `input`
//                           parameter, matching a body-less POST on the wire.
//
// Note (C1 cleanup — 2026-04-21): <Action>Output types are NOT emitted.
// Output shapes are spelled inline in the handlers trait and route
// dispatchers as bare Rust types (`Vec<T>` / `T` / `Option<T>` / `()`).
// A `#[serde(transparent)]` Vec newtype is wire-identical to a bare Vec,
// so we pay zero at the wire and save one type per action.
//
// Convention (C.1/C.2): snake_case everywhere. We do NOT emit
// `#[serde(rename_all = "camelCase")]` on structs. The on-wire JSON stays
// snake — matches what we generate for Tauri commands and the TS client.

import type { IRAction, IREnum, IRField, IRRecord, IRScalar } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  enumVariantName,
  mapFieldType,
  pickEnumRenameAll,
  rustIdent,
  snakeCase,
} from './utils'

// ────────────────────────────────────────────────────────────────
// User scalars
// ────────────────────────────────────────────────────────────────

export function emitUserScalars(buf: LineBuffer, scalars: Record<string, IRScalar>) {
  const names = Object.keys(scalars).sort()
  for (const name of names) {
    buf.line(`// SDL: scalar ${name}`)
    buf.line(`pub type ${name} = String;`)
  }
  if (names.length > 0) buf.blank()
}

// ────────────────────────────────────────────────────────────────
// Enums
// ────────────────────────────────────────────────────────────────

export function emitEnum(buf: LineBuffer, e: IREnum) {
  const rename = pickEnumRenameAll(e.values)
  buf.line(`// SDL: enum ${e.name} { ${e.values.join(', ')} }`)
  buf.line(`#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]`)
  buf.line(`#[serde(rename_all = "${rename}")]`)
  buf.line(`pub enum ${e.name} {`)
  buf.indent()
  for (const v of e.values) {
    buf.line(`${enumVariantName(v)},`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitEnums(buf: LineBuffer, enums: Record<string, IREnum>) {
  const names = Object.keys(enums).sort()
  for (const name of names) emitEnum(buf, enums[name])
}

// ────────────────────────────────────────────────────────────────
// Records
// ────────────────────────────────────────────────────────────────

function emitStructFields(buf: LineBuffer, fields: IRField[], ctx: TypeContext) {
  for (const f of fields) {
    const snake = snakeCase(f.name)
    if (snake !== f.name) {
      buf.line(`#[serde(rename = "${f.name}")]`)
    }
    const rustType = mapFieldType(f, ctx)
    buf.line(`pub ${rustIdent(snake)}: ${rustType},`)
  }
}

export function emitRecordStruct(
  buf: LineBuffer,
  rec: IRRecord,
  ctx: TypeContext,
) {
  buf.line(`// SDL: record ${rec.name}`)
  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  if (rec.fields.length === 0) {
    buf.line(`pub struct ${rec.name} {}`)
    buf.blank()
    return
  }
  buf.line(`pub struct ${rec.name} {`)
  buf.indent()
  emitStructFields(buf, rec.fields, ctx)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitRecords(
  buf: LineBuffer,
  records: Record<string, IRRecord>,
  ctx: TypeContext,
) {
  const names = Object.keys(records).sort()
  for (const name of names) emitRecordStruct(buf, records[name], ctx)
}

// ────────────────────────────────────────────────────────────────
// Action Input / Output types
// ────────────────────────────────────────────────────────────────

/** Emit `<Action>Input` only when the SDL action declares input fields.
 *
 *  C2 (2026-04-21): empty-input actions produce NO `Input` struct at all —
 *  the dispatcher (routes.rs) drops the `Json<Input>` extractor, and the
 *  handler trait method drops its `input` parameter. The route stays
 *  mounted so the client can still `POST /<action>` with no body. */
export function emitActionInput(
  buf: LineBuffer,
  action: IRAction,
  ctx: TypeContext,
) {
  const name = `${action.name}Input`
  const input = action.input ?? []
  if (input.length === 0) return
  buf.line(`// SDL: action ${action.name} — input`)
  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  buf.line(`pub struct ${name} {`)
  buf.indent()
  emitStructFields(buf, input, ctx)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitActionTypes(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const names = Object.keys(actions).sort()
  for (const name of names) {
    const a = actions[name]
    emitActionInput(buf, a, ctx)
  }
}
