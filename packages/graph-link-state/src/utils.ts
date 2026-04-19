// @alaq/graph-link-state — generic utilities for the TS emitter.
//
// Zero runtime dependencies. Pure string helpers + type mapping.

import type { IRField, IREnum, IRScalar, IRSchema, IRTypeRef } from '@alaq/graph'

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

/** kebab-or-snake-case -> PascalCase. Not strictly needed for SDL, but handy. */
export function toPascal(name: string): string {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('')
}

// ────────────────────────────────────────────────────────────────
// Built-in scalar mapping (SPEC §4.1)
// ────────────────────────────────────────────────────────────────

const BUILTIN_STRING = new Set(['ID', 'String', 'UUID', 'DeviceID', 'Bytes'])
const BUILTIN_NUMBER = new Set(['Int', 'Float', 'Timestamp', 'Duration'])
const BUILTIN_BOOLEAN = new Set(['Boolean'])

export interface TypeContext {
  /** Enums defined in this schema (used to pick `EnumName` vs `string`). */
  enums: Record<string, IREnum>
  /** User-declared scalars (nominal strings in TS). */
  scalars: Record<string, IRScalar>
  /** Records — for nested record references. */
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
  if (ctx.enums[name]) return name // TS enum shares the SDL identifier
  if (ctx.scalars[name]) return 'string' // User scalars emit as string on wire
  if (ctx.records[name]) return `I${name}`
  // Unknown — bail to `unknown` so output still compiles.
  return 'unknown'
}

/**
 * Map an IR type reference (from map key/value slots) to a TS type.
 * Handles nested maps, lists, and scalars recursively. Zero dependencies
 * on field-level metadata (name, directives).
 *
 * TS mapping choice for Map<K, V>: `Record<K, V>` (index signature) rather
 * than the JS `Map` class. Rationale:
 *   - Wire: both our default (CBOR) and the LWW-Map CRDT are
 *     string-keyed maps. `Record<K, V>` matches that shape 1:1 and is what
 *     Vue/React consumers already reach for. `Map<K, V>` adds an OO layer
 *     and iteration-order semantics that we don't need to preserve over
 *     the wire.
 *   - Ergonomics: `obj[key]` vs `map.get(key)`. The former composes better
 *     with Vue's reactivity and JSON-based transports.
 *   - Kotelok code already uses `Record<string, ...>` everywhere — the
 *     generator matches that convention.
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
 * `listItemRequired: true` means elements cannot be nullable; `false`
 * means `(T | undefined)[]`. For `map` fields, emits `Record<K, V>` —
 * see `mapTypeRef` for the mapping rationale.
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
 * Same as mapFieldType but returns the "value or undefined" form when the
 * field is optional at the wire level (no `!`). Used for the value-side of
 * generated interfaces and shortcut accessors.
 */
export function mapFieldTypeOptional(field: IRField, ctx: TypeContext): string {
  const base = mapFieldType(field, ctx)
  return field.required ? base : `${base} | undefined`
}

// ────────────────────────────────────────────────────────────────
// Per-entry reactive accessors (lists + maps, v0.4)
// ────────────────────────────────────────────────────────────────
//
// For list/map fields the generator emits `SyncListNode<T, N>` and
// `SyncMapNode<K, V, N>` facades (see @alaq/link-state/src/list-node.ts,
// map-node.ts). The helpers below turn IR type refs into:
//   • `itemNodeType` / `valueNodeType` — TS interface expression for the
//     per-index / per-key reactive node (the `N` parameter).
//   • `itemFactoryExpr` / `valueFactoryExpr` — a runtime factory expression
//     that produces that node from a child path string. Used inside
//     `createListNode(...)` / `createMapNode(...)` calls.
//
// Recursive: list-of-list, map-of-map, map-of-list, list-of-map are all
// expressible by composing these helpers on the inner IRTypeRef.

/** Return true if the field is a list. Cheap sentinel for the emitter. */
export function isListField(field: { list: boolean }): boolean {
  return !!field.list
}

/** Return true if the field is a map. Cheap sentinel for the emitter. */
export function isMapField(field: { map?: boolean }): boolean {
  return !!field.map
}

/** True when a type ref resolves to a user record (→ generated `<Name>Node`). */
function isRecordRef(ref: IRTypeRef, ctx: TypeContext): boolean {
  return !ref.list && !ref.map && !!ctx.records[ref.type]
}

/**
 * TS expression for the reactive node of a *single element of a list*,
 * given the list's `listItemType` ref. Always strict — item-ref nullability
 * is encoded on the value side, not on the node side.
 *
 *   scalar int       → `ISyncNode<number>`
 *   record Player    → `PlayerNode`
 *   list [Foo]       → `SyncListNode<Foo, <Foo's item-node>>`
 *   map Map<K,V>     → `SyncMapNode<K, V, <V's value-node>>`
 */
export function itemNodeType(inner: IRTypeRef, ctx: TypeContext): string {
  if (inner.map) {
    const k = mapTypeRef(inner.mapKey!, ctx)
    const v = mapTypeRef(inner.mapValue!, ctx)
    const n = valueNodeType(inner.mapValue!, ctx)
    return `SyncMapNode<${k}, ${v}, ${n}>`
  }
  if (inner.list) {
    // `listItemRequired` on a nested ref isn't tracked — fall back to the
    // base type for the sub-item node. Callers that need optional markers
    // see them on the snapshot side.
    const elemRef: IRTypeRef = { ...inner, list: false }
    const elemTs = mapTypeRef(elemRef, ctx)
    const sub = itemNodeType(elemRef, ctx)
    return `SyncListNode<${elemTs}, ${sub}>`
  }
  if (isRecordRef(inner, ctx)) {
    return `${inner.type}Node`
  }
  const base = mapBaseType(inner.type, ctx)
  return `ISyncNode<${base}>`
}

/** Same logic as `itemNodeType`, but for a map value ref. Alias for clarity. */
export function valueNodeType(ref: IRTypeRef, ctx: TypeContext): string {
  return itemNodeType(ref, ctx)
}

/**
 * Runtime factory expression for the per-entry node of a list/map.
 *
 * Produces an arrow like `(p0) => createXNode(store, p0)`. Nested
 * list/map layers get uniquely numbered parameter names (`p1`, `p2`, ...)
 * so that a single composed expression remains scope-safe when the emitter
 * drops it into `createListNode(store, path + '.xs', <expr>)`.
 */
export function itemFactoryExpr(inner: IRTypeRef, ctx: TypeContext): string {
  return itemFactoryExprWithDepth(inner, ctx, 0)
}

function itemFactoryExprWithDepth(
  inner: IRTypeRef,
  ctx: TypeContext,
  depth: number,
): string {
  const p = `p${depth}`
  if (inner.map) {
    const innerExpr = itemFactoryExprWithDepth(inner.mapValue!, ctx, depth + 1)
    return `(${p}) => createMapNode(store, ${p}, ${innerExpr})`
  }
  if (inner.list) {
    const elemRef: IRTypeRef = { ...inner, list: false }
    const innerExpr = itemFactoryExprWithDepth(elemRef, ctx, depth + 1)
    return `(${p}) => createListNode(store, ${p}, ${innerExpr})`
  }
  if (isRecordRef(inner, ctx)) {
    return `(${p}) => create${inner.type}Node(store, ${p})`
  }
  return `(${p}) => store.get(${p}) as ISyncNode<${mapBaseType(inner.type, ctx)}>`
}

/**
 * Helper: turn a field's list descriptor into a nested IRTypeRef so we can
 * reuse the recursive helpers above.
 */
export function listItemRef(field: IRField): IRTypeRef {
  return {
    type: field.type,
    required: field.listItemRequired !== false,
    list: false,
  }
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
    // Ensure trailing newline.
    return this.lines.join('\n') + '\n'
  }
}

/**
 * Serialize a JS-literal-ish value from `@default(value: X)` into a TS
 * literal. Enums are emitted as `EnumName.MEMBER` when the type is an enum.
 */
export function renderDefault(raw: unknown, fieldType: string, ctx: TypeContext): string {
  if (raw === null || raw === undefined) return 'undefined'
  if (typeof raw === 'number') return String(raw)
  if (typeof raw === 'boolean') return String(raw)
  if (typeof raw === 'string') {
    // Enum member: emitted as bare identifier by parser but stored as string
    // in IR args. If the field type is an enum, render as `Enum.MEMBER`.
    if (ctx.enums[fieldType]) return `${fieldType}.${raw}`
    return JSON.stringify(raw)
  }
  if (Array.isArray(raw)) {
    return `[${raw.map(v => renderDefault(v, fieldType, ctx)).join(', ')}]`
  }
  return 'undefined'
}

/**
 * Format a directive back into its `@name(arg: value, ...)` form for
 * use inside generated comments (documentation only — no semantics).
 */
export function renderDirectiveComment(d: { name: string; args?: Record<string, unknown> }): string {
  const args = d.args ?? {}
  const keys = Object.keys(args)
  if (keys.length === 0) return `@${d.name}`
  const parts = keys.map(k => {
    const v = args[k]
    if (typeof v === 'string') {
      // Some arg values were parsed as enum identifiers (e.g. RoomStatus.LOBBY)
      // and survive as bare strings in IR. We don't know which, so we quote
      // anything that isn't a bareword. Keep it simple and stable.
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
// Directive lookup
// ────────────────────────────────────────────────────────────────

export function findDirective(
  directives: { name: string; args?: Record<string, unknown> }[] | undefined,
  name: string,
): { name: string; args?: Record<string, unknown> } | undefined {
  if (!directives) return undefined
  return directives.find(d => d.name === name)
}

export function hasDirective(
  directives: { name: string; args?: Record<string, unknown> }[] | undefined,
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
