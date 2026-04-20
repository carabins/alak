import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { idbPlugin, __resetIdbRuntime } from '../src/plugin'
import { createFakeIDB, __resetFakeIDB } from '../src/mock/fake-idb'
import { logiPlugin } from '@alaq/plugin-logi'
import { __resetRuntime as __resetLogiRuntime } from '@alaq/plugin-logi/plugin'
import { __resetTrace } from '@alaq/plugin-logi/context/trace'
import { __resetReload } from '@alaq/plugin-logi/release'
import type { LogiFrame, LogiTransport } from '@alaq/plugin-logi/types'

async function settle(ms = 150): Promise<void> {
  await new Promise(r => setTimeout(r, ms))
}

function collector(): { frames: LogiFrame[]; transport: LogiTransport } {
  const frames: LogiFrame[] = []
  const transport: LogiTransport = { send(f) { frames.push(f) } }
  return { frames, transport }
}

beforeEach(() => {
  __resetIdbRuntime()
  __resetFakeIDB()
  __resetLogiRuntime()
  __resetTrace()
  __resetReload()
})

describe('plugin-idb + plugin-logi integration', () => {
  test('single-value lifecycle emits logi frames when plugin-logi runtime is active', async () => {
    const { frames, transport } = collector()
    logiPlugin({ transport, version: '0.0.1', build: 'test' })

    const factory = createFakeIDB()
    const idb = idbPlugin({ factory, debounceMs: 20 })

    const settings: any = createNu({
      realm: 'app', id: 'user.settings',
      value: { theme: 'dark' },
      plugins: [idb],
    })

    // onCreate → idb:open + nucl:create from logi plugin hook is NOT present
    // (we didn't register logi as a plugin here). The idb plugin emits a
    // lifecycle frame 'idb:open' via emitFrame() → passes the logi runtime
    // gate since kinds includes 'lifecycle'.
    await settle(60)

    const idbOpen = frames.find(f => f.message === 'idb:open')
    expect(idbOpen).toBeDefined()
    expect(idbOpen!.fingerprint).toBe('app.user.settings')
    expect(idbOpen!.kind).toBe('lifecycle')

    // After rehydrate — a miss frame.
    const miss = frames.find(f => f.message === 'idb:get:miss')
    expect(miss).toBeDefined()
    expect(miss!.duration_ms).toBeGreaterThanOrEqual(0)

    // Trigger a write — begin + end frames.
    settings({ theme: 'light' })
    await settle(60)

    const putBegin = frames.find(f => f.message === 'idb:put:begin')
    const putEnd   = frames.find(f => f.message === 'idb:put:end')
    expect(putBegin).toBeDefined()
    expect(putEnd).toBeDefined()
    expect(putEnd!.duration_ms).toBeGreaterThanOrEqual(0)
  })

  test('rehydrate of existing value emits idb:get:hit with duration', async () => {
    const { frames, transport } = collector()
    logiPlugin({ transport, version: '0.0.1', build: 'test' })

    const factory = createFakeIDB()

    // Seed.
    {
      const idb = idbPlugin({ factory, debounceMs: 20 })
      const s: any = createNu({
        realm: 'app', id: 'user.settings',
        value: 0, plugins: [idb],
      })
      await settle(40)
      s(42)
      await settle(60)
      expect(s.$saved.value).toBe(true)
    }

    // Second session: should emit idb:get:hit.
    __resetIdbRuntime()
    frames.length = 0
    const idb2 = idbPlugin({ factory, debounceMs: 20 })
    const s2: any = createNu({
      realm: 'app', id: 'user.settings',
      value: 0, plugins: [idb2],
    })
    await settle(60)

    const hit = frames.find(f => f.message === 'idb:get:hit')
    expect(hit).toBeDefined()
    expect(hit!.fingerprint).toBe('app.user.settings')
    expect(s2._value).toBe(42)
  })

  test('collection insert emits put:begin/end with op_count', async () => {
    const { frames, transport } = collector()
    logiPlugin({ transport, version: '0.0.1', build: 'test' })

    const factory = createFakeIDB()
    const idb = idbPlugin({ factory, debounceMs: 20 })

    const todos: any = createNu({
      realm: 'app', id: 'app.todos',
      value: [],
      collection: { primaryKey: 'id' },
      plugins: [idb],
    } as any)

    await settle(40)
    frames.length = 0

    todos.insert({ id: '1', title: 'a', done: false })
    todos.insert({ id: '2', title: 'b', done: true })
    await settle(60)

    const begin = frames.find(f => f.message === 'idb:put:begin')
    const end   = frames.find(f => f.message === 'idb:put:end')
    expect(begin).toBeDefined()
    expect(end).toBeDefined()
    expect(end!.extra?.['numeric.op_count']).toBe('2')
  })

  test('when no logi runtime is registered, plugin still works (noop emitFrame)', async () => {
    // Notice — we do NOT call logiPlugin(). The idb plugin should still work.
    const factory = createFakeIDB()
    const idb = idbPlugin({ factory, debounceMs: 20 })

    const n: any = createNu({
      realm: 'app', id: 'u.s',
      value: 1, plugins: [idb],
    })
    await settle(40)
    n(2)
    await settle(60)
    expect(n._value).toBe(2)
    expect(n.$saved.value).toBe(true)
  })
})
