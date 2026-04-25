// C2 (2026-04-21): when an action declares no input fields, we drop
//   • the `<Action>Input` struct from types.rs
//   • the `input: <Action>Input` parameter from the handlers trait method
//   • the `Json(input): Json<<Action>Input>` extractor from the dispatcher
//
// The POST route stays mounted; axum accepts a body-less POST and calls the
// trait method with `(ctx)` alone.

import { describe, expect, test, beforeAll } from 'bun:test'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'

const SRC = `schema DemoNs @transport(kind: "http") { version: 1, namespace: "demo.ns" }

action Ping { output: Boolean! }

action CloseWindow {}

action Echo {
  input: { msg: String! }
  output: String!
}
`

let byPath: Record<string, string>

beforeAll(() => {
  const res = parseSource(SRC, 'demo.aql')
  expect(res.diagnostics.filter(d => d.severity === 'error')).toEqual([])
  expect(res.ir).not.toBeNull()
  const gen = generate(res.ir!, { namespace: 'demo.ns' })
  byPath = {}
  for (const f of gen.files) byPath[f.path] = f.content
})

describe('empty-input actions — graph-axum (C2)', () => {
  test('types.rs: no <Action>Input struct for empty-input actions', () => {
    const s = byPath['demo_ns/types.rs']
    expect(s).not.toContain('pub struct PingInput')
    expect(s).not.toContain('pub struct CloseWindowInput')
    // Non-empty input still emitted.
    expect(s).toContain('pub struct EchoInput')
  })

  test('handlers.rs: trait method signatures drop `input` param for empty-input actions', () => {
    const s = byPath['demo_ns/handlers.rs']
    expect(s).toMatch(/async fn ping\(&self, ctx: ActionContext\) -> Result<bool, HandlerError>;/)
    expect(s).toMatch(/async fn close_window\(&self, ctx: ActionContext\) -> Result<\(\), HandlerError>;/)
    expect(s).toMatch(/async fn echo\(&self, ctx: ActionContext, input: EchoInput\) -> Result<String, HandlerError>;/)
  })

  test('routes.rs: dispatcher skips Json<Input> extractor for empty-input actions', () => {
    const s = byPath['demo_ns/routes.rs']
    // Routes still mounted.
    expect(s).toContain('.route("/ping", post(dispatch_ping::<H>))')
    expect(s).toContain('.route("/close_window", post(dispatch_close_window::<H>))')
    // Ping dispatcher has State + ctx only — no Json<Input>.
    expect(s).toMatch(
      /async fn dispatch_ping<H: Handlers>\(\s+State\(state\): State<AppState<H>>,\s+ctx: ActionContext,\s+\) -> Result<Response, HandlerError>/,
    )
    // Body of the dispatcher calls handler with (ctx) only.
    expect(s).toContain('state.handlers.ping(ctx).await?')
    expect(s).toContain('state.handlers.close_window(ctx).await?')
    // Echo (has input) — default wireEnvelope='wrapped' emits EchoEnvelope +
    // unwrap, handler still receives (ctx, input).
    expect(s).toContain('struct EchoEnvelope { input: EchoInput }')
    expect(s).toContain('Json(env): Json<EchoEnvelope>,')
    expect(s).toContain('let input = env.input;')
    expect(s).toContain('state.handlers.echo(ctx, input).await?')
  })

  test('empty-input actions never reference <Action>Input anywhere', () => {
    const all = Object.values(byPath).join('\n')
    expect(all).not.toContain('PingInput')
    expect(all).not.toContain('CloseWindowInput')
  })
})
