// Smoke test for @alaq/graph-tauri W9 — events flow through as typed
// `on<EventName>` listen wrappers plus `I<EventName>` payload interfaces.

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

let generated: string

beforeAll(() => {
  const src = readFileSync(AQL, 'utf8')
  const res = parseSource(src, 'reader-events.aql')
  expect(res.ir).not.toBeNull()
  const errs = res.diagnostics.filter(d => d.severity === 'error')
  expect(errs).toEqual([])
  const gen = generate(res.ir!, { namespace: 'belladonna.reader.events' })
  expect(gen.files.length).toBe(1)
  generated = gen.files[0].content
})

describe('reader-events.aql → @alaq/graph-tauri (W9)', () => {
  test('event payload interfaces are emitted', () => {
    for (const name of ['IRenderProgress', 'IRenderCompleted', 'IRenderFailed']) {
      expect(generated).toContain(`export interface ${name} {`)
    }
    expect(generated).toContain('readonly path: string')
    expect(generated).toContain('readonly bytes: number')
    expect(generated).toContain('readonly duration_ms: number')
    expect(generated).toContain('readonly message: string')
  })

  test('on<EventName> typed wrappers over listen()', () => {
    expect(generated).toContain(`import { listen, type UnlistenFn } from '@tauri-apps/api/event'`)
    expect(generated).toContain('export function onRenderProgress(')
    expect(generated).toContain('export function onRenderCompleted(')
    expect(generated).toContain('export function onRenderFailed(')
    expect(generated).toContain(`listen<IRenderProgress>('render_progress',`)
    expect(generated).toContain(`listen<IRenderCompleted>('render_completed',`)
    expect(generated).toContain(`listen<IRenderFailed>('render_failed',`)
  })
})
