// @alaq/graph-zenoh — codegen-time event emission for composite CRDT
// documents (SPEC §7.15–§7.17, runtime contract added in v0.3.11).
//
// For every `@crdt_doc_topic(doc: D)` group with one or more
// `@crdt_doc_member` records, this module emits:
//
//   1. `pub enum DSyncEvent` — Upserted(<Member>) / Deleted(String) variants
//      per root map. Mirrors the hand-written `busynca::SyncEvent` from
//      `rest.valkyrie/busynca/src/models.rs:78` so consumers can swap the
//      generated enum in without touching the broadcast subscription side.
//
//   2. Per-map free fns `emit_<doc_snake>_<map>_diffs(tx, before, after)`
//      that compute the set diff by the record's required `ID!` field and
//      send `Upserted` / `Deleted` events on a `broadcast::Sender` —
//      exactly the shape of `emit_point_diffs` / `emit_device_diffs` /
//      `emit_threat_diffs` in `rest.valkyrie/busynca/src/lib.rs:1120`.
//
//   3. A `DDoc::merge_remote_with_events(other, tx)` convenience method
//      that snapshots before, runs `merge_remote`, snapshots after, and
//      fans out per-map diffs in one call. Matches the inline
//      before/merge/after/diff cycle in
//      `rest.valkyrie/busynca/src/lib.rs:1062-1114`.
//
// Single source of truth: SDL declares records once. Codegen produces the
// types AND the event-emission glue. No hand-written `emit_*_diffs` per
// record any more — that file is generated.
//
// Comparison key for "did entry change?": the resolved LWW field
// (`@crdt_doc_member.lww_field`, falls back to `@crdt(key:)`, then
// `updated_at`). Same field the LWW merge uses, same field the busynca
// hand-written diffs use.
//
// Out of scope for v0.3.11 (deferred):
//   - `@pre_emit` / `@post_emit` directives for side-channel hooks
//     (operator-review, metrics). Stub design notes at the bottom of this
//     file; SPEC additions land in 0.3.12 once a real consumer asks.

import type { IRRecord, IRSchema } from '@alaq/graph'
import {
  CrdtDocGroup,
  CrdtDocMember,
  LineBuffer,
  collectCrdtDocGroups,
  crdtDocSuffix,
  crdtDocWrapperName,
  findDirective,
  rustIdent,
  snakeCase,
} from './utils'

// ────────────────────────────────────────────────────────────────
// Public entry — does the schema have any composite docs to emit
// events for?
// ────────────────────────────────────────────────────────────────

export function hasAnyCrdtDocEvents(schema: IRSchema): boolean {
  const groups = collectCrdtDocGroups(schema)
  return groups.some(g => g.members.length > 0)
}

// ────────────────────────────────────────────────────────────────
// Event-emission emitter
// ────────────────────────────────────────────────────────────────

export function emitAllCrdtDocEvents(
  buf: LineBuffer,
  schema: IRSchema,
  diagnostics: { severity: 'error' | 'warning'; message: string }[],
) {
  const groups = collectCrdtDocGroups(schema)
  if (groups.length === 0) return

  for (const g of groups) {
    if (g.members.length === 0) {
      // No member records → no events; skip silently. The composite-doc
      // wrapper emitter already raises a "wrapper effectively empty"
      // warning — don't double-fire it here.
      continue
    }
    emitGroupEnum(buf, g, diagnostics)
    emitGroupDiffFns(buf, g)
    emitMergeRemoteWithEvents(buf, g)
  }
}

// ────────────────────────────────────────────────────────────────
// 1. Per-doc event enum
// ────────────────────────────────────────────────────────────────

function emitGroupEnum(
  buf: LineBuffer,
  g: CrdtDocGroup,
  diagnostics: { severity: 'error' | 'warning'; message: string }[],
) {
  const enumName = eventEnumName(g.docName)

  buf.line(`/// CRDT-document events for the \`${g.docName}\` composite document.`)
  buf.line(`/// Emitted by \`emit_${crdtDocSuffix(g.docName)}_*_diffs\` and by`)
  buf.line(`/// \`${crdtDocWrapperName(g.docName)}::merge_remote_with_events\`.`)
  buf.line(`/// Variants are derived from each \`@crdt_doc_member\` map key —`)
  buf.line(`/// one \`Upserted\` and one \`Deleted\` per member record.`)
  buf.line(`#[derive(Clone, Debug, Serialize, Deserialize)]`)
  buf.line(`#[non_exhaustive]`)
  buf.line(`pub enum ${enumName} {`)
  buf.indent()
  for (const m of sortedMembers(g)) {
    const variantStem = mapKeyToVariantStem(m.mapKey)
    buf.line(`/// Upsert (insert or update) of a \`${m.recordName}\` entry`)
    buf.line(`/// in root map \`"${m.mapKey}"\`.`)
    buf.line(`${variantStem}Upserted(${m.recordName}),`)
    buf.line(`/// Removal of a \`${m.recordName}\` entry from root map`)
    buf.line(`/// \`"${m.mapKey}"\` — the payload is the entry id.`)
    buf.line(`${variantStem}Deleted(String),`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()

  // R230 sanity: every member should expose a required ID! field for the
  // diff helpers below. Missing → emit a warning so the SDL author knows
  // the diff fn will fall back to comparing whole records (slow path).
  for (const m of g.members) {
    if (findRequiredIdField(m.record) === null) {
      diagnostics.push({
        severity: 'warning',
        message:
          `record "${m.recordName}" (composite-doc member of "${g.docName}") ` +
          `has no required ID! field — generated emit_*_diffs falls back to ` +
          `comparing entries by serialised JSON, which is slower than the ` +
          `id-keyed fast path. Add \`id: ID!\` (or another required ID! ` +
          `field) to the record.`,
      })
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 2. Per-map emit_diffs free fns
// ────────────────────────────────────────────────────────────────

function emitGroupDiffFns(buf: LineBuffer, g: CrdtDocGroup) {
  const enumName = eventEnumName(g.docName)
  const docSuffix = crdtDocSuffix(g.docName)

  for (const m of sortedMembers(g)) {
    const mapSnake = snakeCase(m.mapKey)
    const fnName = `emit_${docSuffix}_${mapSnake}_diffs`
    const variantStem = mapKeyToVariantStem(m.mapKey)
    const idField = findRequiredIdField(m.record)
    const idFieldRust = idField
      ? rustIdent(snakeCase(idField.name))
      : null
    const lwwField = resolveLwwField(m.record)
    const lwwFieldRust = rustIdent(snakeCase(lwwField))

    buf.line(`/// Diff two snapshots of root map \`"${m.mapKey}"\` and emit`)
    buf.line(`/// \`${enumName}::${variantStem}Upserted\` / \`${variantStem}Deleted\` events`)
    buf.line(`/// onto \`tx\`. An entry is "changed" when its \`${lwwField}\` value`)
    buf.line(`/// differs between \`before\` and \`after\` — the same key the LWW`)
    buf.line(`/// merge uses, so we never emit spurious upserts for unchanged`)
    buf.line(`/// records. \`broadcast::Sender::send\` errors are dropped: a`)
    buf.line(`/// dead receiver is the caller's contract, not ours.`)
    buf.line(`pub fn ${fnName}(`)
    buf.indent()
    buf.line(`tx: &tokio::sync::broadcast::Sender<${enumName}>,`)
    buf.line(`before: &[${m.recordName}],`)
    buf.line(`after: &[${m.recordName}],`)
    buf.dedent()
    buf.line(`) {`)
    buf.indent()

    if (idFieldRust) {
      // Fast path — keyed by ID! field. Matches busynca's hand-written
      // emit_point_diffs / emit_device_diffs shape exactly.
      buf.line(`use std::collections::HashMap;`)
      buf.line(`let before_map: HashMap<&str, &${m.recordName}> =`)
      buf.indent()
      buf.line(`before.iter().map(|e| (e.${idFieldRust}.as_str(), e)).collect();`)
      buf.dedent()
      buf.line(`let after_map: HashMap<&str, &${m.recordName}> =`)
      buf.indent()
      buf.line(`after.iter().map(|e| (e.${idFieldRust}.as_str(), e)).collect();`)
      buf.dedent()
      buf.blank()
      buf.line(`for (id, entry) in &after_map {`)
      buf.indent()
      buf.line(`match before_map.get(id) {`)
      buf.indent()
      buf.line(`Some(prev) if prev.${lwwFieldRust} == entry.${lwwFieldRust} => {}`)
      buf.line(`_ => {`)
      buf.indent()
      buf.line(`let _ = tx.send(${enumName}::${variantStem}Upserted((*entry).clone()));`)
      buf.dedent()
      buf.line(`}`)
      buf.dedent()
      buf.line(`}`)
      buf.dedent()
      buf.line(`}`)
      buf.line(`for id in before_map.keys() {`)
      buf.indent()
      buf.line(`if !after_map.contains_key(id) {`)
      buf.indent()
      buf.line(`let _ = tx.send(${enumName}::${variantStem}Deleted((*id).to_string()));`)
      buf.dedent()
      buf.line(`}`)
      buf.dedent()
      buf.line(`}`)
    } else {
      // Slow path — no ID! field. Compare by full equality on the
      // serialised JSON. This still produces correct events but at O(n²).
      // The validator should already have surfaced a warning for the
      // R230 violation upstream; we emit something that compiles.
      buf.line(`// No required ID! field on \`${m.recordName}\` — falling back`)
      buf.line(`// to JSON-equality comparison (slow). Add \`id: ID!\` to the`)
      buf.line(`// record to enable the keyed diff path.`)
      buf.line(`for entry in after {`)
      buf.indent()
      buf.line(`let prev_match = before.iter().find(|e| {`)
      buf.indent()
      buf.line(`serde_json::to_string(e).ok() == serde_json::to_string(entry).ok()`)
      buf.dedent()
      buf.line(`});`)
      buf.line(`if prev_match.is_none() {`)
      buf.indent()
      buf.line(`let _ = tx.send(${enumName}::${variantStem}Upserted(entry.clone()));`)
      buf.dedent()
      buf.line(`}`)
      buf.dedent()
      buf.line(`}`)
      // No id → can't sensibly emit Deleted; skip.
    }

    buf.dedent()
    buf.line(`}`)
    buf.blank()
  }
}

// ────────────────────────────────────────────────────────────────
// 3. <Doc>Doc::merge_remote_with_events convenience method
// ────────────────────────────────────────────────────────────────

function emitMergeRemoteWithEvents(buf: LineBuffer, g: CrdtDocGroup) {
  const wrapperName = crdtDocWrapperName(g.docName)
  const enumName = eventEnumName(g.docName)
  const docSuffix = crdtDocSuffix(g.docName)

  buf.line(`impl ${wrapperName} {`)
  buf.indent()
  buf.line(`/// Merge a remote snapshot and emit per-map diff events on \`tx\`.`)
  buf.line(`/// Snapshots every member root-map before and after the merge,`)
  buf.line(`/// runs the underlying \`merge_remote\`, then fans out`)
  buf.line(`/// \`${enumName}\` events for entries that changed.`)
  buf.line(`///`)
  buf.line(`/// Mirrors the \`start_group_sync_listener\` pattern in busynca's`)
  buf.line(`/// hand-written runtime: snapshot → merge → snapshot → diff →`)
  buf.line(`/// broadcast. Returning \`anyhow::Result<()>\` keeps the merge`)
  buf.line(`/// error path identical to plain \`merge_remote\`.`)
  buf.line(`pub fn merge_remote_with_events(`)
  buf.indent()
  buf.line(`&mut self,`)
  buf.line(`other: &[u8],`)
  buf.line(`tx: &tokio::sync::broadcast::Sender<${enumName}>,`)
  buf.dedent()
  buf.line(`) -> anyhow::Result<()> {`)
  buf.indent()

  // Snapshot before per member.
  buf.line(`// Snapshot every member root-map before the merge.`)
  for (const m of sortedMembers(g)) {
    const mapSnake = snakeCase(m.mapKey)
    buf.line(`let before_${mapSnake} = self.list_${mapSnake}().unwrap_or_default();`)
  }
  buf.blank()

  buf.line(`// Run the underlying Automerge merge. Errors short-circuit;`)
  buf.line(`// nothing is emitted on failure (caller sees the error).`)
  buf.line(`self.merge_remote(other)?;`)
  buf.blank()

  buf.line(`// Snapshot after, then diff each member root-map.`)
  for (const m of sortedMembers(g)) {
    const mapSnake = snakeCase(m.mapKey)
    buf.line(`let after_${mapSnake} = self.list_${mapSnake}().unwrap_or_default();`)
  }
  buf.blank()

  for (const m of sortedMembers(g)) {
    const mapSnake = snakeCase(m.mapKey)
    buf.line(`emit_${docSuffix}_${mapSnake}_diffs(tx, &before_${mapSnake}, &after_${mapSnake});`)
  }
  buf.blank()
  buf.line(`Ok(())`)
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function eventEnumName(docName: string): string {
  // "<Doc>Event" — e.g. doc="GroupSync" → "GroupSyncEvent". Avoids the
  // double-"Sync" awkwardness of `<Doc>SyncEvent` when the doc name
  // already ends in "Sync" (the busynca canonical case).
  //
  // Trade-off: collides if the SDL also defines an `event GroupSyncEvent`,
  // but `event` declarations live in their own type-namespace and the
  // generator will surface a Rust compile error if the user tried to do
  // both. The alternative (suffix per-namespace) buys nothing in the
  // common single-doc case.
  const clean = docName.replace(/[^A-Za-z0-9_]/g, '')
  const head = clean ? clean[0].toUpperCase() + clean.slice(1) : 'Composite'
  return `${head}Event`
}

function sortedMembers(g: CrdtDocGroup): CrdtDocMember[] {
  // Sort by mapKey for stable variant + fn ordering across runs. Using the
  // wire-side mapKey (not the SDL-source order) keeps two SDL files that
  // differ only in record order producing identical Rust output — same
  // determinism principle as MAP_KEYS.
  return g.members.slice().sort((a, b) => (a.mapKey < b.mapKey ? -1 : a.mapKey > b.mapKey ? 1 : 0))
}

function mapKeyToVariantStem(mapKey: string): string {
  // "points" → "Points", "ground_stations" → "GroundStations".
  // Strip trailing 's' would conflate "status" with "statu" — leave as-is
  // and let the user pluralise the map key in SDL if they want a singular
  // variant stem.
  return mapKey
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1).toLowerCase())
    .join('')
}

function findRequiredIdField(rec: IRRecord): IRRecord['fields'][number] | null {
  // Same R230 rule as types-gen.ts uses for upsert id resolution.
  return rec.fields.find(f => f.type === 'ID' && f.required && !f.list) ?? null
}

function resolveLwwField(rec: IRRecord): string {
  // Mirrors the resolution order in types-gen.ts → emitCrdtDocWrappers:
  // @crdt_doc_member.lww_field → @crdt(key:) → "updated_at" (R110).
  const memberDir = findDirective(rec.directives, 'crdt_doc_member')
  if (memberDir && typeof memberDir.args?.lww_field === 'string') {
    return memberDir.args.lww_field as string
  }
  const crdt = findDirective(rec.directives, 'crdt')
  if (crdt && typeof crdt.args?.key === 'string') {
    return crdt.args.key as string
  }
  return 'updated_at'
}
