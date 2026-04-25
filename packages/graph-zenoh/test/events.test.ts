// @alaq/graph-zenoh — codegen-time event emission tests (v0.3.11).
//
// Covers the events-gen module: per-doc enum, per-map emit_*_diffs, and
// the merge_remote_with_events convenience method. The rt crate signature
// for SyncEvent / broadcast doesn't exist — events live entirely in the
// generated Rust namespace. cargo-sandbox type-check is exercised by
// busynca-codegen.test.ts; this file focuses on shape variations the
// busynca fixture doesn't probe (multi-doc, missing ID!, single-member).

import { describe, expect, test } from 'bun:test'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'

function compile(src: string, namespace: string) {
  const res = compileSources([{ path: 't.aql', source: src }])
  const errs = res.diagnostics.filter(d => d.severity === 'error')
  expect(errs).toEqual([])
  const gen = generate(res.ir!, { namespace })
  expect(gen.files.length).toBe(1)
  return { rust: gen.files[0]!.content, diags: gen.diagnostics }
}

describe('Composite CRDT document — codegen-time events', () => {
  const SINGLE_DOC = `
    schema S @crdt_doc_topic(doc: "Single", pattern: "ns/{id}/patch") {
      version: 1
      namespace: "single_doc"
    }
    record Item @crdt_doc_member(doc: "Single", map: "items",
                                 soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
                @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      is_deleted: Boolean!
      updated_at: Timestamp!
      name: String!
    }
  `

  test('emits enum SingleEvent with Items{Upserted,Deleted} variants', () => {
    const { rust } = compile(SINGLE_DOC, 'single_doc')
    expect(rust).toContain('pub enum SingleEvent {')
    expect(rust).toContain('ItemsUpserted(Item),')
    expect(rust).toContain('ItemsDeleted(String),')
    expect(rust).toContain('#[non_exhaustive]')
  })

  test('emits emit_single_items_diffs keyed by id, comparator on updated_at', () => {
    const { rust } = compile(SINGLE_DOC, 'single_doc')
    expect(rust).toContain('pub fn emit_single_items_diffs(')
    expect(rust).toContain('tx: &tokio::sync::broadcast::Sender<SingleEvent>,')
    expect(rust).toContain('before.iter().map(|e| (e.id.as_str(), e))')
    expect(rust).toContain('Some(prev) if prev.updated_at == entry.updated_at => {}')
  })

  test('emits SingleDoc::merge_remote_with_events that snapshots and fans out', () => {
    const { rust } = compile(SINGLE_DOC, 'single_doc')
    expect(rust).toContain('pub fn merge_remote_with_events(')
    expect(rust).toContain('tx: &tokio::sync::broadcast::Sender<SingleEvent>,')
    expect(rust).toContain('let before_items = self.list_items().unwrap_or_default();')
    expect(rust).toContain('self.merge_remote(other)?;')
    expect(rust).toContain('emit_single_items_diffs(tx, &before_items, &after_items);')
  })

  test('events-gen header only emits when composite docs exist', () => {
    const { rust } = compile(
      `schema S { version: 1, namespace: "no_doc" } record R { id: ID! }`,
      'no_doc',
    )
    // No composite docs → no events section at all.
    expect(rust).not.toContain('Composite CRDT document events')
    expect(rust).not.toContain('pub enum')
  })
})

describe('Multi-doc schema — separate event enum per doc', () => {
  // Two independent composite documents in the same schema → two enums,
  // two sets of emit_*_diffs, two merge_remote_with_events impls.
  const SRC = `
    schema S @crdt_doc_topic(doc: "Alpha", pattern: "ns/alpha/{id}")
             @crdt_doc_topic(doc: "Beta", pattern: "ns/beta/{id}") {
      version: 1
      namespace: "multi_doc"
    }
    record A @crdt_doc_member(doc: "Alpha", map: "as",
                              soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
             @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      is_deleted: Boolean!
      updated_at: Timestamp!
    }
    record B @crdt_doc_member(doc: "Beta", map: "bs",
                              soft_delete: { flag: "is_deleted", ts_field: "ts" })
             @crdt(type: LWW_MAP, key: "ts") {
      id: ID!
      is_deleted: Boolean!
      ts: Timestamp!
    }
  `

  test('emits AlphaEvent and BetaEvent independently', () => {
    const { rust } = compile(SRC, 'multi_doc')
    expect(rust).toContain('pub enum AlphaEvent {')
    expect(rust).toContain('pub enum BetaEvent {')
    expect(rust).toContain('AsUpserted(A),')
    expect(rust).toContain('BsUpserted(B),')
  })

  test('emits separate diff fns per doc', () => {
    const { rust } = compile(SRC, 'multi_doc')
    expect(rust).toContain('pub fn emit_alpha_as_diffs(')
    expect(rust).toContain('pub fn emit_beta_bs_diffs(')
  })

  test('AlphaDoc / BetaDoc each have their own merge_remote_with_events', () => {
    const { rust } = compile(SRC, 'multi_doc')
    // Both impls present, each takes its matching event sender.
    expect(rust).toContain('Sender<AlphaEvent>')
    expect(rust).toContain('Sender<BetaEvent>')
  })
})

describe('Missing required ID! — fallback path + diagnostic', () => {
  // R230 says member records SHOULD have an `id: ID!` (validator doesn't
  // enforce in 0.3.11 — see types-gen.ts). When absent, events-gen falls
  // back to JSON-equality comparison and surfaces a warning so the SDL
  // author knows the diff is on the slow path.
  const SRC = `
    schema S @crdt_doc_topic(doc: "Loose", pattern: "ns/loose") {
      version: 1
      namespace: "no_id"
    }
    record Loose @crdt_doc_member(doc: "Loose", map: "loose_items",
                                  soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
                 @crdt(type: LWW_MAP, key: "updated_at") {
      uuid: String!
      is_deleted: Boolean!
      updated_at: Timestamp!
    }
  `

  test('warning surfaces when no required ID! field is present', () => {
    const { diags } = compile(SRC, 'no_id')
    const warns = diags.filter(d => d.severity === 'warning')
    expect(warns.some(w => /no required ID!/.test(w.message))).toBe(true)
  })

  test('falls back to JSON-equality comparison in the diff fn', () => {
    const { rust } = compile(SRC, 'no_id')
    expect(rust).toContain('pub fn emit_loose_loose_items_diffs(')
    // The fallback path uses serde_json::to_string for whole-record compare.
    expect(rust).toContain('serde_json::to_string(e).ok() == serde_json::to_string(entry).ok()')
    // The fast-path HashMap is NOT emitted on this code path.
    const idx = rust.indexOf('pub fn emit_loose_loose_items_diffs(')
    const tail = rust.slice(idx, idx + 1500)
    expect(tail).not.toContain('use std::collections::HashMap;')
  })
})

describe('Variant naming — multi-word map keys PascalCase cleanly', () => {
  const SRC = `
    schema S @crdt_doc_topic(doc: "Multi", pattern: "ns/multi") {
      version: 1
      namespace: "multi_word"
    }
    record GS @crdt_doc_member(doc: "Multi", map: "ground_stations",
                               soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
              @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      is_deleted: Boolean!
      updated_at: Timestamp!
    }
  `

  test('"ground_stations" → variant stem "GroundStations"', () => {
    const { rust } = compile(SRC, 'multi_word')
    expect(rust).toContain('GroundStationsUpserted(GS),')
    expect(rust).toContain('GroundStationsDeleted(String),')
    expect(rust).toContain('pub fn emit_multi_ground_stations_diffs(')
  })
})
