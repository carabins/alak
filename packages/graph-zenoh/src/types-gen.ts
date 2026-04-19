// @alaq/graph-zenoh — Rust type emitter.
//
// Emits:
//   • User-scalar aliases  (pub type DeviceID = String;)
//   • Enums                (pub enum RoomStatus + SCREAMING_SNAKE_CASE serde rename)
//   • Record structs       (pub struct Player with #[derive(..., Serialize, Deserialize)])
//   • @crdt / @atomic      impl helpers (merge / encode / decode)
//   • @scope               impl GameRoom { SCOPE, topic(...) }

import type { IRDirective, IREnum, IRRecord, IRScalar } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  findDirective,
  getRecordScope,
  mapFieldType,
  renderDirectiveComment,
  rustIdent,
  snakeCase,
} from './utils'

// ────────────────────────────────────────────────────────────────
// User-defined scalars → type aliases
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

/** Map an SDL enum value (SCREAMING_SNAKE_CASE) to a Rust variant (PascalCase). */
export function enumVariantName(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1).toLowerCase())
    .join('')
}

export function emitEnum(buf: LineBuffer, e: IREnum) {
  buf.line(`// SDL: enum ${e.name} { ${e.values.join(', ')} }`)
  buf.line(`#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]`)
  buf.line(`#[serde(rename_all = "SCREAMING_SNAKE_CASE")]`)
  buf.line(`pub enum ${e.name} {`)
  buf.indent()
  for (const v of e.values) {
    buf.line(`${enumVariantName(v)},`)
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
// Records → structs
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

  // Copy semantics: simple records (only copy primitives) could derive Copy,
  // but we conservatively emit Clone only — records frequently contain Vec/String.
  buf.line(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
  buf.line(`pub struct ${rec.name} {`)
  buf.indent()
  for (const f of rec.fields) {
    // Leading per-field directive comment (documentation, no semantics).
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

/**
 * Emit the `impl Record` block for scope / crdt / atomic helpers. Emits
 * nothing if none of those directives are present.
 */
export function emitRecordImpl(
  buf: LineBuffer,
  rec: IRRecord,
  ctx: TypeContext,
  namespace: string,
  diagnostics: { severity: 'error' | 'warning'; message: string }[],
) {
  const scope = getRecordScope(rec)
  const crdt = findDirective(rec.directives, 'crdt')
  const atomic = findDirective(rec.directives, 'atomic')
  const topic = findDirective(rec.directives, 'topic')

  // Every record always gets an impl block with at least a topic() helper.

  buf.line(`impl ${rec.name} {`)
  buf.indent()

  // ── @scope → SCOPE constant + topic(ns, id) helper ──
  if (scope) {
    buf.line(`/// Scope name (from @scope directive).`)
    buf.line(`pub const SCOPE: &'static str = "${scope}";`)
    buf.blank()
    buf.line(`/// Derive the zenoh key expression for a scope instance.`)
    buf.line(`/// Default pattern: "{namespace}/{scope}/{id}/${rec.name}"`)
    buf.line(`pub fn topic(namespace: &str, id: &str) -> String {`)
    buf.indent()
    buf.line(`format!("{}/${scope}/{}/${rec.name}", namespace, id)`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()
  } else if (topic) {
    // Custom @topic without @scope → unscoped pattern override.
    const pattern = typeof topic.args?.pattern === 'string' ? topic.args.pattern : `${namespace}/${rec.name}`
    buf.line(`/// Custom @topic(pattern: "...") — no placeholder substitution in v0.1.`)
    buf.line(`pub const TOPIC_PATTERN: &'static str = "${pattern}";`)
    buf.blank()
  } else {
    // Unscoped reliable default: "{namespace}/{Record}"
    buf.line(`/// Default unscoped topic: "{namespace}/${rec.name}".`)
    buf.line(`pub fn topic(namespace: &str) -> String {`)
    buf.indent()
    buf.line(`format!("{}/${rec.name}", namespace)`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()
  }

  // ── @crdt ──
  if (crdt) {
    const crdtType = typeof crdt.args?.type === 'string' ? (crdt.args.type as string) : 'LWW_REGISTER'
    const key = typeof crdt.args?.key === 'string' ? (crdt.args.key as string) : null
    buf.line(`/// CRDT type declared in SDL (@crdt).`)
    buf.line(`pub fn crdt_type() -> &'static str { "${crdtType}" }`)
    buf.blank()
    if (crdtType.startsWith('LWW_') && key) {
      const keyField = rustIdent(snakeCase(key))
      buf.line(`/// LWW resolution key — value read from the \`${key}\` field.`)
      buf.line(`pub fn lww_key(&self) -> i64 {`)
      buf.indent()
      buf.line(`self.${keyField}`)
      buf.dedent()
      buf.line(`}`)
      buf.blank()
      buf.line(`/// Merge two replicas using LWW on \`${key}\`. Latest wins; ties keep \`a\`.`)
      buf.line(`pub fn merge(a: &Self, b: &Self) -> Self {`)
      buf.indent()
      buf.line(`if a.${keyField} >= b.${keyField} { a.clone() } else { b.clone() }`)
      buf.dedent()
      buf.line(`}`)
      buf.blank()
    } else {
      // OR_SET / RGA / G_COUNTER / PN_COUNTER — TODO, emit a stub + warning.
      buf.line(`// TODO: @crdt(type: ${crdtType}) merge semantics not implemented in v0.1.`)
      buf.line(`// Hand-write the merge operation or wait for generator upgrade.`)
      buf.blank()
      diagnostics.push({
        severity: 'warning',
        message: `CRDT type "${crdtType}" on record "${rec.name}" emitted as stub — only LWW_* is implemented in @alaq/graph-zenoh v0.1.`,
      })
    }
  }

  // ── @atomic → CBOR encode/decode ──
  if (atomic) {
    buf.line(`/// @atomic — encoded as an opaque CBOR blob on the wire.`)
    buf.line(`pub fn encode_cbor(&self) -> Result<Vec<u8>, serde_cbor::Error> {`)
    buf.indent()
    buf.line(`serde_cbor::to_vec(self)`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()
    buf.line(`pub fn decode_cbor(bytes: &[u8]) -> Result<Self, serde_cbor::Error> {`)
    buf.indent()
    buf.line(`serde_cbor::from_slice(bytes)`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()
  }

  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitRecords(
  buf: LineBuffer,
  records: Record<string, IRRecord>,
  ctx: TypeContext,
  namespace: string,
  diagnostics: { severity: 'error' | 'warning'; message: string }[],
) {
  const names = Object.keys(records).sort()
  for (const name of names) {
    emitRecordStruct(buf, records[name], ctx)
  }
  for (const name of names) {
    emitRecordImpl(buf, records[name], ctx, namespace, diagnostics)
  }
}
