// @alaq/graph-zenoh — @liveliness_token codegen tests (v0.3.10, SPEC §7.26).
//
// Asserts on the *generated* Rust source for records carrying
// `@liveliness_token(pattern: ...)`. Verifies the producer emits
// `declare_alive_<rec>` (returning a `LivelinessToken<'static>` Drop-guard)
// and the subscriber emits `subscribe_alive_<rec>` (callback over
// `(SampleKind, KeyExpr)`). End-to-end Rust compilation is covered by the
// cargo-sandbox integration in a follow-up (out of scope for this unit
// test file).

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

const SRC = `
  schema S { version: 1, namespace: "presence" }
  record DeviceAlive @liveliness_token(pattern: "busynca/v2/{group}/alive/{device_id}") {
    group: String!
    device_id: String!
  }
`

describe('@liveliness_token — Zenoh codegen (v0.3.10)', () => {
  test('emits declare_alive_<rec> async fn returning LivelinessToken', () => {
    const { rust } = compile(SRC, 'presence')
    expect(rust).toContain('pub async fn declare_alive_device_alive(')
    expect(rust).toContain('value: &DeviceAlive,')
    expect(rust).toContain(') -> zenoh::Result<zenoh::liveliness::LivelinessToken<\'static>>')
  })

  test('declare_alive resolves {field} placeholders against the value', () => {
    const { rust } = compile(SRC, 'presence')
    // The format! template strips {name}, leaving positional `{}` slots.
    expect(rust).toContain('format!("busynca/v2/{}/alive/{}", value.group, value.device_id)')
    expect(rust).toContain('session.liveliness().declare_token(&key)')
  })

  test('emits subscribe_alive_<rec> over (SampleKind, KeyExpr) callback', () => {
    const { rust } = compile(SRC, 'presence')
    expect(rust).toContain('pub async fn subscribe_alive_device_alive<F>')
    expect(rust).toContain('F: FnMut(zenoh::sample::SampleKind, zenoh::key_expr::KeyExpr<\'static>)')
  })

  test('subscribe_alive uses the wildcard form of the pattern', () => {
    const { rust } = compile(SRC, 'presence')
    // Each {placeholder} → '*' for the consumer-side declare_subscriber.
    expect(rust).toContain('let key = "busynca/v2/*/alive/*";')
    expect(rust).toContain('session.liveliness().declare_subscriber(key)')
  })

  test('records without @liveliness_token do not emit either helper', () => {
    const src = `
      schema S { version: 1, namespace: "no_pres" }
      record R { id: ID! }
    `
    const { rust } = compile(src, 'no_pres')
    expect(rust).not.toContain('declare_alive_')
    expect(rust).not.toContain('subscribe_alive_')
  })

  test('Liveliness section header appears only when at least one record uses the directive', () => {
    const { rust } = compile(SRC, 'presence')
    expect(rust).toContain('Liveliness presence helpers (@liveliness_token)')
  })

  test('pattern with no placeholders emits a literal key string', () => {
    const src = `
      schema S { version: 1, namespace: "literal" }
      record Flag @liveliness_token(pattern: "busynca/v2/global/alive") {
        id: ID!
      }
    `
    const { rust } = compile(src, 'literal')
    expect(rust).toContain('let key = "busynca/v2/global/alive".to_string();')
    // No format! call when there are no placeholders.
    expect(rust).not.toContain('format!("busynca/v2/global/alive"')
  })

  test('snake_case-named field placeholder resolves correctly to instance field', () => {
    const src = `
      schema S { version: 1, namespace: "snake" }
      record A @liveliness_token(pattern: "ns/{my_id}/alive") {
        my_id: String!
      }
    `
    const { rust } = compile(src, 'snake')
    expect(rust).toContain('format!("ns/{}/alive", value.my_id)')
  })
})
