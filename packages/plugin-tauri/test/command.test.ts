import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { tauriPlugin, __resetTauriRuntime } from '../src/plugin'
import { createFakeIPC } from '../src/mock/fake-ipc'
import '../src/presets/tauri-command'

async function settle(ms = 20): Promise<void> {
  await new Promise(r => setTimeout(r, ms))
}

beforeEach(() => {
  __resetTauriRuntime()
})

describe('tauriPlugin — kind: tauri-command', () => {
  test('$ready is true immediately (no initial fetch)', async () => {
    const ipc = createFakeIPC({})
    const plugin = tauriPlugin({ ipc })

    const n: any = createNu({
      realm: 'geo', id: 'calc.distance',
      value: null,
      tauriCommand: { command: 'calc_distance' },
      plugins: [plugin],
    } as any)

    // Command mode doesn't have an initial read — ready now.
    expect(n.$ready.value).toBe(true)
    expect(n._value).toBe(null)
  })

  test('invoke() calls Rust, sets value to result, $saved toggles', async () => {
    const ipc = createFakeIPC({
      invoke: {
        calc_distance: (args: any) => {
          return Math.abs((args?.lat2 ?? 0) - (args?.lat1 ?? 0))
        },
      },
    })
    const plugin = tauriPlugin({ ipc })

    const n: any = createNu({
      realm: 'geo', id: 'calc.distance',
      value: null,
      tauriCommand: { command: 'calc_distance' },
      plugins: [plugin],
    } as any)

    const p = n.invoke({ lat1: 10, lat2: 13 })
    // Right after synchronous invoke trigger, $saved should have flipped.
    expect(n.$saved.value).toBe(false)

    const result = await p
    expect(result).toBe(3)
    expect(n._value).toBe(3)
    expect(n.$saved.value).toBe(true)
    expect(n.$error.value).toBe(null)
  })

  test('invoke() error rejects and sets $error', async () => {
    const ipc = createFakeIPC({
      invoke: {
        bad_cmd: () => { throw new Error('nope') },
      },
    })
    const plugin = tauriPlugin({ ipc })

    const n: any = createNu({
      realm: 'x', id: 'a.b',
      value: null,
      tauriCommand: { command: 'bad_cmd' },
      plugins: [plugin],
    } as any)

    let thrown: any = null
    try {
      await n.invoke({})
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeDefined()
    expect((thrown as Error).message).toBe('nope')
    expect(n.$error.value).toContain('nope')
    expect(n.$saved.value).toBe(false)
  })

  test('multiple sequential invokes overwrite the value', async () => {
    let n = 0
    const ipc = createFakeIPC({
      invoke: { ping: () => ++n },
    })
    const plugin = tauriPlugin({ ipc })

    const nuc: any = createNu({
      realm: 'x', id: 'p.ping',
      value: null,
      tauriCommand: { command: 'ping' },
      plugins: [plugin],
    } as any)

    await nuc.invoke()
    expect(nuc._value).toBe(1)
    await nuc.invoke()
    expect(nuc._value).toBe(2)
    await nuc.invoke()
    expect(nuc._value).toBe(3)
    expect(nuc.$saved.value).toBe(true)
  })
})
