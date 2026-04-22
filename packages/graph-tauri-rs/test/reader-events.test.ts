// Smoke test for @alaq/graph-tauri-rs W9 — parses Belladonna's demo
// `reader-events.aql`, generates the Rust module tree, and asserts that
// event payload structs + `emit_<snake>` helpers land in the expected
// files.

import { test, expect, describe, beforeAll } from 'bun:test'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const AQL = join(
  import.meta.dir,
  '..', '..', '..', '..',
  'pharos', 'Belladonna', 'schema', 'reader-events.aql',
)

let generated: ReturnType<typeof generate>

beforeAll(() => {
  const src = readFileSync(AQL, 'utf8')
  const res = parseSource(src, 'reader-events.aql')
  expect(res.ir).not.toBeNull()
  const errs = res.diagnostics.filter(d => d.severity === 'error')
  expect(errs).toEqual([])
  generated = generate(res.ir!, { namespace: 'belladonna.reader.events' })
})

describe('reader-events.aql → @alaq/graph-tauri-rs (W9)', () => {
  test('no error diagnostics', () => {
    const errs = generated.diagnostics.filter(d => d.severity === 'error')
    expect(errs).toEqual([])
  })

  test('types.rs carries event payload structs', () => {
    const types = generated.files.find(f => f.path.endsWith('/types.rs'))!
    expect(types.content).toContain('pub struct RenderProgress')
    expect(types.content).toContain('pub struct RenderCompleted')
    expect(types.content).toContain('pub struct RenderFailed')
    // Payload shape — fields translate like records.
    expect(types.content).toContain('pub path: String,')
    expect(types.content).toContain('pub bytes: i64,')
    expect(types.content).toContain('pub total: i64,')
    expect(types.content).toContain('pub duration_ms: i64,')
    expect(types.content).toContain('pub message: String,')
  })

  test('events.rs emits typed emit_<snake> helpers', () => {
    const ev = generated.files.find(f => f.path.endsWith('/events.rs'))!
    // Each SDL event → one emit helper.
    expect(ev.content).toContain('pub fn emit_render_progress<R: tauri::Runtime>(')
    expect(ev.content).toContain('pub fn emit_render_completed<R: tauri::Runtime>(')
    expect(ev.content).toContain('pub fn emit_render_failed<R: tauri::Runtime>(')
    // Payload ref + AppHandle<R>.
    expect(ev.content).toContain('app: &tauri::AppHandle<R>,')
    expect(ev.content).toContain('payload: &RenderProgress,')
    expect(ev.content).toContain('payload: &RenderCompleted,')
    expect(ev.content).toContain('payload: &RenderFailed,')
    // Wire name matches snake_case(EventName).
    expect(ev.content).toContain(`app.emit("render_progress", payload)`)
    expect(ev.content).toContain(`app.emit("render_completed", payload)`)
    expect(ev.content).toContain(`app.emit("render_failed", payload)`)
    // tauri::Emitter in scope.
    expect(ev.content).toContain('use tauri::Emitter;')
  })
})
