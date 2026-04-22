// @alaq/graph-tauri — generic utilities for the TS emitter.
//
// Zero runtime dependencies. Pure string helpers + type mapping. Mirrors
// the `@alaq/graph-link-state` utility module so downstream generator code
// is symmetric between the two TS targets; the map-to-`Record<K,V>` choice
// and scalar-family sets come from there and are kept in sync intentionally.

import type { IRField, IREnum, IRScalar, IRSchema, IRTypeRef, IRAction } from '@alaq/graph'

// ────────────────────────────────────────────────────────────────
// Naming
// ────────────────────────────────────────────────────────────────

/** PascalCase stays PascalCase. Already the SDL convention for records/actions/enums. */
export function pascalCase(name: string): string {
  if (!name) return name
  return name[0].toUpperCase() + name.slice(1)
}

/** PascalCase -> camelCase. Used for action call-site names (R063). */
export function camelCase(name: string): string {
  if (!name) return name
  return name[0].toLowerCase() + name.slice(1)
}

/**
 * `RenderMarkdown` → `render_markdown`, `HTTPSConnect` → `https_connect`.
 * Handles embedded digits (`V2Action` → `v2_action`) and existing underscores
 * (`Already_Snake` is left largely alone but still lowercased).
 *
 * Rules:
 *   - split on lower→Upper boundary: `foo|Bar`
 *   - split inside acronym run followed by Pascal: `HTTPS|Connect`
 *   - split on letter→digit and digit→letter transitions only when the
 *     next letter is uppercase (keeps `semver2` intact while splitting
 *     `V2Action`).
 *   - collapse runs of `_`, trim leading/trailing `_`, lowercase the result.
 */
export function snakeCase(name: string): string {
  if (!name) return name
  let out = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
  out = out.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return out.toLowerCase()
}

// ────────────────────────────────────────────────────────────────
// Built-in scalar mapping (SPEC §4.1)
// ────────────────────────────────────────────────────────────────

const BUILTIN_STRING = new Set(['ID', 'String', 'UUID', 'DeviceID', 'Bytes'])
const BUILTIN_NUMBER = new Set(['Int', 'Float', 'Timestamp', 'Duration'])
const BUILTIN_BOOLEAN = new Set(['Boolean'])

export interface TypeContext {
  enums: Record<string, IREnum>
  scalars: Record<string, IRScalar>
  records: Record<string, { name: string }>
}

/**
 * Map an SDL scalar/base name to a raw TS type (no optionality, no list
 * wrapping). For user-defined records the result is `I<Record>`.
 */
export function mapBaseType(name: string, ctx: TypeContext): string {
  if (BUILTIN_STRING.has(name)) return 'string'
  if (BUILTIN_NUMBER.has(name)) return 'number'
  if (BUILTIN_BOOLEAN.has(name)) return 'boolean'
  if (ctx.enums[name]) return name
  if (ctx.scalars[name]) return 'string'
  if (ctx.records[name]) return `I${name}`
  return 'unknown'
}

/**
 * Map an IR type reference (from map key/value slots) to a TS type.
 * Handles nested maps, lists, and scalars recursively.
 *
 * `Record<K, V>` is used for maps — same rationale as in
 * `@alaq/graph-link-state` (string-keyed wire shape, JSON-friendly,
 * composes with Vue/React reactivity).
 */
export function mapTypeRef(ref: IRTypeRef, ctx: TypeContext): string {
  if (ref.map) {
    const k = mapTypeRef(ref.mapKey!, ctx)
    const v = mapTypeRef(ref.mapValue!, ctx)
    return `Record<${k}, ${v}>`
  }
  if (ref.list) {
    const base = mapBaseType(ref.type, ctx)
    const item = ref.listItemRequired === false ? `(${base} | undefined)` : base
    return `${item}[]`
  }
  return mapBaseType(ref.type, ctx)
}

/**
 * Map a full IRField to a TS type annotation (list + map + required handled).
 */
export function mapFieldType(field: IRField, ctx: TypeContext): string {
  if (field.map) {
    const k = mapTypeRef(field.mapKey!, ctx)
    const v = mapTypeRef(field.mapValue!, ctx)
    return `Record<${k}, ${v}>`
  }
  const base = mapBaseType(field.type, ctx)
  if (field.list) {
    const item = field.listItemRequired === false ? `(${base} | undefined)` : base
    return `${item}[]`
  }
  return base
}

/**
 * Resolve the TS type of an action's output slot.
 *   - no output          → `void`
 *   - scalar/record      → `T`              (optionality preserved)
 *   - list [T!]!         → `T[]`
 *   - list [T]           → `(T | undefined)[]` when itemRequired=false
 * For optional outer outputs (`T` without `!`) we append `| undefined` so
 * the Promise resolves to a union, matching how optional fields are emitted
 * elsewhere in the generator.
 */
export function mapActionOutputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return 'void'
  const base = mapBaseType(action.output, ctx)
  const outerRequired = action.outputRequired === true
  if (action.outputList) {
    const itemRequired = action.outputListItemRequired !== false
    const item = itemRequired ? base : `(${base} | undefined)`
    const arr = `${item}[]`
    return outerRequired ? arr : `${arr} | undefined`
  }
  return outerRequired ? base : `${base} | undefined`
}

// ────────────────────────────────────────────────────────────────
// Code building helpers
// ────────────────────────────────────────────────────────────────

export class LineBuffer {
  private lines: string[] = []
  private indentLevel = 0

  indent() { this.indentLevel++ }
  dedent() { this.indentLevel = Math.max(0, this.indentLevel - 1) }

  line(text = '') {
    if (text === '') {
      this.lines.push('')
    } else {
      this.lines.push('  '.repeat(this.indentLevel) + text)
    }
  }

  blank() { this.lines.push('') }

  block(open: string, body: () => void, close: string) {
    this.line(open)
    this.indent()
    body()
    this.dedent()
    this.line(close)
  }

  toString(): string {
    return this.lines.join('\n') + '\n'
  }
}

/**
 * Serialize a directive back into its `@name(arg: value, ...)` form for
 * documentation comments in the generated file. No semantics.
 */
export function renderDirectiveComment(
  d: { name: string; args?: Record<string, unknown> },
): string {
  const args = d.args ?? {}
  const keys = Object.keys(args)
  if (keys.length === 0) return `@${d.name}`
  const parts = keys.map(k => {
    const v = args[k]
    if (typeof v === 'string') {
      if (/^[A-Z_][A-Z0-9_]*$/.test(v)) return `${k}: ${v}`
      return `${k}: "${v}"`
    }
    if (v === null || v === undefined) return `${k}: null`
    if (typeof v === 'object') return `${k}: ${JSON.stringify(v)}`
    return `${k}: ${String(v)}`
  })
  return `@${d.name}(${parts.join(', ')})`
}

export function buildTypeContext(schema: IRSchema): TypeContext {
  return {
    enums: schema.enums,
    scalars: schema.scalars,
    records: schema.records,
  }
}
