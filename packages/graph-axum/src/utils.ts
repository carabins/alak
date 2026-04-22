// @alaq/graph-axum — generic utilities for the Rust/Axum emitter.
//
// Mirrors the `graph-zenoh/utils.ts` layout so the two Rust-target emitters
// stay intellectually close (naming / mapping / LineBuffer). Axum-specific
// bits (HTTP path derivation, namespace-flat) live at the bottom.

import type {
  IRAction,
  IRDirective,
  IREnum,
  IRField,
  IRScalar,
  IRSchema,
  IRTypeRef,
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
 * camelCase / PascalCase / mixed -> snake_case. Rust convention.
 * Fast path: already snake (`record_view`) is returned verbatim.
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

const RUST_KEYWORDS = new Set([
  'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
  'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
  'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
  'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
  'async', 'await', 'dyn', 'abstract', 'become', 'box', 'do', 'final',
  'macro', 'override', 'priv', 'typeof', 'unsized', 'virtual', 'yield', 'try',
])

/** Escape a Rust identifier with `r#` if it clashes with a reserved word. */
export function rustIdent(name: string): string {
  if (RUST_KEYWORDS.has(name)) return `r#${name}`
  return name
}

/**
 * Flatten a namespace with dots into a snake-cased Rust-safe path segment.
 *   rest.valkyrie.arsenal → rest_valkyrie_arsenal
 *   simple                → simple
 */
export function flattenNamespace(ns: string): string {
  return ns.replace(/[^a-zA-Z0-9_]/g, '_')
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

/**
 * Map an SDL base name to a raw Rust type (no Option/Vec wrapping).
 * For user records / enums, the Rust type is the PascalCase name itself.
 */
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

/** Map an IRTypeRef (used inside Map<K, V>) to a Rust type. */
export function mapTypeRef(ref: IRTypeRef, ctx: TypeContext): string {
  if (ref.map) {
    const k = mapTypeRef(ref.mapKey!, ctx)
    const v = mapTypeRef(ref.mapValue!, ctx)
    const inner = `std::collections::HashMap<${k}, ${v}>`
    return ref.required ? inner : `Option<${inner}>`
  }
  const base = mapBaseType(ref.type, ctx)
  if (ref.list) {
    const itemRequired = ref.listItemRequired !== false
    const item = itemRequired ? base : `Option<${base}>`
    const vec = `Vec<${item}>`
    return ref.required ? vec : `Option<${vec}>`
  }
  return ref.required ? base : `Option<${base}>`
}

/**
 * Map a full IRField to a Rust type (list / map / required all applied).
 *
 *   T!        → T
 *   T         → Option<T>
 *   [T!]      → Option<Vec<T>>
 *   [T!]!     → Vec<T>
 *   Map<K,V>! → HashMap<K, V>
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

/**
 * Map a scalar/record reference from `action.output` plus its `outputRequired`
 * flag (not a list — list is handled separately in output-type emission).
 */
export function mapScalarReturnType(
  typeName: string,
  required: boolean,
  ctx: TypeContext,
): string {
  const base = mapBaseType(typeName, ctx)
  return required ? base : `Option<${base}>`
}

/**
 * Spell the Rust type used for an action's output *inline* (no newtype).
 *
 * Shape table:
 *   no output                         → `()`
 *   scalar, required                  → `T`
 *   scalar, not required              → `Option<T>`
 *   list, outer required, item req    → `Vec<T>`
 *   list, outer required, item not    → `Vec<Option<T>>`
 *   list, outer not req,  item req    → `Option<Vec<T>>`
 *   list, outer not req,  item not    → `Option<Vec<Option<T>>>`
 *
 * Consumed by handlers-gen (trait return type) and routes-gen
 * (`Json<...>` body type). Replaces the old per-action `<Action>Output`
 * newtype / alias (removed in C1 cleanup, 2026-04-21).
 */
export function mapActionOutputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return '()'
  const required = action.outputRequired === true
  const isList = action.outputList === true
  const base = mapBaseType(action.output, ctx)
  if (isList) {
    const itemRequired = action.outputListItemRequired !== false
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

// ────────────────────────────────────────────────────────────────
// Enum heuristic — pick serde rename_all
// ────────────────────────────────────────────────────────────────

/**
 * Pick `#[serde(rename_all = ...)]` for an enum based on its declared values.
 *
 * If every value already matches `^[a-z][a-z0-9_]*$` (SDL lower-snake),
 * we tell serde to emit them as `snake_case`. Otherwise we assume the SDL
 * author used `SCREAMING_SNAKE_CASE` variants and let serde preserve them.
 *
 * Matches the C.1/C.2 decision that on-wire enums follow the SDL casing
 * rather than serde's Rust-PascalCase default.
 */
export function pickEnumRenameAll(values: string[]): 'snake_case' | 'SCREAMING_SNAKE_CASE' {
  if (values.length === 0) return 'SCREAMING_SNAKE_CASE'
  return values.every(v => /^[a-z][a-z0-9_]*$/.test(v))
    ? 'snake_case'
    : 'SCREAMING_SNAKE_CASE'
}

/**
 * Turn an SDL enum value into the Rust variant name (PascalCase).
 *   master          → Master
 *   windows_msi     → WindowsMsi
 *   SCREAMING_SNAKE → ScreamingSnake
 */
export function enumVariantName(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1).toLowerCase())
    .join('')
}
