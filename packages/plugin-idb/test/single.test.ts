import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { idbPlugin, __resetIdbRuntime } from '../src/plugin'
import { createFakeIDB, __resetFakeIDB } from '../src/mock/fake-idb'
import '../src/presets/idb'

/** Wait for async rehydrate + any debounced flushes. */
async function settle(ms = 150): Promise<void> {
  await new Promise(r => setTimeout(r, ms))
}

beforeEach(() => {
  __resetIdbRuntime()
  __resetFakeIDB()
})

describe('idbPlugin — single-value mode', () => {
  test('creates with default value and $ready flips to true after rehydrate', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const settings: any = createNu({
      realm: 'app',
      id: 'user.settings',
      value: { theme: 'dark' },
      plugins: [plugin],
    })

    expect(settings.$ready).toBeDefined()
    expect(settings.$saved).toBeDefined()
    expect(settings.$ready.value).toBe(false)
    expect(settings._value).toEqual({ theme: 'dark' })

    await settle(40)
    expect(settings.$ready.value).toBe(true)
    // Value unchanged (no stored row yet).
    expect(settings._value).toEqual({ theme: 'dark' })
  })

  test('$saved goes false during debounce, then true after flush', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const settings: any = createNu({
      realm: 'app',
      id: 'user.settings',
      value: { theme: 'dark' },
      plugins: [plugin],
    })

    await settle(40)
    expect(settings.$ready.value).toBe(true)
    expect(settings.$saved.value).toBe(true)

    settings({ theme: 'light' })
    expect(settings._value).toEqual({ theme: 'light' })   // optimistic
    expect(settings.$saved.value).toBe(false)             // pending

    await settle(60)
    expect(settings.$saved.value).toBe(true)              // flushed
  })

  test('rehydrates existing value across a fresh nucl in the same process', async () => {
    const factory = createFakeIDB()

    // First "session": write a value.
    {
      const plugin = idbPlugin({ factory, debounceMs: 20 })
      const s: any = createNu({
        realm: 'app', id: 'user.settings',
        value: { theme: 'dark' }, plugins: [plugin],
      })
      await settle(40)
      s({ theme: 'solarized' })
      await settle(60)
      expect(s.$saved.value).toBe(true)
    }

    // Second "session": reset runtime (drops DB cache) but keep fake DB data.
    __resetIdbRuntime()
    const plugin2 = idbPlugin({ factory, debounceMs: 20 })
    const s2: any = createNu({
      realm: 'app', id: 'user.settings',
      value: { theme: 'default' }, plugins: [plugin2],
    })

    // Before rehydrate — default.
    expect(s2._value).toEqual({ theme: 'default' })

    // Collect ready change.
    await settle(50)
    expect(s2.$ready.value).toBe(true)
    expect(s2._value).toEqual({ theme: 'solarized' })
  })

  test('debounced rapid writes produce a single flush', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 30 })

    const counter: any = createNu({
      realm: 'app', id: 'counter.count',
      value: 0, plugins: [plugin],
    })
    await settle(40)

    let savedTransitions = 0
    counter.$saved.up((v: boolean) => { if (v === false) savedTransitions += 1 })
    // .up fires immediately with current value; transitions counted only for false.
    // Initial (true) → no count.
    savedTransitions = 0

    counter(1)
    counter(2)
    counter(3)
    counter(4)
    counter(5)

    // We only saw one transition to false (first write) because subsequent
    // writes happen while already false.
    expect(savedTransitions).toBe(1)

    await settle(80)
    expect(counter.$saved.value).toBe(true)
    expect(counter._value).toBe(5)
  })

  test('default value used when no stored entry exists (miss)', async () => {
    const factory = createFakeIDB()
    const plugin = idbPlugin({ factory, debounceMs: 20 })

    const n: any = createNu({
      realm: 'app', id: 'nothing.here',
      value: 42, plugins: [plugin],
    })
    await settle(40)
    expect(n.$ready.value).toBe(true)
    expect(n._value).toBe(42)
  })

  test('no IDB factory available — degrades gracefully, $ready still flips', async () => {
    // Don't inject a factory. Default runtime picks up globalThis.indexedDB which is undefined in Bun.
    const plugin = idbPlugin({ debounceMs: 20 })

    const n: any = createNu({
      realm: 'app', id: 'fallback.x',
      value: 'hello', plugins: [plugin],
    })
    await settle(30)
    expect(n.$ready.value).toBe(true)
    // Mutations still work in memory.
    n('world')
    await settle(30)
    expect(n._value).toBe('world')
  })

  test('kind: "idb" preset wires the plugin without explicit plugins: []', async () => {
    const factory = createFakeIDB()
    // Configure the preset's plugin by calling idbPlugin(...) — runtime is global.
    idbPlugin({ factory, debounceMs: 20 })

    const n: any = createNu({
      kind: 'idb' as any,
      realm: 'app', id: 'pref.via.kind',
      value: 'initial',
    })

    expect(n.$ready).toBeDefined()
    await settle(40)
    expect(n.$ready.value).toBe(true)

    n('changed')
    await settle(60)
    expect(n.$saved.value).toBe(true)
  })
})
