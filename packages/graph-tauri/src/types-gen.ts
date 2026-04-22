// @alaq/graph-tauri — TS interface emitter.
//
// Emits two kinds of interfaces:
//   • `I<Record>`       — plain value-shape per SDL record; fields `readonly`
//                         (snapshot semantics, writes go through actions).
//   • `I<Action>Input`  — per-action input object; each action's input is
//                         wrapped in an interface so call-sites get a single
//                         stable type even if the SDL grows more fields.
//
// Field names are emitted **as-is** (SDL's snake_case is kept). This matches
// the Rust-side default (`fn foo(input: FooInput)` with `#[derive(Deserialize)]`,
// no `#[serde(rename_all)]`) — wire traffic reads straight, no mental mapping.

import type { IRAction, IRDirective, IREvent, IRField, IRRecord } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  mapFieldType,
  renderDirectiveComment,
} from './utils'

// ─── Field-level JSDoc: @range, @deprecated, @default, @auth ────

const JSDOC_DIRECTIVES = new Set(['range', 'deprecated', 'default', 'auth'])

function renderJSDocLine(d: IRDirective): string | null {
  if (d.name === 'range') {
    const args = d.args ?? {}
    const parts: string[] = []
    if (args.min !== undefined) parts.push(`min=${args.min}`)
    if (args.max !== undefined) parts.push(`max=${args.max}`)
    return `@range ${parts.join(' ')}`.trimEnd()
  }
  if (d.name === 'deprecated') {
    const since = d.args?.since
    const reason = d.args?.reason
    const bits = ['@deprecated']
    if (since) bits.push(`since ${since}`)
    if (reason) bits.push(`— ${reason}`)
    return bits.join(' ')
  }
  if (d.name === 'default') {
    const v = d.args?.value
    const rendered =
      v === undefined ? '' :
      typeof v === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(v) ? v :
      JSON.stringify(v)
    return `@default ${rendered}`.trimEnd()
  }
  if (d.name === 'auth') {
    const r = d.args?.read
    const w = d.args?.write
    const bits: string[] = []
    if (r) bits.push(`read=${r}`)
    if (w) bits.push(`write=${w}`)
    return `@auth ${bits.join(' ')}`.trimEnd()
  }
  return null
}

function emitFieldDoc(buf: LineBuffer, f: IRField) {
  const dirs = f.directives ?? []
  const jsdocDirs = dirs.filter(d => JSDOC_DIRECTIVES.has(d.name))
  const plainDirs = dirs.filter(d => !JSDOC_DIRECTIVES.has(d.name))

  if (jsdocDirs.length > 0) {
    buf.line(`/**`)
    for (const d of jsdocDirs) {
      const line = renderJSDocLine(d)
      if (line) buf.line(` * ${line}`)
    }
    buf.line(` */`)
  }
  for (const d of plainDirs) {
    buf.line(`// ${renderDirectiveComment(d)}`)
  }
}

// ─── Record interface ─────────────────────────────────────────────

export function emitRecordInterface(
  buf: LineBuffer,
  rec: IRRecord,
  ctx: TypeContext,
) {
  const directiveText =
    (rec.directives ?? []).map(renderDirectiveComment).join(' ')
  const header = directiveText
    ? `// SDL: record ${rec.name} ${directiveText}`
    : `// SDL: record ${rec.name}`
  buf.line(header)

  buf.line(`export interface I${rec.name} {`)
  buf.indent()
  for (const f of rec.fields) {
    emitFieldDoc(buf, f)
    const ts = mapFieldType(f, ctx)
    const optional = f.required ? '' : '?'
    buf.line(`readonly ${f.name}${optional}: ${ts}`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitRecordInterfaces(
  buf: LineBuffer,
  records: Record<string, IRRecord>,
  ctx: TypeContext,
) {
  const names = Object.keys(records).sort()
  for (const name of names) {
    emitRecordInterface(buf, records[name], ctx)
  }
}

// ─── Event payload interfaces (v0.3.4 / W9) ──────────────────────
//
// Events share the record-interface shape. They live in a dedicated
// section purely so readers can tell at a glance which types flow as
// broadcasts vs. which are state. The emitted interface name is still
// `I<EventName>` — no prefix beyond that, matching records.

export function emitEventInterface(
  buf: LineBuffer,
  ev: IREvent,
  ctx: TypeContext,
) {
  const directiveText =
    (ev.directives ?? []).map(renderDirectiveComment).join(' ')
  const header = directiveText
    ? `// SDL: event ${ev.name} ${directiveText}`
    : `// SDL: event ${ev.name}`
  buf.line(header)

  buf.line(`export interface I${ev.name} {`)
  buf.indent()
  for (const f of ev.fields) {
    emitFieldDoc(buf, f)
    const ts = mapFieldType(f, ctx)
    const optional = f.required ? '' : '?'
    buf.line(`readonly ${f.name}${optional}: ${ts}`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitEventInterfaces(
  buf: LineBuffer,
  events: Record<string, IREvent>,
  ctx: TypeContext,
) {
  const names = Object.keys(events).sort()
  for (const name of names) emitEventInterface(buf, events[name], ctx)
}

// ─── Action Input interfaces ──────────────────────────────────────
//
// Skipped entirely for empty-input actions (C2, 2026-04-21): the TS wrapper
// for such actions is `async function foo(): Promise<T>` — no argument, no
// `I<Action>Input` needed. Emitting an empty `{}` interface was dead weight
// and forced consumers into `invoke('foo', { input: {} })` bloat on the wire.

export function emitActionInputInterface(
  buf: LineBuffer,
  action: IRAction,
  ctx: TypeContext,
) {
  const inputs = action.input ?? []
  if (inputs.length === 0) return
  buf.line(`// SDL: action ${action.name} input`)
  buf.line(`export interface I${action.name}Input {`)
  buf.indent()
  for (const f of inputs) {
    emitFieldDoc(buf, f)
    const ts = mapFieldType(f, ctx)
    const optional = f.required ? '' : '?'
    buf.line(`readonly ${f.name}${optional}: ${ts}`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitActionInputInterfaces(
  buf: LineBuffer,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const names = Object.keys(actions).sort()
  for (const name of names) {
    emitActionInputInterface(buf, actions[name], ctx)
  }
}
