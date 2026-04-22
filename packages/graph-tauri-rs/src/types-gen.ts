// @alaq/graph-tauri-rs — `types.rs` emitter.
//
// Emits:
//   • User-scalar aliases     (pub type DeviceID = String;)
//   • Enums                   (pub enum Channel + serde rename_all = "snake_case")
//   • Record structs          (pub struct PackageMeta + Debug/Clone/Serialize/Deserialize)
//   • Action Input structs    (pub struct <Action>Input)
//   • AppError re-export      (pub use <rtCrate>::AppError; — single canonical
//                              definition lives in alaq-graph-tauri-rt per C3)
//
// Conventions (agreed in C.1/C.2):
//   - snake_case Rust fields, snake_case SDL fields, snake_case TS — no
//     `#[serde(rename_all = "camelCase")]` on anything by default. We still
//     emit a per-field `#[serde(rename = "…")]` when the *source* SDL name
//     disagrees with its snake form (e.g. camelCase field in an aql file).
//   - Enum variant names stay as the SDL identifier (PascalCase if the
//     author wrote them that way; otherwise lowercase-as-written). The
//     `#[serde(rename = "<sdl>")]` attribute ensures the wire literal
//     matches the SDL text exactly — Tauri serialises via serde.
//
// AppError is a typed `{ kind, message }` enum defined ONCE in
// `alaq-graph-tauri-rt` (C3). Tauri v2 serialises `Result::Err(AppError)`
// through serde; `graph-tauri` (TS side) branches on `kind`. Per-namespace
// `types.rs` merely re-exports it so generated handler/command code can
// keep using the bare `AppError` ident.

import type { IRAction, IREnum, IREvent, IRRecord, IRScalar } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  mapFieldType,
  renderDirectiveComment,
  rustIdent,
  snakeCase,
} from './utils'

// ────────────────────────────────────────────────────────────────
// User-defined scalars
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

/**
 * Rust-variant name for an SDL enum value.
 *
 * Rule: if the SDL value is already PascalCase (e.g. `LOBBY`, `GameActive`),
 * we keep a PascalCased form; snake_case values (`windows_msi`) are
 * converted to PascalCase (`WindowsMsi`). The wire literal is pinned
 * by `#[serde(rename = "<sdl>")]` so the SDL text is authoritative.
 */
export function enumVariantName(value: string): string {
  // If already all-uppercase (SCREAMING_SNAKE) or snake_case, split by `_`.
  if (/_/.test(value) || /^[A-Z0-9_]+$/.test(value)) {
    return value
      .split('_')
      .filter(Boolean)
      .map(p => p[0].toUpperCase() + p.slice(1).toLowerCase())
      .join('')
  }
  // Already PascalCase / camelCase — normalize first letter.
  return value[0].toUpperCase() + value.slice(1)
}

export function emitEnum(buf: LineBuffer, e: IREnum) {
  buf.line(`// SDL: enum ${e.name} { ${e.values.join(', ')} }`)
  buf.line(`#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]`)
  buf.line(`pub enum ${e.name} {`)
  buf.indent()
  for (const v of e.values) {
    const variant = enumVariantName(v)
    // Pin the wire representation to the SDL text; Tauri IPC → JSON on the
    // wire; matching both sides requires an explicit rename per variant so
    // agents debugging traffic see the SDL text as-is.
    if (variant !== v) {
      buf.line(`#[serde(rename = "${v}")]`)
    }
    buf.line(`${variant},`)
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

function needsRenameAttr(fieldName: string, snake: string): boolean {
  return fieldName !== snake
}

export function emitRecordStruct(
  buf: LineBuffer,
  rec: IRRecord,
  ctx: TypeContext,
) {
  const directives = rec.directives ?? []
  const dirText = directives.map(renderDirectiveComment).join(' ')
  buf.line(`// SDL: record ${rec.name}${dirText ? ` ${dirText}` : ''}`)

  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  buf.line(`pub struct ${rec.name} {`)
  buf.indent()
  for (const f of rec.fields) {
    for (const d of f.directives ?? []) {
      buf.line(`// ${renderDirectiveComment(d)}`)
    }
    const snake = snakeCase(f.name)
    if (needsRenameAttr(f.name, snake)) {
      buf.line(`#[serde(rename = "${f.name}")]`)
    }
    const rustType = mapFieldType(f, ctx)
    buf.line(`pub ${rustIdent(snake)}: ${rustType},`)
  }
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
// Event payload structs (v0.3.4 / W9)
// ────────────────────────────────────────────────────────────────
//
// An `event Name { … }` compiles to a struct with the same shape as a
// `record` of the same fields — it's a wire payload, nothing more. We emit
// it here (not in events-gen.ts) so the struct is visible as
// `use super::types::*` from both `events.rs` (for the emit helper) and
// from user handlers that want to build the payload before publishing.

export function emitEventStruct(
  buf: LineBuffer,
  ev: IREvent,
  ctx: TypeContext,
) {
  const directives = ev.directives ?? []
  const dirText = directives.map(renderDirectiveComment).join(' ')
  buf.line(`// SDL: event ${ev.name}${dirText ? ` ${dirText}` : ''}`)

  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  buf.line(`pub struct ${ev.name} {`)
  buf.indent()
  for (const f of ev.fields) {
    for (const d of f.directives ?? []) {
      buf.line(`// ${renderDirectiveComment(d)}`)
    }
    const snake = snakeCase(f.name)
    if (needsRenameAttr(f.name, snake)) {
      buf.line(`#[serde(rename = "${f.name}")]`)
    }
    const rustType = mapFieldType(f, ctx)
    buf.line(`pub ${rustIdent(snake)}: ${rustType},`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitEventPayloads(
  buf: LineBuffer,
  events: Record<string, IREvent>,
  ctx: TypeContext,
) {
  const names = Object.keys(events).sort()
  for (const name of names) emitEventStruct(buf, events[name], ctx)
}

// ────────────────────────────────────────────────────────────────
// Action Input structs
// ────────────────────────────────────────────────────────────────

function hasInput(action: IRAction): boolean {
  return (action.input ?? []).length > 0
}

export function emitActionInput(
  buf: LineBuffer,
  action: IRAction,
  ctx: TypeContext,
) {
  if (!hasInput(action)) return
  buf.line(`// SDL: action ${action.name} — input struct`)
  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  buf.line(`pub struct ${action.name}Input {`)
  buf.indent()
  for (const f of action.input!) {
    for (const d of f.directives ?? []) {
      buf.line(`// ${renderDirectiveComment(d)}`)
    }
    const snake = snakeCase(f.name)
    if (needsRenameAttr(f.name, snake)) {
      buf.line(`#[serde(rename = "${f.name}")]`)
    }
    buf.line(`pub ${rustIdent(snake)}: ${mapFieldType(f, ctx)},`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitActionInputs(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const names = Object.keys(actions).sort()
  for (const name of names) emitActionInput(buf, actions[name], ctx)
}

// ────────────────────────────────────────────────────────────────
// AppError — re-export from runtime crate (C3, no per-namespace enum)
// ────────────────────────────────────────────────────────────────

/**
 * Emit a re-export line that pulls `AppError` in from the runtime crate.
 *
 * Prior to C3 the generator emitted a full `pub enum AppError { … }` into
 * each namespace's `types.rs`. That produced N identical copies across a
 * consumer with N namespaces (same variants, same serde tagging). C3 moved
 * the canonical definition to `alaq-graph-tauri-rt` (see
 * `crates/alaq-graph-tauri-rt/src/error.rs`); the generator now just
 * re-exports it so every namespace keeps a local `AppError` ident in scope
 * — `use super::types::*;` downstream doesn't have to change.
 *
 * Shape on wire is unchanged: `{ "kind": "<variant>", "message": "<text>" }`
 * via `#[serde(tag="kind", rename_all="snake_case")]`.
 */
export function emitAppError(buf: LineBuffer, rtCrate: string) {
  buf.line(`// ────────────────────────────────────────────────────────────────`)
  buf.line(`// AppError — re-exported from the runtime crate`)
  buf.line(`// ────────────────────────────────────────────────────────────────`)
  buf.blank()
  buf.line(`// Single canonical definition lives in \`${rtCrate}::error\`. Every`)
  buf.line(`// generated namespace re-exports it so \`super::types::AppError\` stays a`)
  buf.line(`// working import path. See C3 in stress.md for the rationale.`)
  buf.line(`pub use ${rtCrate}::AppError;`)
  buf.blank()
}
