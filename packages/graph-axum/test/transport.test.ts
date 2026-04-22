// @alaq/graph-axum — E025 (@transport mismatch) generator-level tests.
//
// SPEC §7.14 defines `@transport(kind: "tauri" | "http" | "zenoh" | "any")`
// as a binding intent declaration. Each generator declares its supported
// transports and **refuses** emission (error + empty files) when the
// schema asks for something outside that set (R221/R224). `"any"` and
// absent `@transport` are the documented escape hatches (R222).
//
// Pre-0.3.5 this was W005 (advisory warning, generation proceeded). C7
// tightened it because warning-only validation trained users to ignore
// the mismatch and ship bogus artifacts. See stress.md C7 and SPEC §15
// 0.3.5 changelog.

import { describe, expect, test } from 'bun:test'
import { parseSource } from '../../graph/src/index'
import { generate, SUPPORTED_TRANSPORTS } from '../src/index'

describe('@transport mismatch → E025 refusal', () => {
  test('SUPPORTED_TRANSPORTS advertises ["http", "any"]', () => {
    expect([...SUPPORTED_TRANSPORTS].sort()).toEqual(['any', 'http'])
  })

  test('no @transport → zero transport-related diagnostics, files emitted', () => {
    const src = `schema S { version: 1, namespace: "s" }
action Ping { output: Boolean! }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const gen = generate(ir!)
    const transportDiags = gen.diagnostics.filter(d => d.message.includes('@transport'))
    expect(transportDiags).toEqual([])
    expect(gen.files.length).toBeGreaterThan(0)
  })

  test('@transport(kind: "http") → no E025 (native match), files emitted', () => {
    const src = `schema S @transport(kind: "http") { version: 1, namespace: "s" }
action Ping { output: Boolean! }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const gen = generate(ir!)
    const transportDiags = gen.diagnostics.filter(d => d.message.includes('@transport'))
    expect(transportDiags).toEqual([])
    expect(gen.files.length).toBeGreaterThan(0)
  })

  test('@transport(kind: "any") → no E025 (explicit escape hatch), files emitted', () => {
    const src = `schema S @transport(kind: "any") { version: 1, namespace: "s" }
action Ping { output: Boolean! }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const gen = generate(ir!)
    const transportDiags = gen.diagnostics.filter(d => d.message.includes('@transport'))
    expect(transportDiags).toEqual([])
    expect(gen.files.length).toBeGreaterThan(0)
  })

  test('@transport(kind: "tauri") → E025 error, files: []', () => {
    const src = `schema S @transport(kind: "tauri") { version: 1, namespace: "s" }
action Ping { output: Boolean! }`
    const { ir, diagnostics } = parseSource(src)
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const gen = generate(ir!)
    // Refusal contract R224: empty file set + single error diagnostic.
    expect(gen.files).toEqual([])
    const errors = gen.diagnostics.filter(d => d.severity === 'error')
    expect(errors.length).toBe(1)
    expect(errors[0]!.message).toContain('"tauri"')
    expect(errors[0]!.message).toContain('@alaq/graph-axum')
    expect(errors[0]!.message).toContain('E025')
    // No warning-severity mismatch diagnostic is emitted anymore
    // (W005 was retired in v0.3.5 — see §7.14 R221).
    const transportWarnings = gen.diagnostics.filter(
      d => d.severity === 'warning' && d.message.includes('@transport'),
    )
    expect(transportWarnings).toEqual([])
  })

  test('@transport(kind: "zenoh") → E025 error, files: []', () => {
    const src = `schema S @transport(kind: "zenoh") { version: 1, namespace: "s" }
action Ping { output: Boolean! }`
    const { ir } = parseSource(src)
    const gen = generate(ir!)
    expect(gen.files).toEqual([])
    const errors = gen.diagnostics.filter(d => d.severity === 'error')
    expect(errors.length).toBe(1)
    expect(errors[0]!.message).toContain('"zenoh"')
    expect(errors[0]!.message).toContain('E025')
  })

  test('E025 message mentions escape hatch @transport(kind: "any")', () => {
    const src = `schema S @transport(kind: "tauri") { version: 1, namespace: "s" }`
    const { ir } = parseSource(src)
    const gen = generate(ir!)
    const errors = gen.diagnostics.filter(d => d.severity === 'error')
    expect(errors.length).toBe(1)
    // The error message must tell the author how to opt out.
    expect(errors[0]!.message).toContain('any')
  })
})
