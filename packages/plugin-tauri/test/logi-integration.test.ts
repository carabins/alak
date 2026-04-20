import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { tauriPlugin, __resetTauriRuntime } from '../src/plugin'
import { createFakeIPC } from '../src/mock/fake-ipc'
import { logiPlugin } from '@alaq/plugin-logi'
import { __resetRuntime as __resetLogiRuntime } from '@alaq/plugin-logi/plugin'
import { __resetTrace } from '@alaq/plugin-logi/context/trace'
import { __resetReload } from '@alaq/plugin-logi/release'
import type { LogiFrame, LogiTransport } from '@alaq/plugin-logi/types'

async function settle(ms = 20): Promise<void> {
  await new Promise(r => setTimeout(r, ms))
}

function collector(): { frames: LogiFrame[]; transport: LogiTransport } {
  const frames: LogiFrame[] = []
  const transport: LogiTransport = { send(f) { frames.push(f) } }
  return { frames, transport }
}

beforeEach(() => {
  __resetTauriRuntime()
  __resetLogiRuntime()
  __resetTrace()
  __resetReload()
})

describe('plugin-tauri + plugin-logi integration', () => {
  test('state mode emits tauri:open + invoke:begin/end + listen frames', async () => {
    const { frames, transport } = collector()
    logiPlugin({ transport, version: '0.0.1', build: 'test' })

    const ipc = createFakeIPC({
      invoke: { get_x: () => 'hello' },
    })
    const plugin = tauriPlugin({ ipc })

    const n: any = createNu({
      realm: 'app', id: 'sys.x',
      value: null,
      tauri: { read: 'get_x', listen: 'x:changed' },
      plugins: [plugin],
    } as any)

    await settle(20)

    const open = frames.find(f => f.message === 'tauri:open')
    expect(open).toBeDefined()
    expect(open!.fingerprint).toBe('app.sys.x')
    expect(open!.kind).toBe('lifecycle')

    const begin = frames.find(f => f.message === 'tauri:invoke:begin' && f.extra?.command === 'get_x')
    const end = frames.find(f => f.message === 'tauri:invoke:end' && f.extra?.command === 'get_x')
    expect(begin).toBeDefined()
    expect(end).toBeDefined()
    expect(end!.duration_ms).toBeGreaterThanOrEqual(0)

    const attach = frames.find(f => f.message === 'tauri:listen:attach')
    expect(attach).toBeDefined()
    expect(attach!.extra?.event).toBe('x:changed')

    // Push an event — expect a listen:recv frame.
    frames.length = 0
    ipc.emit('x:changed', 'world')
    await settle(5)
    const recv = frames.find(f => f.message === 'tauri:listen:recv')
    expect(recv).toBeDefined()
    expect(recv!.extra?.event).toBe('x:changed')
    expect(n._value).toBe('world')
  })

  test('write error emits error frame', async () => {
    const { frames, transport } = collector()
    logiPlugin({ transport, version: '0.0.1', build: 'test' })

    const ipc = createFakeIPC({
      invoke: {
        get_x: () => 0,
        save_x: () => { throw new Error('boom') },
      },
    })
    const plugin = tauriPlugin({ ipc })

    const n: any = createNu({
      realm: 'app', id: 'sys.x',
      value: 0,
      tauri: { read: 'get_x', write: 'save_x' },
      plugins: [plugin],
    } as any)

    await settle(20)
    frames.length = 0
    n(5)
    await settle(20)

    const err = frames.find(f => f.kind === 'error' && f.message === 'tauri:invoke:error')
    expect(err).toBeDefined()
    expect(err!.extra?.command).toBe('save_x')
    expect(err!.extra?.error_type).toBe('tauri:invoke')
    expect(err!.extra?.error).toContain('boom')
  })

  test('tauri unavailable emits unavailable frame (no ipc, no window)', async () => {
    const { frames, transport } = collector()
    logiPlugin({ transport, version: '0.0.1', build: 'test' })

    const plugin = tauriPlugin()  // no ipc, Bun has no __TAURI_INTERNALS__

    const n: any = createNu({
      realm: 'app', id: 'sys.x',
      value: 'default',
      tauri: { read: 'get_x' },
      plugins: [plugin],
    } as any)

    await settle(10)
    const un = frames.find(f => f.message === 'tauri:unavailable')
    expect(un).toBeDefined()
    expect(un!.fingerprint).toBe('app.sys.x')
    expect(n.$ready.value).toBe(true)
    expect(n._value).toBe('default')
  })

  test('no logi runtime — plugin still works (silent emitFrame)', async () => {
    // Note: we do NOT call logiPlugin(). The tauri plugin should still work.
    const ipc = createFakeIPC({ invoke: { get_x: () => 7 } })
    const plugin = tauriPlugin({ ipc })

    const n: any = createNu({
      realm: 'app', id: 'x.y',
      value: 0,
      tauri: { read: 'get_x' },
      plugins: [plugin],
    } as any)

    await settle(20)
    expect(n._value).toBe(7)
    expect(n.$ready.value).toBe(true)
  })
})
