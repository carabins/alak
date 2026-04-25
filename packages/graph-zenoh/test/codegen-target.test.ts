// @alaq/graph-zenoh — `@codegen_target(rust: { emit_pubsub: false })`
// (SPEC 0.3.12 §7.27). Schema-level Rust-target override that drops every
// `zenoh::Session`-using helper from the generated module while keeping
// types, scalars, enums, CRDT-doc wrappers and SyncEvent + emit_*_diffs.
//
// Drives the Бусинка use-case: BusyncaNode wraps publish/subscribe in its
// own layer, so the codegen-emitted helpers were being hand-stripped after
// every regen. With `emit_pubsub: false` the generator now yields the
// stripped shape directly.

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

describe('@codegen_target(rust: { emit_pubsub: false }) — Бусинка shape', () => {
  const SRC = `
    schema S @transport(kind: "zenoh")
             @codegen_target(rust: { emit_pubsub: false })
             @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch")
             @schema_version(doc: "D", value: 1) {
      version: 1
      namespace: "ct_off"
    }

    record Item @crdt_doc_member(doc: "D",
                                 map: "items",
                                 lww_field: "updated_at",
                                 soft_delete: { flag: "is_deleted",
                                                ts_field: "updated_at" })
                @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      label: String!
      updated_at: Timestamp!
      is_deleted: Boolean!
    }

    record HotMsg @atomic
                  @topic(pattern: "ns/{id}/hot") {
      id: String!
      ts: Timestamp!
    }
  `

  test('drops `use zenoh::*` import line', () => {
    const { rust } = compile(SRC, 'ct_off')
    expect(rust).not.toContain('use zenoh::')
    // `use std::sync::Arc;` is only used by pub/sub subscribers — also gone.
    expect(rust).not.toContain('use std::sync::Arc;')
  })

  test('drops zenoh from the dep-list header comment', () => {
    const { rust } = compile(SRC, 'ct_off')
    // Header still names serde + serde_cbor (Item has @atomic neighbours
    // through HotMsg) + automerge (composite doc), but no zenoh line.
    const headerEnd = rust.indexOf('#![allow(')
    expect(headerEnd).toBeGreaterThan(-1)
    const header = rust.slice(0, headerEnd)
    expect(header).not.toContain('zenoh = ')
  })

  test('drops zenoh + tokio from the Cargo footer comment', () => {
    const { rust } = compile(SRC, 'ct_off')
    const footerStart = rust.lastIndexOf('Suggested Cargo.toml fragment')
    expect(footerStart).toBeGreaterThan(-1)
    const footer = rust.slice(footerStart)
    expect(footer).not.toContain('zenoh = ')
    expect(footer).not.toContain('tokio = ')
  })

  test('drops per-record publish_/subscribe_ helpers', () => {
    const { rust } = compile(SRC, 'ct_off')
    expect(rust).not.toContain('pub async fn publish_hot_msg(')
    expect(rust).not.toContain('pub async fn subscribe_hot_msg')
  })

  test('drops composite-doc publish_/subscribe_ helpers', () => {
    const { rust } = compile(SRC, 'ct_off')
    expect(rust).not.toContain('pub async fn publish_d(')
    expect(rust).not.toContain('pub async fn subscribe_d')
  })

  test('keeps types — struct + enum + scalars survive', () => {
    const { rust } = compile(SRC, 'ct_off')
    expect(rust).toContain('pub struct Item {')
    expect(rust).toContain('pub struct HotMsg {')
  })

  test('keeps composite-doc wrapper + CrdtDoc import', () => {
    const { rust } = compile(SRC, 'ct_off')
    expect(rust).toContain('use alaq_graph_zenoh_rt::CrdtDoc;')
    expect(rust).toContain('pub struct DDoc {')
    expect(rust).toContain('pub fn upsert_items(')
    expect(rust).toContain('pub fn list_items(')
  })

  test('keeps @atomic CBOR codec on HotMsg', () => {
    // CBOR encode/decode does not touch zenoh — must survive.
    const { rust } = compile(SRC, 'ct_off')
    expect(rust).toContain('pub fn encode_cbor(&self)')
    expect(rust).toContain('pub fn decode_cbor(')
  })
})

describe('@codegen_target unset — defaults to emit_pubsub: true', () => {
  const SRC = `
    schema S @transport(kind: "zenoh")
             @crdt_doc_topic(doc: "D", pattern: "ns/{id}/patch")
             @schema_version(doc: "D", value: 1) {
      version: 1
      namespace: "ct_def"
    }
    record Item @crdt_doc_member(doc: "D",
                                 map: "items",
                                 lww_field: "updated_at",
                                 soft_delete: { flag: "is_deleted",
                                                ts_field: "updated_at" })
                @crdt(type: LWW_MAP, key: "updated_at") {
      id: ID!
      updated_at: Timestamp!
      is_deleted: Boolean!
    }
    record HotMsg @atomic
                  @topic(pattern: "ns/{id}/hot") {
      id: String!
      ts: Timestamp!
    }
  `

  test('emits zenoh import + per-record + composite pub/sub by default', () => {
    const { rust } = compile(SRC, 'ct_def')
    expect(rust).toContain('use zenoh::{Session, prelude::r#async::*};')
    expect(rust).toContain('pub async fn publish_hot_msg(')
    expect(rust).toContain('pub async fn publish_d(')
    expect(rust).toContain('pub async fn subscribe_d')
  })
})

describe('@codegen_target(rust: { emit_pubsub: true }) — explicit default', () => {
  const SRC = `
    schema S @transport(kind: "zenoh")
             @codegen_target(rust: { emit_pubsub: true }) {
      version: 1
      namespace: "ct_explicit"
    }
    record Item @atomic @topic(pattern: "ns/{id}/hot") {
      id: String!
      ts: Timestamp!
    }
  `

  test('explicit true matches the default behaviour', () => {
    const { rust } = compile(SRC, 'ct_explicit')
    expect(rust).toContain('use zenoh::{Session, prelude::r#async::*};')
    expect(rust).toContain('pub async fn publish_item(')
  })
})

describe('@codegen_target site validation — schema only', () => {
  test('record-level @codegen_target is rejected (E029)', () => {
    const src = `
      schema S { version: 1, namespace: "ct_bad" }
      record R @codegen_target(rust: { emit_pubsub: false }) {
        id: ID!
      }
    `
    const res = compileSources([{ path: 't.aql', source: src }])
    const errs = res.diagnostics.filter(d => d.severity === 'error')
    expect(errs.length).toBeGreaterThan(0)
    expect(errs.some(e => e.code === 'E029')).toBe(true)
  })
})
