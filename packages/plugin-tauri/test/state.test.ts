import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { tauriPlugin, __resetTauriRuntime } from '../src/plugin'
import { createFakeIPC } from '../src/mock/fake-ipc'
import '../src/presets/tauri'

async function settle(ms = 20): Promise<void> {
  await new Promise(r => setTimeout(r, ms))
}

beforeEach(() => {
  __resetTauriRuntime()
})

describe('tauriPlugin — kind: tauri (state mode)', () => {
  test('initial read populates value, $ready flips to true', async () => {
    const ipc = createFakeIPC({
      invoke: { get_device_id: () => 'dev-007' },
    })
    const plugin = tauriPlugin({ ipc })

    const deviceId: any = createNu({
      realm: 'app', id: 'sys.deviceId',
      value: null,
      tauri: { read: 'get_device_id' },
      plugins: [plugin],
    } as any)

    expect(deviceId.$ready).toBeDefined()
    expect(deviceId.$saved).toBeDefined()
    expect(deviceId.$error).toBeDefined()
    expect(deviceId.$ready.value).toBe(false)
    expect(deviceId._value).toBe(null)

    await settle(20)
    expect(deviceId.$ready.value).toBe(true)
    expect(deviceId._value).toBe('dev-007')
    expect(deviceId.$error.value).toBe(null)
  })

  test('read error → $error set, $ready still flips to true', async () => {
    const ipc = createFakeIPC({
      invoke: {
        get_broken: () => { throw new Error('backend exploded') },
      },
    })
    const plugin = tauriPlugin({ ipc })

    const broken: any = createNu({
      realm: 'app', id: 'x.y',
      value: 'default',
      tauri: { read: 'get_broken' },
      plugins: [plugin],
    } as any)

    await settle(20)
    expect(broken.$ready.value).toBe(true)
    expect(broken.$error.value).toContain('backend exploded')
    // _value left as default.
    expect(broken._value).toBe('default')
  })

  test('push update via listen event updates value', async () => {
    const ipc = createFakeIPC({
      invoke: { get_counter: () => 0 },
    })
    const plugin = tauriPlugin({ ipc })

    const counter: any = createNu({
      realm: 'app', id: 'ctr.count',
      value: -1,
      tauri: { read: 'get_counter', listen: 'counter:changed' },
      plugins: [plugin],
    } as any)

    await settle(20)
    expect(counter._value).toBe(0)

    ipc.emit('counter:changed', 42)
    expect(counter._value).toBe(42)

    ipc.emit('counter:changed', 99)
    expect(counter._value).toBe(99)
  })

  test('write mode: $saved goes false during invoke, true after', async () => {
    let lastWritten: any
    let resolveWrite: ((v: any) => void) | null = null
    const ipc = createFakeIPC({
      invoke: {
        get_setting: () => 'initial',
        set_setting: (args?: any) => {
          lastWritten = args?.value
          return new Promise(r => { resolveWrite = r })
        },
      },
    })
    const plugin = tauriPlugin({ ipc })

    const setting: any = createNu({
      realm: 'app', id: 'ui.setting',
      value: '',
      tauri: { read: 'get_setting', write: 'set_setting' },
      plugins: [plugin],
    } as any)

    await settle(20)
    expect(setting._value).toBe('initial')
    expect(setting.$saved.value).toBe(true)

    setting('changed')
    // Optimistic — in-memory immediately.
    expect(setting._value).toBe('changed')
    // Pending write.
    await settle(5)
    expect(setting.$saved.value).toBe(false)
    expect(lastWritten).toBe('changed')

    // Let the Rust call complete.
    resolveWrite!(undefined)
    await settle(10)
    expect(setting.$saved.value).toBe(true)
    expect(setting.$error.value).toBe(null)
  })

  test('write error → $error set, $saved stays false', async () => {
    const ipc = createFakeIPC({
      invoke: {
        get_thing: () => 0,
        save_thing: () => { throw new Error('disk full') },
      },
    })
    const plugin = tauriPlugin({ ipc })

    const thing: any = createNu({
      realm: 'app', id: 't.thing',
      value: 0,
      tauri: { read: 'get_thing', write: 'save_thing' },
      plugins: [plugin],
    } as any)

    await settle(20)
    expect(thing.$saved.value).toBe(true)

    thing(1)
    await settle(20)
    expect(thing.$saved.value).toBe(false)
    expect(thing.$error.value).toContain('disk full')
  })

  test('read-only mode (no write) — mutations do not invoke anything', async () => {
    let invokeCount = 0
    const ipc = createFakeIPC({
      invoke: {
        get_ro: () => {
          invokeCount++
          return 'value'
        },
      },
    })
    const plugin = tauriPlugin({ ipc })

    const ro: any = createNu({
      realm: 'app', id: 'ro.x',
      value: null,
      tauri: { read: 'get_ro' },   // no write
      plugins: [plugin],
    } as any)

    await settle(20)
    expect(invokeCount).toBe(1)

    // Mutation in memory — must not fire any invoke.
    ro('local-only')
    await settle(20)
    expect(invokeCount).toBe(1) // unchanged
    expect(ro._value).toBe('local-only')
  })
})
