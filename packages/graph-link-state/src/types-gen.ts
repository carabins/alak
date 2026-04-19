// @alaq/graph-link-state — TS interface emitter (`I<Record>`).
//
// Plain value-shape interfaces for every record. Fields are `readonly`:
// generated interfaces describe a replicated snapshot, not a draft. Writes
// happen through the SyncNode, not by mutating the plain value.
//
// Directives on fields become leading comments — semantics are the runtime's
// job, not the interface's.

import type { IRDirective, IRField, IRRecord } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  mapFieldType,
  renderDirectiveComment,
} from './utils'

/**
 * Pick the directives that should surface as JSDoc (IDE-visible) vs. plain
 * comments. `@range`, `@deprecated`, `@default`, `@auth` carry per-field
 * semantics worth showing on hover; others stay as plain comments.
 */
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
    // Bareword enums stay unquoted; other primitives use JSON form.
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

  // JSDoc block — IDE-visible. Emits only when at least one JSDoc-worthy
  // directive is present. Keeps single-directive blocks on two lines for
  // consistency (the trailing ` */` is load-bearing for tooltip parsers).
  if (jsdocDirs.length > 0) {
    buf.line(`/**`)
    for (const d of jsdocDirs) {
      const line = renderJSDocLine(d)
      if (line) buf.line(` * ${line}`)
    }
    buf.line(` */`)
  }
  // Plain comments for the rest — preserves the pre-0.3 output shape for
  // `@sync`, `@crdt`, `@atomic`, etc.
  for (const d of plainDirs) {
    buf.line(`// ${renderDirectiveComment(d)}`)
  }
}

export function emitRecordInterface(
  buf: LineBuffer,
  rec: IRRecord,
  ctx: TypeContext,
) {
  // Documentation: the SDL shape, for humans reading the generated file.
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

export function emitInterfaces(
  buf: LineBuffer,
  records: Record<string, IRRecord>,
  ctx: TypeContext,
) {
  const names = Object.keys(records).sort()
  for (const name of names) {
    emitRecordInterface(buf, records[name], ctx)
  }
}
