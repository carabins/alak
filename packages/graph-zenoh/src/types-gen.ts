// @alaq/graph-zenoh — Rust type emitter.
//
// Emits:
//   • User-scalar aliases  (pub type DeviceID = String;)
//   • Enums                (pub enum RoomStatus + SCREAMING_SNAKE_CASE serde rename)
//   • Record structs       (pub struct Player with #[derive(..., Serialize, Deserialize)])
//   • @crdt / @atomic      impl helpers (merge / encode / decode)
//   • @scope               impl GameRoom { SCOPE, topic(...) }

import type { IRDirective, IREnum, IRRecord, IRScalar, IRSchema } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  collectCrdtDocGroups,
  crdtDocWrapperName,
  findDirective,
  getRecordScope,
  getRenameCase,
  hasDirective,
  isCrdtDocMember,
  mapFieldType,
  renderDirectiveComment,
  rustIdent,
  serdeRenameAllValue,
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
  // v0.3.7 — honour `@rename_case(kind: ...)` on the enum. Default
  // (directive absent) keeps the pre-0.3.7 behaviour —
  // `SCREAMING_SNAKE_CASE` — so existing snapshots do not move.
  const rcKind = getRenameCase(e)
  const rename = rcKind ? serdeRenameAllValue(rcKind) : 'SCREAMING_SNAKE_CASE'
  if (rename !== null) {
    buf.line(`#[serde(rename_all = "${rename}")]`)
  }
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
  // v0.3.7 — honour `@rename_case(kind: ...)` on the record. Pre-0.3.7
  // behaviour emits no `rename_all` on records; we preserve that when the
  // directive is absent so existing snapshots do not move. When present,
  // the struct-level attribute interacts with the per-field `#[serde(rename
  // = "...")]` emitted below — serde gives per-field rename priority over
  // `rename_all`, so the combination is well-defined: struct-wide casing
  // with local overrides.
  const rcKind = getRenameCase(rec)
  if (rcKind) {
    const rename = serdeRenameAllValue(rcKind)
    if (rename !== null) {
      buf.line(`#[serde(rename_all = "${rename}")]`)
    }
  }
  buf.line(`pub struct ${rec.name} {`)
  buf.indent()
  for (const f of rec.fields) {
    // Leading per-field directive comment (documentation, no semantics).
    for (const d of f.directives ?? []) {
      buf.line(`// ${renderDirectiveComment(d)}`)
    }
    const snake = snakeCase(f.name)
    // Per-field `rename` is only needed when there is no struct-level
    // `@rename_case` (that would handle the casing itself) AND the
    // snake-case Rust ident does not round-trip to the SDL name. When
    // `@rename_case` is present we let serde derive the wire name from
    // the Rust field via `rename_all`; writing both would fight.
    if (!rcKind && needsRenameAttr(f.name, snake)) {
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
  // v0.3.6: records that are members of a composite CRDT document don't
  // publish on their own topic and don't own their own merge loop — both
  // belong to the enclosing `<Doc>Doc` wrapper. Suppress per-record `topic`
  // and the per-record LWW `merge()` stub; keep the struct and retain the
  // informational `crdt_type()` helper so downstream introspection still
  // sees the directive.
  const docMember = isCrdtDocMember(rec)

  buf.line(`impl ${rec.name} {`)
  buf.indent()

  // ── topic helper ──
  if (docMember) {
    // Intentionally no topic helper — the topic lives on `<Doc>Doc`.
    buf.line(`/// @crdt_doc_member — entries of this record are stored inside`)
    buf.line(`/// a composite Automerge document; see the matching \`<Doc>Doc\``)
    buf.line(`/// wrapper for publish/subscribe and per-entry upsert/delete/list.`)
    buf.blank()
  } else if (scope) {
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
    if (docMember) {
      // Composite-doc members: per-record merge() would race with the
      // document-level merge in CrdtDoc. Retain lww_key() so the rt crate
      // can read the LWW timestamp without re-deserialising, but do not
      // expose a per-record merge() helper.
      if (crdtType.startsWith('LWW_') && key) {
        const keyField = rustIdent(snakeCase(key))
        buf.line(`/// LWW resolution key — used by the enclosing \`<Doc>Doc\` wrapper`)
        buf.line(`/// to pick the winner on merge. Read from the \`${key}\` field.`)
        buf.line(`pub fn lww_key(&self) -> i64 {`)
        buf.indent()
        buf.line(`self.${keyField}`)
        buf.dedent()
        buf.line(`}`)
        buf.blank()
      }
    } else if (crdtType.startsWith('LWW_') && key) {
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

// ────────────────────────────────────────────────────────────────
// v0.3.6 — Composite CRDT document wrappers (SPEC §7.15–§7.17)
// ────────────────────────────────────────────────────────────────
//
// For each `@crdt_doc_topic(doc: X, ...)` we emit one wrapper struct
// `XDoc { inner: CrdtDoc }` with methods bridging to the runtime crate
// `alaq-graph-zenoh-rt`. Value encoding inside the Automerge map is a
// JSON string (SPEC §7.15 R232) — `serde_json::to_string` on upsert,
// `serde_json::from_str` on list. The LWW timestamp is read from each
// record's `lww_key()` helper (generated earlier).
//
// The runtime API assumed here — published as a sibling crate —:
//
//   pub struct CrdtDoc { /* wraps automerge::AutoCommit */ }
//
//   impl CrdtDoc {
//     pub fn new(schema_version: u32) -> Self;
//     pub fn save(&mut self) -> Vec<u8>;
//     pub fn load_or_init(
//       bytes: Option<&[u8]>, expected_version: u32,
//     ) -> (Self, bool);  // .1 = true when the blob was dropped+rebuilt
//     pub fn merge_remote(&mut self, other: &[u8]) -> anyhow::Result<()>;
//     pub fn upsert_json(
//       &mut self, map_key: &str, id: &str, json: &str, lww_key: i64,
//     ) -> anyhow::Result<()>;
//     pub fn delete_entry(
//       &mut self, map_key: &str, id: &str, tombstone_ts: i64,
//     ) -> anyhow::Result<()>;
//     pub fn list_json(&self, map_key: &str) -> anyhow::Result<Vec<String>>;
//   }
//
// The crate is stub-only until E2.3 — this generator emits code that
// compiles against that signature once the crate exists.

export function emitCrdtDocWrappers(
  buf: LineBuffer,
  schema: IRSchema,
  diagnostics: { severity: 'error' | 'warning'; message: string }[],
) {
  const groups = collectCrdtDocGroups(schema)
  if (groups.length === 0) return

  for (const g of groups) {
    const wrapperName = crdtDocWrapperName(g.docName)
    const versionConst = g.schemaVersion !== null
      ? `${g.schemaVersion} as u32`
      : `0 as u32 /* no @schema_version declared */`

    // ── Doc struct + constants ──
    buf.line(`// SDL: @crdt_doc_topic(doc: "${g.docName}", pattern: "${g.topicPattern ?? ''}")`)
    if (g.schemaVersion !== null) {
      buf.line(`// SDL: @schema_version(doc: "${g.docName}", value: ${g.schemaVersion})`)
    }
    buf.line(`pub struct ${wrapperName} {`)
    buf.indent()
    buf.line(`inner: CrdtDoc,`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()

    buf.line(`impl ${wrapperName} {`)
    buf.indent()

    // Schema version constant.
    buf.line(`/// Expected schema_version pinned into the Automerge document.`)
    buf.line(`pub const SCHEMA_VERSION: u32 = ${versionConst};`)
    buf.blank()

    // Topic pattern constant.
    if (g.topicPattern !== null) {
      buf.line(`/// Zenoh topic pattern from @crdt_doc_topic. Placeholder`)
      buf.line(`/// substitution is the caller's responsibility in v0.1.`)
      buf.line(`pub const TOPIC_PATTERN: &'static str = "${g.topicPattern}";`)
      buf.blank()
    } else {
      // Orphan member case (E027 upstream should have caught this, but we
      // emit a comment so a broken-IR build still compiles).
      buf.line(`// @crdt_doc_topic missing — topic is the caller's responsibility.`)
      buf.blank()
    }

    // v0.3.7 — MAP_KEYS constant. Sorted ascending so the template-blob
    // cache in `alaq-graph-zenoh-rt` is deterministic across replicas:
    // `CrdtDoc::new(v, keys)` keys the cache on `(v, keys)`, and every
    // host that emits the same SDL produces the same key order here.
    const sortedMapKeys = g.members
      .map(m => m.mapKey)
      .slice()
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const mapKeysLiteral = sortedMapKeys.map(k => `"${k}"`).join(', ')
    buf.line(`/// Root-map names in this composite document. Pre-sorted`)
    buf.line(`/// ascending — the runtime caches its Automerge template`)
    buf.line(`/// blob on \`(SCHEMA_VERSION, MAP_KEYS)\`, so every replica`)
    buf.line(`/// MUST pass the same slice to keep merges wire-compatible.`)
    buf.line(`pub const MAP_KEYS: &'static [&'static str] = &[${mapKeysLiteral}];`)
    buf.blank()

    // Constructor.
    buf.line(`/// Create a fresh, empty document pinned to \`SCHEMA_VERSION\``)
    buf.line(`/// with every root map in \`MAP_KEYS\` pre-created.`)
    buf.line(`pub fn new() -> Self {`)
    buf.indent()
    buf.line(`Self { inner: CrdtDoc::new(Self::SCHEMA_VERSION, Self::MAP_KEYS) }`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()

    // Load-or-init with drop-and-rebuild on version mismatch.
    buf.line(`/// Load an existing Automerge blob. If the on-disk \`schema_version\``)
    buf.line(`/// does not match \`SCHEMA_VERSION\` the document is dropped and`)
    buf.line(`/// re-initialised (SPEC §7.17 R251). The second tuple element is`)
    buf.line(`/// \`true\` when a rebuild happened — the caller MUST log this.`)
    buf.line(`/// \`bytes\` of \`None\` creates a fresh document; \`Some\` defers to`)
    buf.line(`/// \`CrdtDoc::load_or_init\` which handles the mismatch case.`)
    buf.line(`pub fn load_or_init(bytes: Option<&[u8]>) -> anyhow::Result<(Self, bool)> {`)
    buf.indent()
    buf.line(`match bytes {`)
    buf.indent()
    buf.line(`None => Ok((Self::new(), false)),`)
    buf.line(`Some(b) => {`)
    buf.indent()
    buf.line(`let (inner, rebuilt) = CrdtDoc::load_or_init(b, Self::SCHEMA_VERSION, Self::MAP_KEYS)?;`)
    buf.line(`Ok((Self { inner }, rebuilt))`)
    buf.dedent()
    buf.line(`}`)
    buf.dedent()
    buf.line(`}`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()

    // save/merge_remote pass-throughs.
    buf.line(`/// Serialize the whole document to an Automerge binary blob.`)
    buf.line(`pub fn save(&mut self) -> Vec<u8> {`)
    buf.indent()
    buf.line(`self.inner.save()`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()

    buf.line(`/// Merge a remote snapshot into this document (Automerge merge).`)
    buf.line(`pub fn merge_remote(&mut self, other: &[u8]) -> anyhow::Result<()> {`)
    buf.indent()
    // v0.3.7: CrdtDoc::merge_remote returns Result<(), CrdtError>; convert
    // to anyhow via `?` + Ok so the wrapper signature stays uniform with
    // the other fallible helpers.
    buf.line(`self.inner.merge_remote(other)?;`)
    buf.line(`Ok(())`)
    buf.dedent()
    buf.line(`}`)
    buf.blank()

    // Per-member upsert / delete / list.
    for (const m of g.members) {
      const suffix = snakeCase(m.mapKey)
      // v0.3.7 — read `lww_field` from @crdt_doc_member first (explicit
      // override), then fall back to `@crdt(key: "...")` on the same
      // record, finally to the R110 implicit `updated_at`.
      const memberDir = findDirective(m.record.directives, 'crdt_doc_member')
      const lwwFromMember = typeof memberDir?.args?.lww_field === 'string'
        ? (memberDir.args.lww_field as string) : null
      const crdt = findDirective(m.record.directives, 'crdt')
      const lwwFromCrdt = typeof crdt?.args?.key === 'string'
        ? (crdt.args.key as string) : null
      const lwwFieldName = lwwFromMember ?? lwwFromCrdt ?? 'updated_at'
      const lwwFieldSnake = rustIdent(snakeCase(lwwFieldName))

      // SPEC §7.15 R230: the map key on the wire is "the required
      // ID!-typed first field of the record". Find it here rather than
      // hard-coding `entry.id` — busynca's DeviceEntry names it
      // `device_id`, and other composite records may follow different
      // conventions. Fallback to `id` preserves the pre-0.3.7 behaviour
      // when a record has no required `ID!` field at all (defensive; the
      // validator does not yet enforce R230's required-ID part, so the
      // generator stays tolerant and generates reachable-but-broken code
      // rather than crashing the pipeline).
      const idField = m.record.fields.find(
        f => f.type === 'ID' && f.required && !f.list,
      )
      const idFieldSnake = idField
        ? rustIdent(snakeCase(idField.name))
        : rustIdent('id')

      // v0.3.7 — read `soft_delete: { flag, ts_field }` if declared.
      const softDelete = (memberDir?.args?.soft_delete ?? null) as
        | { flag?: unknown; ts_field?: unknown }
        | null
      const softFlag = softDelete && typeof softDelete.flag === 'string'
        ? softDelete.flag : null
      const softTs = softDelete && typeof softDelete.ts_field === 'string'
        ? softDelete.ts_field : null
      const hasSoftDelete = softFlag !== null && softTs !== null

      buf.line(`/// Insert or overwrite a \`${m.recordName}\` entry under the`)
      buf.line(`/// \`"${m.mapKey}"\` root map. LWW key: \`${lwwFieldName}\`.`)
      buf.line(`pub fn upsert_${suffix}(&mut self, entry: &${m.recordName}) -> anyhow::Result<()> {`)
      buf.indent()
      buf.line(`let json = serde_json::to_string(entry)?;`)
      buf.line(`let id = &entry.${idFieldSnake};`)
      // Read the LWW integer directly from the typed field. Both
      // `Timestamp!` and `Int!` lower to `i64`, so the wire value is a
      // JSON integer (not a string) and matches what the runtime reads
      // back via `serde_json::Value::as_i64`.
      buf.line(`let lww: i64 = entry.${lwwFieldSnake};`)
      buf.line(
        `self.inner.upsert_json(` +
        `"${m.mapKey}", id, &json, lww, "${lwwFieldName}"` +
        `).map_err(Into::into)`,
      )
      buf.dedent()
      buf.line(`}`)
      buf.blank()

      if (hasSoftDelete) {
        buf.line(`/// Mark a \`${m.recordName}\` entry as deleted via soft-delete:`)
        buf.line(`/// writes \`${softFlag}: true\` + \`${softTs}: tombstone_ts\` into the`)
        buf.line(`/// entry's JSON cell and bumps LWW to \`tombstone_ts\`.`)
        buf.line(`pub fn delete_${suffix}(&mut self, id: &str, tombstone_ts: i64) -> anyhow::Result<()> {`)
        buf.indent()
        buf.line(`let spec = alaq_graph_zenoh_rt::SoftDeleteSpec {`)
        buf.indent()
        buf.line(`flag: "${softFlag}",`)
        buf.line(`ts_field: "${softTs}",`)
        buf.dedent()
        buf.line(`};`)
        buf.line(
          `self.inner.delete_entry("${m.mapKey}", id, tombstone_ts, Some(spec))` +
          `.map_err(Into::into)`,
        )
        buf.dedent()
        buf.line(`}`)
        buf.blank()
      } else {
        buf.line(`/// Hard-delete a \`${m.recordName}\` entry (remove the Automerge cell).`)
        buf.line(`pub fn delete_${suffix}(&mut self, id: &str, tombstone_ts: i64) -> anyhow::Result<()> {`)
        buf.indent()
        buf.line(
          `self.inner.delete_entry("${m.mapKey}", id, tombstone_ts, None)` +
          `.map_err(Into::into)`,
        )
        buf.dedent()
        buf.line(`}`)
        buf.blank()
      }

      buf.line(`/// List all non-deleted \`${m.recordName}\` entries.`)
      if (hasSoftDelete) {
        buf.line(`/// Entries with \`${softFlag} == true\` are skipped (soft-delete).`)
      }
      buf.line(`pub fn list_${suffix}(&self) -> anyhow::Result<Vec<${m.recordName}>> {`)
      buf.indent()
      buf.line(`let items = self.inner.list_json("${m.mapKey}")?;`)
      buf.line(`items.into_iter()`)
      buf.indent()
      buf.line(`.map(|s| serde_json::from_str::<${m.recordName}>(&s).map_err(Into::into))`)
      if (hasSoftDelete) {
        buf.line(`.filter(|r| match r { Ok(v) => !v.${rustIdent(snakeCase(softFlag!))}, Err(_) => true })`)
      }
      buf.line(`.collect()`)
      buf.dedent()
      buf.dedent()
      buf.line(`}`)
      buf.blank()
    }

    buf.dedent()
    buf.line(`}`)
    buf.blank()

    // Diagnostics summary for visibility.
    if (g.topicPattern === null) {
      diagnostics.push({
        severity: 'warning',
        message: `Composite CRDT document "${g.docName}" has @crdt_doc_member record(s) but no @crdt_doc_topic; wrapper generated without TOPIC_PATTERN.`,
      })
    }
    if (g.members.length === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `Composite CRDT document "${g.docName}" has @crdt_doc_topic but no @crdt_doc_member records; wrapper is effectively empty.`,
      })
    }
  }
}
