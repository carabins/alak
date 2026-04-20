import { describe, expect, test, beforeEach } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { logiPlugin, __resetRuntime } from '../src/plugin'
import { traceAction } from '../src/action'
import { __resetTrace } from '../src/context/trace'
import { __resetReload } from '../src/release'
import type { LogiFrame, LogiTransport } from '../src/types'

function collector(): { frames: LogiFrame[]; transport: LogiTransport } {
  const frames: LogiFrame[] = []
  const transport: LogiTransport = { send(f) { frames.push(f) } }
  return { frames, transport }
}

beforeEach(() => {
  __resetRuntime()
  __resetTrace()
  __resetReload()
})

describe('logiPlugin', () => {
  test('emits lifecycle frame on create', () => {
    const { frames, transport } = collector()
    const plugin = logiPlugin({ transport, version: '1.0.0', build: 'test' })

    createNu({ realm: 'app', id: 'counter.count', value: 0, plugins: [plugin] })

    const lifecycle = frames.find(f => f.kind === 'lifecycle' && f.message === 'nucl:create')
    expect(lifecycle).toBeDefined()
    expect(lifecycle!.realm).toBe('app')
    expect(lifecycle!.atom).toBe('counter')
    expect(lifecycle!.prop).toBe('count')
    expect(lifecycle!.fingerprint).toBe('app.counter.count')
    expect(lifecycle!.release).toContain('1.0.0+test.r')
  })

  test('emits change frame on mutation with shape (no values by default)', () => {
    const { frames, transport } = collector()
    const plugin = logiPlugin({ transport, version: '1.0.0', build: 'test' })

    const count = createNu({ realm: 'app', id: 'counter.count', value: 0, plugins: [plugin] })
    frames.length = 0
    count(42)

    const change = frames.find(f => f.kind === 'change')
    expect(change).toBeDefined()
    expect(change!.prev_shape).toEqual({ t: 'primitive', kind: 'number' })
    expect(change!.next_shape).toEqual({ t: 'primitive', kind: 'number' })
    expect(change!.prev_value).toBeUndefined()
    expect(change!.next_value).toBeUndefined()
  })

  test('debugValues:true captures raw prev/next', () => {
    const { frames, transport } = collector()
    const plugin = logiPlugin({ transport, version: '1.0.0', build: 'test', debugValues: true })

    const name = createNu({ realm: 'app', id: 'user.name', value: 'Neo', plugins: [plugin] })
    frames.length = 0
    name('Trinity')

    const change = frames.find(f => f.kind === 'change')
    expect(change!.prev_value).toBe('Neo')
    expect(change!.next_value).toBe('Trinity')
  })

  test('traceAction groups child mutations into one trace_id', () => {
    const { frames, transport } = collector()
    const plugin = logiPlugin({ transport, version: '1.0.0', build: 'test' })

    const count = createNu({ realm: 'app', id: 'counter.count', value: 0, plugins: [plugin] })
    const step  = createNu({ realm: 'app', id: 'counter.step',  value: 1, plugins: [plugin] })

    const increment = traceAction('app', 'counter', 'increment', () => {
      count((count as any)._value + (step as any)._value)
    })

    frames.length = 0
    increment()

    const actionBegin = frames.find(f => f.kind === 'action' && f.phase === 'begin')
    const actionEnd   = frames.find(f => f.kind === 'action' && f.phase === 'end')
    const change      = frames.find(f => f.kind === 'change')

    expect(actionBegin).toBeDefined()
    expect(actionEnd).toBeDefined()
    expect(change).toBeDefined()

    // All three share the same trace_id.
    expect(change!.trace_id).toBe(actionBegin!.trace_id)
    expect(actionEnd!.trace_id).toBe(actionBegin!.trace_id)

    // Child mutation's parent_span is the action's span_id.
    expect(change!.parent_span).toBe(actionBegin!.span_id)

    // End frame has duration.
    expect(actionEnd!.duration_ms).toBeGreaterThanOrEqual(0)
  })

  test('traceAction emits error frame when action throws', () => {
    const { frames, transport } = collector()
    const plugin = logiPlugin({ transport, version: '1.0.0', build: 'test' })

    const boom = traceAction('app', 'bomb', 'explode', () => {
      throw new Error('kaboom')
    })

    expect(() => boom()).toThrow('kaboom')

    const err = frames.find(f => f.kind === 'error')
    expect(err).toBeDefined()
    expect(err!.extra?.error).toContain('kaboom')
  })

  test('standalone mutation (no action) gets a single-frame trace', () => {
    const { frames, transport } = collector()
    const plugin = logiPlugin({ transport, version: '1.0.0', build: 'test' })

    const flag = createNu({ realm: 'app', id: 'feat.flag', value: false, plugins: [plugin] })
    frames.length = 0
    flag(true)

    const change = frames.find(f => f.kind === 'change')
    expect(change).toBeDefined()
    // trace_id === span_id (no parent).
    expect(change!.trace_id).toBe(change!.span_id)
    expect(change!.parent_span).toBe('')
  })

  test('release has format version+build.rN', () => {
    const { transport } = collector()
    logiPlugin({ transport, version: '2.3.4', build: 'abc123' })
    const count = createNu({ realm: 'app', id: 'x.y', value: 0 })
    // release is visible via a new frame
    const c = collector()
    const plugin2 = logiPlugin({ transport: c.transport, version: '2.3.4', build: 'abc123' })
    createNu({ realm: 'app', id: 'x.z', value: 1, plugins: [plugin2] })
    const frame = c.frames.find(f => f.kind === 'lifecycle')!
    expect(frame.release).toMatch(/^2\.3\.4\+abc123\.r\d+$/)
  })
})
