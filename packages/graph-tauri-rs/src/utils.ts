// @alaq/graph-tauri-rs — Rust-emission utilities.
//
// Mirrors `@alaq/graph-zenoh/src/utils.ts`: casing helpers, built-in scalar
// mapping (§4.1 → Rust), `LineBuffer` indented writer, `TypeContext`, and
// directive inspectors. The Rust-keyword escape set is identical.
//
// Only difference vs. zenoh: this package never needs `r#async`/zenoh-prelude
// idioms — all we emit is serde-friendly types plus `#[tauri::command]` code.

import type {
  IRDirective,
  IREnum,
  IRField,
  IRScalar,
  IRSchema,
} from '@alaq/graph'

// ────────────────────────────────────────────────────────────────
// Naming
// ────────────────────────────────────────────────────────────────

export function pascalCase(name: string): string {
  if (!name) return name
  return name[0].toUpperCase() + name.slice(1)
}

export function camelCase(name: string): string {
  if (!name) return name
  return name[0].toLowerCase() + name.slice(1)
}

/**
 * camelCase / PascalCase / mixed -> snake_case. Rust field convention.
 *   wordsPerPlayer  → words_per_player
 *   myWords         → my_words
 *   ID              → id
 *   HTTPRequest     → http_request
 *   updated_at      → updated_at
 */
export function snakeCase(name: string): string {
  if (!name) return name
  if (/^[a-z0-9_]+$/.test(name)) return name
  const out: string[] = []
  const chars = name.split('')
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const prev = chars[i - 1]
    const next = chars[i + 1]
    const isUpper = c >= 'A' && c <= 'Z'
    if (isUpper) {
      const prevIsLower = prev && prev >= 'a' && prev <= 'z'
      const prevIsDigit = prev && prev >= '0' && prev <= '9'
      const nextIsLower = next && next >= 'a' && next <= 'z'
      const prevIsUpper = prev && prev >= 'A' && prev <= 'Z'
      if (i > 0 && (prevIsLower || prevIsDigit || (prevIsUpper && nextIsLower))) {
        out.push('_')
      }
      out.push(c.toLowerCase())
    } else if (c === '-') {
      out.push('_')
    } else {
      out.push(c)
    }
  }
  return out.join('')
}

/** Rust-reserved identifiers we need to rename when they appear as SDL
 *  field names / command arg names. */
const RUST_KEYWORDS = new Set([
  'as','break','const','continue','crate','else','enum','extern','false','fn',
  'for','if','impl','in','let','loop','match','mod','move','mut','pub','ref',
  'return','self','Self','static','struct','super','trait','true','type','unsafe',
  'use','where','while','async','await','dyn','abstract','become','box','do',
  'final','macro','override','priv','typeof','unsized','virtual','yield','try',
])

export function rustIdent(name: string): string {
  if (RUST_KEYWORDS.has(name)) return `r#${name}`
  return name
}

// ────────────────────────────────────────────────────────────────
// Built-in scalar mapping (SPEC §4.1 → Rust)
// ────────────────────────────────────────────────────────────────

const BUILTIN_STRING = new Set(['ID', 'String', 'UUID'])
const BUILTIN_I64 = new Set(['Int', 'Timestamp', 'Duration'])
const BUILTIN_F64 = new Set(['Float'])
const BUILTIN_BOOL = new Set(['Boolean'])

export interface TypeContext {
  enums: Record<string, IREnum>
  scalars: Record<string, IRScalar>
  records: Record<string, { name: string }>
}

export function mapBaseType(name: string, ctx: TypeContext): string {
  if (ctx.scalars[name]) return name
  if (BUILTIN_STRING.has(name)) return 'String'
  if (BUILTIN_I64.has(name)) return 'i64'
  if (BUILTIN_F64.has(name)) return 'f64'
  if (BUILTIN_BOOL.has(name)) return 'bool'
  if (name === 'Bytes') return 'Vec<u8>'
  if (ctx.enums[name]) return name
  if (ctx.records[name]) return name
  return name
}

/**
 * Map a full IRField to a Rust type (list + required wrapping applied).
 *
 *   T!   → T
 *   T    → Option<T>
 *   [T!] → Option<Vec<T>>
 *   [T!]!→ Vec<T>
 *   [T]! → Vec<Option<T>>
 *   [T]  → Option<Vec<Option<T>>>
 *
 * Map<K, V>! → HashMap<K, V>    (outer-required)
 * Map<K, V>  → Option<HashMap<K, V>>
 */
export function mapFieldType(field: IRField, ctx: TypeContext): string {
  if (field.map) {
    const k = mapTypeRef(field.mapKey!, ctx)
    const v = mapTypeRef(field.mapValue!, ctx)
    const inner = `std::collections::HashMap<${k}, ${v}>`
    return field.required ? inner : `Option<${inner}>`
  }

  const base = mapBaseType(field.type, ctx)

  if (field.list) {
    const itemRequired = field.listItemRequired !== false
    const item = itemRequired ? base : `Option<${base}>`
    const vec = `Vec<${item}>`
    return field.required ? vec : `Option<${vec}>`
  }

  return field.required ? base : `Option<${base}>`
}

/** Map an IRTypeRef (used inside map key/value and for recursive nesting). */
export function mapTypeRef(
  ref: {
    type: string
    required: boolean
    list: boolean
    listItemRequired?: boolean
    map?: boolean
    mapKey?: any
    mapValue?: any
  },
  ctx: TypeContext,
): string {
  if (ref.map) {
    const k = mapTypeRef(ref.mapKey, ctx)
    const v = mapTypeRef(ref.mapValue, ctx)
    const inner = `std::collections::HashMap<${k}, ${v}>`
    return ref.required ? inner : `Option<${inner}>`
  }
  if (ref.list) {
    const base = mapBaseType(ref.type, ctx)
    const itemRequired = ref.listItemRequired !== false
    const item = itemRequired ? base : `Option<${base}>`
    const vec = `Vec<${item}>`
    return ref.required ? vec : `Option<${vec}>`
  }
  const base = mapBaseType(ref.type, ctx)
  return ref.required ? base : `Option<${base}>`
}

/**
 * Map an action's output type (honouring `outputList` / `outputListItemRequired`
 * from IR v0.3.1). Returns the raw Rust type — `()` for fire-forget is the
 * caller's problem.
 */
export function mapActionOutput(
  typeName: string,
  required: boolean,
  isList: boolean,
  itemRequired: boolean,
  ctx: TypeContext,
): string {
  const base = mapBaseType(typeName, ctx)
  if (isList) {
    const item = itemRequired ? base : `Option<${base}>`
    const vec = `Vec<${item}>`
    return required ? vec : `Option<${vec}>`
  }
  return required ? base : `Option<${base}>`
}

// ────────────────────────────────────────────────────────────────
// Code-building helper
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
      this.lines.push('    '.repeat(this.indentLevel) + text)
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

// ────────────────────────────────────────────────────────────────
// Directive helpers
// ────────────────────────────────────────────────────────────────

export function findDirective(
  directives: IRDirective[] | undefined,
  name: string,
): IRDirective | undefined {
  if (!directives) return undefined
  return directives.find(d => d.name === name)
}

export function hasDirective(
  directives: IRDirective[] | undefined,
  name: string,
): boolean {
  return !!findDirective(directives, name)
}

export function renderDirectiveComment(d: IRDirective): string {
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

// ────────────────────────────────────────────────────────────────
// Schema-level context factory
// ────────────────────────────────────────────────────────────────

export function buildTypeContext(schema: IRSchema): TypeContext {
  return {
    enums: schema.enums,
    scalars: schema.scalars,
    records: schema.records,
  }
}

/** Filesystem-safe module name from a dotted namespace. */
export function nsFlat(namespace: string): string {
  return namespace.replace(/[^a-zA-Z0-9_]/g, '_')
}
