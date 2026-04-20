import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { tauriPlugin, __resetTauriRuntime } from '../src/plugin'
import '../src/presets/tauri'

async function settle(ms = 20): Promise<void> {
  await new Promise(r => setTimeout(r, ms))
}

beforeEach(() => {
  __resetTauriRuntime()
})

describe('tauriPlugin — graceful degradation (no Tauri)', () => {
  test('state mode: $ready true, default value kept, no throws', async () => {
    // Don't inject ipc. Default runtime: hasTauri() is false in Bun (no window.__TAURI_INTERNALS__).
    const plugin = tauriPlugin()

    const n: any = createNu({
      realm: 'app', id: 'sys.x',
      value: 'fallback',
      tauri: { read: 'some_cmd', write: 'set_x' },
      plugins: [plugin],
    } as any)

    // No initial fetch is attempted.
    expect(n.$ready.value).toBe(true)
    expect(n._value).toBe('fallback')

    // Mutations still work in memory.
    n('changed')
    await settle(5)
    expect(n._value).toBe('changed')
    // $saved stays true because we don't try to write.
    expect(n.$saved.value).toBe(true)
  })

  test('command mode: invoke() rejects with a clear error', async () => {
    const plugin = tauriPlugin()

    const n: any = createNu({
      realm: 'app', id: 'c.x',
      value: null,
      tauriCommand: { command: 'whatever' },
      plugins: [plugin],
    } as any)

    expect(n.$ready.value).toBe(true)

    let thrown: any = null
    try {
      await n.invoke({ foo: 1 })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeDefined()
    expect((thrown as Error).message).toContain('tauri unavailable')
    expect(n.$error.value).toContain('tauri unavailable')
  })

  test('nucl without tauri config still works (plugin is a no-op on it)', async () => {
    const plugin = tauriPlugin()

    // Plugin included but no `tauri`/`tauriCommand` options — should leave the
    // nucl untouched (no companions, no hooks).
    const n: any = createNu({
      realm: 'app', id: 'plain.x',
      value: 42,
      plugins: [plugin],
    })

    expect(n._value).toBe(42)
    expect(n.$ready).toBeUndefined()
    n(99)
    expect(n._value).toBe(99)
  })
})
