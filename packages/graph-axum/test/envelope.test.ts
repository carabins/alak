// Wire-format envelope option (2026-04-24) — see routes-gen.ts header and
// GenerateOptions.wireEnvelope in index.ts.
//
// The three alak HTTP clients (`@alaq/graph-link-http`,
// `@alaq/graph-link-http-rs`, `alaq-link-http-client`) hardcode
// `{ "input": <body> }`. Servers default to `wireEnvelope: 'wrapped'` so
// generated servers match the clients out of the box. `'bare'` preserves
// pre-envelope behaviour for non-alak callers.

import { describe, expect, test } from 'bun:test'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'

const SRC = `schema DemoNs @transport(kind: "http") { version: 1, namespace: "demo.ns" }

action Ping { output: Boolean! }

action Echo {
  input: { msg: String! }
  output: String!
}
`

function gen(wireEnvelope?: 'bare' | 'wrapped') {
  const res = parseSource(SRC, 'demo.aql')
  expect(res.diagnostics.filter(d => d.severity === 'error')).toEqual([])
  expect(res.ir).not.toBeNull()
  const out = generate(res.ir!, { namespace: 'demo.ns', wireEnvelope })
  const byPath: Record<string, string> = {}
  for (const f of out.files) byPath[f.path] = f.content
  return { byPath, diagnostics: out.diagnostics }
}

describe('graph-axum — wireEnvelope', () => {
  test('default mode is "wrapped" — matches canonical alak HTTP clients', () => {
    const { byPath } = gen() // no explicit option
    const routes = byPath['demo_ns/routes.rs']
    expect(routes).toContain('use serde::Deserialize;')
    expect(routes).toContain('struct EchoEnvelope { input: EchoInput }')
    expect(routes).toContain('Json(env): Json<EchoEnvelope>,')
    expect(routes).toContain('let input = env.input;')
    expect(routes).toContain('state.handlers.echo(ctx, input).await?')
  })

  test('"wrapped" mode: Ping (empty input) skips envelope struct entirely', () => {
    const { byPath } = gen('wrapped')
    const routes = byPath['demo_ns/routes.rs']
    expect(routes).not.toContain('PingEnvelope')
    expect(routes).not.toMatch(/Json\(env\): Json<PingEnvelope>/)
    expect(routes).toContain('state.handlers.ping(ctx).await?')
  })

  test('"bare" mode: dispatcher extracts Json<Input> directly — pre-envelope behaviour', () => {
    const { byPath } = gen('bare')
    const routes = byPath['demo_ns/routes.rs']
    // No envelope machinery.
    expect(routes).not.toContain('EchoEnvelope')
    expect(routes).not.toContain('use serde::Deserialize;')
    expect(routes).not.toContain('let input = env.input;')
    // Direct Json<Input> extractor.
    expect(routes).toContain('Json(input): Json<EchoInput>,')
    expect(routes).toContain('state.handlers.echo(ctx, input).await?')
  })

  test('handler trait signatures are identical across both modes — envelope is transport-only', () => {
    const wrapped = gen('wrapped').byPath['demo_ns/handlers.rs']
    const bare = gen('bare').byPath['demo_ns/handlers.rs']
    expect(wrapped).toBe(bare)
  })

  test('types.rs identical across modes — envelope does not leak into the public surface', () => {
    const wrapped = gen('wrapped').byPath['demo_ns/types.rs']
    const bare = gen('bare').byPath['demo_ns/types.rs']
    expect(wrapped).toBe(bare)
    expect(wrapped).not.toContain('Envelope')
  })

  test('both modes emit the same routing table (POST /<snake>)', () => {
    const wrapped = gen('wrapped').byPath['demo_ns/routes.rs']
    const bare = gen('bare').byPath['demo_ns/routes.rs']
    for (const src of [wrapped, bare]) {
      expect(src).toContain('.route("/ping", post(dispatch_ping::<H>))')
      expect(src).toContain('.route("/echo", post(dispatch_echo::<H>))')
    }
  })
})
