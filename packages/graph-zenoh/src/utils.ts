// @alaq/graph-zenoh — generic utilities for the Rust emitter.
//
// Zero runtime dependencies. Pure string helpers, Rust-aware type mapping,
// casing converters and a lightweight LineBuffer.

import type { IRField, IREnum, IRScalar, IRSchema, IRDirective } from '@alaq/graph'

// ────────────────────────────────────────────────────────────────
// Naming
// ────────────────────────────────────────────────────────────────

/** PascalCase stays PascalCase. Matches SDL convention for records/actions/enums. */
export function pascalCase(name: string): string {
  if (!name) return name
  return name[0].toUpperCase() + name.slice(1)
}

/** PascalCase -> camelCase. Kept for parity with link-state generator. */
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
 *   updated_at      → updated_at   (already snake)
 */
export function snakeCase(name: string): string {
  if (!name) return name
  // Fast path: already snake.
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

/** Rust-reserved identifiers we need to rename when they appear as SDL field names. */
const RUST_KEYWORDS = new Set([
  'as','break','const','continue','crate','else','enum','extern','false','fn',
  'for','if','impl','in','let','loop','match','mod','move','mut','pub','ref',
  'return','self','Self','static','struct','super','trait','true','type','unsafe',
  'use','where','while','async','await','dyn','abstract','become','box','do',
  'final','macro','override','priv','typeof','unsized','virtual','yield','try',
])

/** Escape a Rust identifier with `r#` if it clashes with a reserved word. */
export function rustIdent(name: string): string {
  if (RUST_KEYWORDS.has(name)) return `r#${name}`
  return name
}

// ────────────────────────────────────────────────────────────────
// Built-in scalar mapping (SPEC §4.1 → Rust)
// ────────────────────────────────────────────────────────────────

/** SDL scalar → Rust primitive. User scalars fall through to String alias. */
const BUILTIN_STRING = new Set(['ID', 'String', 'UUID'])
const BUILTIN_I64 = new Set(['Int', 'Timestamp', 'Duration'])
const BUILTIN_F64 = new Set(['Float'])
const BUILTIN_BOOL = new Set(['Boolean'])

export interface TypeContext {
  /** Enums defined in the schema. */
  enums: Record<string, IREnum>
  /** User-defined scalars (emitted as `pub type X = String`). */
  scalars: Record<string, IRScalar>
  /** Records — known composite types. */
  records: Record<string, { name: string }>
}

/**
 * Map an SDL base name to a raw Rust type (no Option/Vec wrapping).
 * For user records, the Rust type is the PascalCase name itself.
 */
export function mapBaseType(name: string, ctx: TypeContext): string {
  // User-declared scalars win over built-ins of the same name (they're nominal
  // type aliases over String — the SDL author chose to declare one).
  if (ctx.scalars[name]) return name
  if (BUILTIN_STRING.has(name)) return 'String'
  if (BUILTIN_I64.has(name)) return 'i64'
  if (BUILTIN_F64.has(name)) return 'f64'
  if (BUILTIN_BOOL.has(name)) return 'bool'
  if (name === 'Bytes') return 'Vec<u8>'
  if (ctx.enums[name]) return name
  if (ctx.records[name]) return name
  // Unknown — leave the bare identifier so the output still names the type.
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
 */
export function mapFieldType(field: IRField, ctx: TypeContext): string {
  const base = mapBaseType(field.type, ctx)

  if (field.list) {
    const itemRequired = field.listItemRequired !== false
    const item = itemRequired ? base : `Option<${base}>`
    const vec = `Vec<${item}>`
    return field.required ? vec : `Option<${vec}>`
  }

  return field.required ? base : `Option<${base}>`
}

/**
 * Like mapFieldType but wraps the entire result in Option when the field is
 * optional at the wire level. For actions' output types where `list: false`
 * it yields the same shape as mapFieldType.
 */
export function mapScalarReturnType(
  typeName: string,
  required: boolean,
  ctx: TypeContext,
): string {
  const base = mapBaseType(typeName, ctx)
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

/** Round-trips an IRDirective back to its `@name(arg: v, ...)` form for
 *  documentation comments. Not a parser; purely cosmetic. */
export function renderDirectiveComment(d: IRDirective): string {
  const args = d.args ?? {}
  const keys = Object.keys(args)
  if (keys.length === 0) return `@${d.name}`
  const parts = keys.map(k => {
    const v = args[k]
    if (typeof v === 'string') {
      // Enum-like bareword (SCREAMING_SNAKE_CASE) stays unquoted.
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

/** Return the record's scope (either the flattened `rec.scope` or the
 *  `@scope(name: "x")` directive arg). */
export function getRecordScope(rec: { scope?: string | null; directives?: IRDirective[] }): string | null {
  if (rec.scope) return rec.scope
  const dir = findDirective(rec.directives, 'scope')
  if (dir && typeof dir.args?.name === 'string') return dir.args.name as string
  return null
}
