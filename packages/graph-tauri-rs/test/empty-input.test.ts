// C2 (2026-04-21): when an action declares no input fields, we drop
//   • the `<Action>Input` struct from types.rs
//   • the `input: <Action>Input` parameter from the commands.rs adapter
//   • the `input` parameter from the handlers.rs trait method
// TS side (graph-tauri) mirrors: no `I<Action>Input` interface, no function
// argument, and `invoke('name')` is called with no second argument so the
// wire payload carries nothing instead of `{ input: {} }`.
//
// This test fixture is a small inline schema — one empty-input action plus
// one that carries input so both branches are exercised in the same run.

import { describe, expect, test, beforeAll } from 'bun:test'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'

const SRC = `schema DemoNs { version: 1, namespace: "demo.ns" }

# No fields — exercises the empty-input branch.
action Ping { output: Boolean! }

# Fire-and-forget, still no input.
action CloseWindow {}

# Non-empty input — the pre-existing branch still works.
action Echo {
  input: { msg: String! }
  output: String!
}
`

let gen: ReturnType<typeof generate>

beforeAll(() => {
  const res = parseSource(SRC, 'demo.aql')
  expect(res.diagnostics.filter(d => d.severity === 'error')).toEqual([])
  expect(res.ir).not.toBeNull()
  gen = generate(res.ir!, { namespace: 'demo.ns' })
})

function file(name: string): string {
  const f = gen.files.find(x => x.path.endsWith(`/${name}`))
  if (!f) throw new Error(`no file ${name} emitted`)
  return f.content
}

describe('empty-input actions — graph-tauri-rs (C2)', () => {
  test('no error diagnostics', () => {
    const errs = gen.diagnostics.filter(d => d.severity === 'error')
    expect(errs).toEqual([])
  })

  test('types.rs: no <Action>Input struct for empty-input actions', () => {
    const s = file('types.rs')
    expect(s).not.toContain('pub struct PingInput')
    expect(s).not.toContain('pub struct CloseWindowInput')
    // Non-empty input still emitted.
    expect(s).toContain('pub struct EchoInput')
  })

  test('commands.rs: empty-input adapter has no `input` parameter', () => {
    const s = file('commands.rs')
    // Ping — present, body-less.
    expect(s).toMatch(/pub async fn ping\(\s+handlers: tauri::State[^)]+,\s+app: tauri::AppHandle,\s+\)/)
    // Delegates without passing input.
    expect(s).toContain('handlers.ping(&app).await')
    // CloseWindow — same shape.
    expect(s).toContain('handlers.close_window(&app).await')
    // Echo — preserves input param.
    expect(s).toContain('input: EchoInput,')
    expect(s).toContain('handlers.echo(&app, input).await')
  })

  test('handlers.rs: trait method has no `input` parameter for empty-input actions', () => {
    const s = file('handlers.rs')
    expect(s).toMatch(/async fn ping\(\s+&self,\s+app: &tauri::AppHandle,\s+\) -> Result<bool, AppError>;/)
    expect(s).toMatch(/async fn close_window\(\s+&self,\s+app: &tauri::AppHandle,\s+\) -> Result<\(\), AppError>;/)
    // Echo keeps `input: EchoInput`.
    expect(s).toContain('input: EchoInput,')
  })

  test('commands.rs doc hint: empty-input invoke() carries no args', () => {
    const s = file('commands.rs')
    // `invoke('ping')` — no second arg.
    expect(s).toContain(`invoke('ping')`)
    expect(s).toContain(`invoke('close_window')`)
    // Echo still carries `{ input: ... }`.
    expect(s).toMatch(/invoke\('echo',\s*\{\s*input:/)
  })
})
