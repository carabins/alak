// @alaq/graph-zenoh — generic utilities for the Rust emitter.
//
// Zero runtime dependencies. Pure string helpers, Rust-aware type mapping,
// casing converters and a lightweight LineBuffer.

import type { IRField, IREnum, IRRecord, IRScalar, IRSchema, IRDirective } from '@alaq/graph'

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
// SPEC 0.3.8 — Float32 scalar lowers to `f32` (vs Float → f64). Enables
// wire-parity for records whose Rust source uses f32 directly
// (busynca::PositionMsg.accuracy_m, StatusMsg.battery/signal, etc.).
const BUILTIN_F32 = new Set(['Float32'])
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
  if (BUILTIN_F32.has(name)) return 'f32'
  if (BUILTIN_BOOL.has(name)) return 'bool'
  if (name === 'Bytes') return 'Vec<u8>'
  // v0.3.6 — `Any` is a runtime-typed opaque CBOR value. Maps to
  // `serde_cbor::Value` in Rust; serde routes it through whatever the
  // enclosing encoding is (JSON string→CBOR, CBOR→native). SPEC §11 v0.3.6.
  if (name === 'Any') return 'serde_cbor::Value'
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
  // v0.3.6 — Map<K, V> support in Rust codegen.
  // Lowering: `std::collections::BTreeMap<KRust, VRust>`. BTreeMap (not
  // HashMap) so that CBOR/JSON encoding is key-ordered — matches busynca's
  // `BTreeMap<String, serde_cbor::Value>` wire bytes. The key is always
  // required per SPEC §4.8 R023, so we never wrap it in Option<_>. The
  // value follows `!` as usual. Nesting works via recursive lowering of
  // the mapValue ref.
  if (field.map) {
    const keyBase = field.mapKey ? mapTypeRefRust(field.mapKey, ctx) : 'String'
    const valBase = field.mapValue ? mapTypeRefRust(field.mapValue, ctx) : 'String'
    const map = `std::collections::BTreeMap<${keyBase}, ${valBase}>`
    return field.required ? map : `Option<${map}>`
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
 * Lower an IR-level `IRTypeRef` (map key / map value position) to a Rust
 * type string. Mirrors `mapFieldType` but walks the nested ref form: it
 * handles `Map<K, Map<K2, V2>>` and list-of-map compositions recursively.
 */
function mapTypeRefRust(
  ref: {
    type: string
    required: boolean
    list: boolean
    listItemRequired?: boolean
    map?: boolean
    mapKey?: { type: string; required: boolean; list: boolean; map?: boolean; mapKey?: unknown; mapValue?: unknown; listItemRequired?: boolean }
    mapValue?: { type: string; required: boolean; list: boolean; map?: boolean; mapKey?: unknown; mapValue?: unknown; listItemRequired?: boolean }
  },
  ctx: TypeContext,
): string {
  // Nested Map<K, V> — recurse.
  if (ref.map) {
    const keyBase = ref.mapKey
      ? mapTypeRefRust(ref.mapKey as Parameters<typeof mapTypeRefRust>[0], ctx)
      : 'String'
    const valBase = ref.mapValue
      ? mapTypeRefRust(ref.mapValue as Parameters<typeof mapTypeRefRust>[0], ctx)
      : 'String'
    const nested = `std::collections::BTreeMap<${keyBase}, ${valBase}>`
    return ref.required ? nested : `Option<${nested}>`
  }
  // Nested list — recurse on the inner type surrogate (`IRTypeRef` loses
  // the inner ref after v0.3 flattening, so the best we can do at this
  // level is use the base-name fallback; single-level lists of scalars are
  // the only nesting the SDL exposes for map values in practice).
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

// ────────────────────────────────────────────────────────────────
// v0.3.6 — Composite CRDT document helpers
// ────────────────────────────────────────────────────────────────
//
// SPEC §7.15–§7.17. A composite document groups several records into a
// single Automerge blob published on one Zenoh topic. The directives that
// describe the shape are:
//
//   record-level:   @crdt_doc_member(doc: "D", map: "entries")
//   schema-level:   @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch")
//   schema-level:   @schema_version(doc: "D", value: 2)
//
// The validator (E027) guarantees topic/member/schema_version consistency;
// generator code can assume the IR is either internally consistent or that
// the caller is happy with best-effort output for a broken IR. These
// helpers are pure: they read the IR, they don't rewrite it.

/** One `@crdt_doc_member` record — the flattened view. */
export interface CrdtDocMember {
  /** SDL record name, e.g. "SyncPoint" */
  recordName: string
  /** Root-map key inside the Automerge document, e.g. "points" */
  mapKey: string
  /** The IR record itself — passed through for codegen access to fields. */
  record: IRRecord
}

/** One composite CRDT document — topic + optional schema_version + members. */
export interface CrdtDocGroup {
  /** `doc:` identifier — e.g. "GroupSync" */
  docName: string
  /** Zenoh topic pattern from `@crdt_doc_topic`, or null if orphan (E027). */
  topicPattern: string | null
  /** Pinned schema version from `@schema_version`, or null if not declared. */
  schemaVersion: number | null
  /** Member records in the order they appear in the IR. */
  members: CrdtDocMember[]
}

/**
 * Group all composite-CRDT directives in a schema by document name. Each
 * member record appears under exactly one group (per R231/E027). Schemas
 * with no composite docs return an empty array.
 */
export function collectCrdtDocGroups(schema: IRSchema): CrdtDocGroup[] {
  const groups = new Map<string, CrdtDocGroup>()

  const getOrInit = (docName: string): CrdtDocGroup => {
    let g = groups.get(docName)
    if (!g) {
      g = { docName, topicPattern: null, schemaVersion: null, members: [] }
      groups.set(docName, g)
    }
    return g
  }

  for (const d of schema.directives ?? []) {
    if (d.name === 'crdt_doc_topic') {
      const doc = typeof d.args?.doc === 'string' ? (d.args.doc as string) : null
      const pat = typeof d.args?.pattern === 'string' ? (d.args.pattern as string) : null
      if (doc && pat) getOrInit(doc).topicPattern = pat
    } else if (d.name === 'schema_version') {
      const doc = typeof d.args?.doc === 'string' ? (d.args.doc as string) : null
      const val = typeof d.args?.value === 'number' ? (d.args.value as number) : null
      if (doc && val !== null) getOrInit(doc).schemaVersion = val
    }
  }

  for (const rec of Object.values(schema.records)) {
    const mem = findDirective(rec.directives, 'crdt_doc_member')
    if (!mem) continue
    const doc = typeof mem.args?.doc === 'string' ? (mem.args.doc as string) : null
    const mapKey = typeof mem.args?.map === 'string' ? (mem.args.map as string) : null
    if (!doc || !mapKey) continue
    getOrInit(doc).members.push({ recordName: rec.name, mapKey, record: rec })
  }

  // Stable ordering by docName for deterministic output.
  return Array.from(groups.values()).sort((a, b) => a.docName.localeCompare(b.docName))
}

/** True if a record carries `@crdt_doc_member` — i.e. it lives inside a
 *  composite document rather than being a standalone per-record topic. */
export function isCrdtDocMember(rec: IRRecord): boolean {
  return hasDirective(rec.directives, 'crdt_doc_member')
}

/** Rust type name for a composite-doc wrapper: "GroupSyncDoc". */
export function crdtDocWrapperName(docName: string): string {
  // Sanitise — `doc:` is a string literal from SDL, typically PascalCase.
  // If the author wrote "Group.Sync", the resulting Rust ident would be
  // invalid — collapse non-ident chars.
  const clean = docName.replace(/[^A-Za-z0-9_]/g, '')
  const head = clean ? clean[0].toUpperCase() + clean.slice(1) : 'Composite'
  return `${head}Doc`
}

/** snake_case suffix for publish/subscribe helpers of a composite doc. */
export function crdtDocSuffix(docName: string): string {
  return snakeCase(docName.replace(/[^A-Za-z0-9_]/g, '_'))
}

// ────────────────────────────────────────────────────────────────
// v0.3.7 — @rename_case mapping
// ────────────────────────────────────────────────────────────────

/**
 * SPEC §7.18 — map the closed-set SDL `kind` value to the corresponding
 * serde `rename_all = "..."` string. Unknown values return `null` (the
 * validator already emits E003, so the generator should never hit this
 * path for a well-formed IR; when it does we emit no `rename_all` at all
 * — preserves the pre-0.3.7 behavior of a bare `#[derive(Serialize, ...)]`
 * attribute block).
 */
export function serdeRenameAllValue(sdlKind: string): string | null {
  switch (sdlKind) {
    case 'PASCAL':          return 'PascalCase'
    case 'CAMEL':           return 'camelCase'
    case 'SNAKE':           return 'snake_case'
    case 'SCREAMING_SNAKE': return 'SCREAMING_SNAKE_CASE'
    case 'KEBAB':           return 'kebab-case'
    case 'LOWER':           return 'lowercase'
    case 'UPPER':           return 'UPPERCASE'
    default:                return null
  }
}

/**
 * Extract the `@rename_case(kind: ...)` value from a record or enum. Returns
 * `null` when the directive is absent — the caller then picks the
 * generator-default behaviour (SCREAMING_SNAKE_CASE on enums to preserve
 * pre-0.3.7 snapshots; nothing on records, same as pre-0.3.7).
 */
export function getRenameCase(
  holder: { directives?: IRDirective[] },
): string | null {
  const dir = findDirective(holder.directives, 'rename_case')
  if (!dir) return null
  const kind = typeof dir.args?.kind === 'string' ? (dir.args.kind as string) : null
  return kind
}
