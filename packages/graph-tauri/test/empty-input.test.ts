// C2 (2026-04-21): when an action declares no input fields, we drop
//   • the `I<Action>Input` interface from the emitted .ts file
//   • the function argument from the exported wrapper
//   • the second argument from the `invoke('name')` call on the wire
//
// Result: Tauri IPC payload for `{ cmd: "close_window" }` is just the cmd —
// no `{ input: {} }` bloat travels on the wire.

import { describe, expect, test, beforeAll } from 'bun:test'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'

const SRC = `schema DemoNs { version: 1, namespace: "demo.ns" }

action Ping { output: Boolean! }

action CloseWindow {}

action Echo {
  input: { msg: String! }
  output: String!
}
`

let generated: string

beforeAll(() => {
  const res = parseSource(SRC, 'demo.aql')
  expect(res.diagnostics.filter(d => d.severity === 'error')).toEqual([])
  expect(res.ir).not.toBeNull()
  const gen = generate(res.ir!, { namespace: 'demo.ns' })
  expect(gen.files.length).toBe(1)
  generated = gen.files[0].content
})

describe('empty-input actions — graph-tauri (C2)', () => {
  test('no I<Action>Input interface for empty-input actions', () => {
    expect(generated).not.toContain('export interface IPingInput')
    expect(generated).not.toContain('export interface ICloseWindowInput')
    // Non-empty input still emitted.
    expect(generated).toContain('export interface IEchoInput {')
  })

  test('wrapper for empty-input action has no function argument', () => {
    expect(generated).toMatch(/export async function ping\(\): Promise<boolean>/)
    expect(generated).toMatch(/export async function closeWindow\(\): Promise<void>/)
    // Echo preserves its typed input.
    expect(generated).toMatch(/export async function echo\(input: IEchoInput\): Promise<string>/)
  })

  test('invoke() for empty-input action carries no second argument', () => {
    // Ping has output → `return invoke<T>('ping')`
    expect(generated).toContain(`invoke<boolean>('ping')`)
    // CloseWindow no output → `await invoke('close_window')`
    expect(generated).toContain(`await invoke('close_window')`)
    // Echo keeps `{ input }`.
    expect(generated).toContain(`invoke<string>('echo', { input })`)
  })

  test('createTauriApi binds empty-input actions without args', () => {
    expect(generated).toContain(`ping: () => ping(),`)
    expect(generated).toContain(`closeWindow: () => closeWindow(),`)
    expect(generated).toContain(`echo: (input: IEchoInput) => echo(input),`)
  })
})
