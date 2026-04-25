// @alaq/graph-zenoh — codegen completeness for SPEC 0.3.9 directives
// (v0.3.10 follow-on). The four directives `@conflict`, `@bootstrap`,
// `@large`, `@deprecated_field` landed as syntax + validation in 0.3.9
// but the Zenoh generator did not emit any code for them. This file
// asserts on the new code-emission behaviour:
//
//   • @conflict       → `pub const CONFLICT_STRATEGY: &str` on impl
//   • @bootstrap      → `pub const BOOTSTRAP_MODE: &str` in topics mod
//   • @large          → `pub const LARGE_<FIELD>_THRESHOLD_KB: usize`
//   • @deprecated_field → `#[deprecated(note = "...")]` on field +
//                          generator W009 advisory in diagnostics

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

describe('@conflict — record-impl const (v0.3.10 codegen)', () => {
  const SRC = `
    schema S @crdt_doc_topic(doc: "D", pattern: "ns/{id}/p") {
      version: 1, namespace: "conf"
    }
    record P @crdt_doc_member(doc: "D", map: "items",
                              soft_delete: { flag: "is_deleted", ts_field: "updated_at" })
             @crdt(type: LWW_MAP, key: "updated_at")
             @conflict(strategy: operator_review) {
      id: ID!
      is_deleted: Boolean!
      updated_at: Timestamp!
    }
  `

  test('emits CONFLICT_STRATEGY const with the chosen strategy', () => {
    const { rust } = compile(SRC, 'conf')
    expect(rust).toContain('pub const CONFLICT_STRATEGY: &\'static str = "operator_review";')
  })

  test('records without @conflict do not emit the const', () => {
    const src = `
      schema S { version: 1, namespace: "noconf" }
      record R { id: ID! }
    `
    const { rust } = compile(src, 'noconf')
    expect(rust).not.toContain('CONFLICT_STRATEGY')
  })
})

describe('@bootstrap — topics-module const (v0.3.10 codegen)', () => {
  test('@bootstrap(mode: crdt_sync) emits BOOTSTRAP_MODE const', () => {
    const src = `
      schema S @bootstrap(mode: crdt_sync) { version: 1, namespace: "boot1" }
      record R { id: ID! }
    `
    const { rust } = compile(src, 'boot1')
    expect(rust).toContain('pub const BOOTSTRAP_MODE: &\'static str = "crdt_sync";')
  })

  test('@bootstrap(mode: full_snapshot) emits the full_snapshot string', () => {
    const src = `
      schema S @bootstrap(mode: full_snapshot) { version: 1, namespace: "boot2" }
      record R { id: ID! }
    `
    const { rust } = compile(src, 'boot2')
    expect(rust).toContain('pub const BOOTSTRAP_MODE: &\'static str = "full_snapshot";')
  })

  test('schemas without @bootstrap do not emit the const', () => {
    const src = `
      schema S { version: 1, namespace: "noboot" }
      record R { id: ID! }
    `
    const { rust } = compile(src, 'noboot')
    expect(rust).not.toContain('BOOTSTRAP_MODE')
  })
})

describe('@large — per-field threshold const (v0.3.10 codegen)', () => {
  test('@large(threshold_kb: 256) on a Bytes field emits the const', () => {
    const src = `
      schema S { version: 1, namespace: "large1" }
      record R { id: ID!, blob: Bytes! @large(threshold_kb: 256) }
    `
    const { rust } = compile(src, 'large1')
    expect(rust).toContain('pub const LARGE_BLOB_THRESHOLD_KB: usize = 256;')
  })

  test('field name is upper-snake-cased in the const name', () => {
    const src = `
      schema S { version: 1, namespace: "large2" }
      record R { id: ID!, biggerBlob: Bytes! @large(threshold_kb: 64) }
    `
    const { rust } = compile(src, 'large2')
    expect(rust).toContain('pub const LARGE_BIGGER_BLOB_THRESHOLD_KB: usize = 64;')
  })

  test('records without @large fields do not emit any LARGE_ const', () => {
    const src = `
      schema S { version: 1, namespace: "nolarge" }
      record R { id: ID!, blob: Bytes! }
    `
    const { rust } = compile(src, 'nolarge')
    expect(rust).not.toContain('LARGE_')
  })
})

describe('@deprecated_field — Rust attribute + W009 (v0.3.10 codegen)', () => {
  test('emits #[deprecated] on the struct field', () => {
    const src = `
      schema S { version: 1, namespace: "depf1" }
      record R { id: ID!, legacy: String! @deprecated_field(replaced_by: "id") }
    `
    const { rust } = compile(src, 'depf1')
    expect(rust).toContain('#[deprecated(note = "replaced by `id`")]')
    expect(rust).toContain('pub legacy: String,')
  })

  test('emits #[deprecated] without replaced_by note when arg omitted', () => {
    const src = `
      schema S { version: 1, namespace: "depf2" }
      record R { id: ID!, legacy: String! @deprecated_field }
    `
    const { rust } = compile(src, 'depf2')
    expect(rust).toContain('#[deprecated(note = "soft-deprecated; consumers should migrate before next major bump")]')
  })

  test('generator surfaces a W009 advisory in diagnostics', () => {
    const src = `
      schema S { version: 1, namespace: "depf3" }
      record R { id: ID!, legacy: String! @deprecated_field(replaced_by: "id") }
    `
    const { diags } = compile(src, 'depf3')
    const w009 = diags.find(d => d.severity === 'warning' && d.message.includes('[W009]'))
    expect(w009).toBeDefined()
    expect(w009!.message).toContain('R.legacy')
    expect(w009!.message).toContain('replaced by "id"')
  })

  test('no @deprecated_field → no #[deprecated] attribute, no W009 diag', () => {
    const src = `
      schema S { version: 1, namespace: "depf4" }
      record R { id: ID! }
    `
    const { rust, diags } = compile(src, 'depf4')
    expect(rust).not.toContain('#[deprecated')
    expect(diags.find(d => d.message.includes('[W009]'))).toBeUndefined()
  })
})
