// @alaq/graph-link-server — generic utilities for the server emitter.
//
// Zero runtime dependencies. Pure string helpers + SDL→TS type mapping,
// trimmed to the subset the server generator needs:
//
//   • Interface shapes for records (server-side embeds I<Name> structures
//     so the generated file is self-contained, independent of the client
//     bundle — see FINDINGS §6.1 / §1.2).
//   • camelCase for action handler method names.
//   • A LineBuffer mirroring the @alaq/graph-link-state one, so snapshot
//     outputs from the two generators stay stylistically consistent.

import type {
  IRField,
  IREnum,
  IRScalar,
  IRSchema,
  IRTypeRef,
} from '../../graph/src/types'

// ────────────────────────────────────────────────────────────────
// Naming
// ────────────────────────────────────────────────────────────────

/** PascalCase stays PascalCase (SDL convention for records/actions/enums). */
export function pascalCase(name: string): string {
  if (!name) return name
  return name[0].toUpperCase() + name.slice(1)
}

/** PascalCase -> camelCase. Action handler method names follow this rule. */
export function camelCase(name: string): string {
  if (!name) return name
  return name[0].toLowerCase() + name.slice(1)
}

// ────────────────────────────────────────────────────────────────
// Built-in scalar mapping (SPEC §4.1) — mirrors @alaq/graph-link-state.
// Kept duplicated (not imported) to preserve the "zero peer deps on
// sibling generators" invariant from architecture.yaml.
// ────────────────────────────────────────────────────────────────

const BUILTIN_STRING = new Set(['ID', 'String', 'UUID', 'DeviceID', 'Bytes'])
const BUILTIN_NUMBER = new Set(['Int', 'Float', 'Timestamp', 'Duration'])
const BUILTIN_BOOLEAN = new Set(['Boolean'])

export interface TypeContext {
  enums: Record<string, IREnum>
  scalars: Record<string, IRScalar>
  records: Record<string, { name: string }>
}

/** Map SDL base name to a raw TS type (no optionality, no list wrapping). */
export function mapBaseType(name: string, ctx: TypeContext): string {
  if (BUILTIN_STRING.has(name)) return 'string'
  if (BUILTIN_NUMBER.has(name)) return 'number'
  if (BUILTIN_BOOLEAN.has(name)) return 'boolean'
  if (ctx.enums[name]) return name
  if (ctx.scalars[name]) return 'string'
  if (ctx.records[name]) return `I${name}`
  return 'unknown'
}

/** Recursive IRTypeRef → TS (shallow Map/List handling is enough for actions). */
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

/** Full IRField → TS annotation (list + map + required handled). */
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

/** Same as mapFieldType, but adds `| undefined` when the field is optional. */
export function mapFieldTypeOptional(field: IRField, ctx: TypeContext): string {
  const base = mapFieldType(field, ctx)
  return field.required ? base : `${base} | undefined`
}

// ────────────────────────────────────────────────────────────────
// Code building — copy of the LineBuffer from graph-link-state. Kept
// here to avoid a cross-generator import (architecture.yaml rule:
// "Plugins must not depend on each other").
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
