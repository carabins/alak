import { test, expect, mock } from 'bun:test'
import { SyncStore } from '../src/store'
import { isGhost } from '@alaq/deep-state'

// ─── Minimal LinkHub mock ─────────────────────────────────────────────
function mockHub() {
  const handlers = new Map<string, Set<Function>>()
  return {
    peerId: 'test-peer',
    sent: [] as Array<{ channel: string; data: any }>,
    send(channel: string, data: any, _qos?: string) {
      this.sent.push({ channel, data })
    },
    on(channel: string, handler: (data: any, peerId: string) => void) {
      let set = handlers.get(channel)
      if (!set) handlers.set(channel, (set = new Set()))
      set.add(handler)
      return () => set!.delete(handler)
    },
    emit(channel: string, data: any, peerId = 'remote') {
      handlers.get(channel)?.forEach(h => h(data, peerId))
    },
  }
}

// ─── Reproduce bug: bridge.watch on unseeded path ─────────────────────

test('Ghost loop: bridge.watch on missing path does not trigger infinite onFetch', async () => {
  // Lazy import to avoid cross-package resolution issues if any
  const { SyncBridge } = await import('@alaq/link')

  let fetchCount = 0
  const store = new SyncStore({
    onFetch: (_path: string) => {
      fetchCount++
      // Do nothing — simulate server not responding yet.
    },
  })

  const hub = mockHub()
  const bridge = new SyncBridge({
    hub: hub as any,
    schema: { 'room.players': { type: 'lww' } },
    store,
  })

  // This call should NOT loop. Before fix: ghost value pushed into CRDT
  // triggers listener re-entry / crdt broadcast / nested ghost-proxy access.
  bridge.watch('room.players')

  // Give any async microtasks a chance to settle.
  await new Promise(resolve => setTimeout(resolve, 10))

  // Before fix: onFetch may be called once synchronously, but a ghost value
  // being pushed into CRDT can produce a cascade via store listeners
  // re-reading _resolvePath (which creates more ghosts). We expect at most
  // a single fetch trigger for the watched path.
  expect(fetchCount).toBeLessThan(5)

  // No CRDT broadcast should happen for ghost values — ghosts are not data.
  const crdtBroadcasts = hub.sent.filter(m => m.channel === 'crdt')
  expect(crdtBroadcasts.length).toBe(0)

  bridge.destroy()
})

// ─── Data arrival: listener gets real value after applyPatch ──────────

test('Ghost loop: applyPatch delivers real value to watcher', async () => {
  const received: any[] = []
  const store = new SyncStore({
    onFetch: () => {},
  })

  // Use a direct _subscribePath instead of bridge.watch to verify raw behavior
  store._subscribePath('room.players', (v: any) => received.push(v))

  store.applyPatch('room.players', { a: { id: 'a' }, b: { id: 'b' } })

  // At least one real (non-ghost) value must have been delivered.
  const realValues = received.filter(v => !isGhost(v))
  expect(realValues.length).toBeGreaterThan(0)
  expect(realValues[realValues.length - 1]).toMatchObject({
    a: { id: 'a' },
    b: { id: 'b' },
  })
})

// ─── SyncNode status transitions ──────────────────────────────────────

test('Ghost loop: node.$status transitions pending -> ready', () => {
  const store = new SyncStore()
  const node = store.get('room.players')

  expect(node.$status.value).toBe('pending')

  store.applyPatch('room.players', { a: { id: 'a' } })

  // After the patch, reading value should pick up the real object
  expect(isGhost(node.value)).toBe(false)
  expect(node.$status.value).toBe('ready')
})

// ─── Multiple subscribers converge on real value after applyPatch ────

test('Ghost loop: multiple subscribers on same path get real value after applyPatch', () => {
  const store = new SyncStore({ onFetch: () => {} })

  const a: any[] = []
  const b: any[] = []
  store._subscribePath('room.players', (v: any) => a.push(v))
  store._subscribePath('room.players', (v: any) => b.push(v))

  // Each subscriber may receive an initial ghost (that's store semantics —
  // node.$status uses it). What matters is: ghosts don't multiply and
  // both subscribers see the real value after applyPatch.
  const aGhostsBefore = a.filter(v => isGhost(v)).length
  const bGhostsBefore = b.filter(v => isGhost(v)).length
  expect(aGhostsBefore).toBeLessThanOrEqual(1)
  expect(bGhostsBefore).toBeLessThanOrEqual(1)

  store.applyPatch('room.players', { x: 1 })

  // Both saw the real value.
  expect(a.filter(v => !isGhost(v)).length).toBeGreaterThan(0)
  expect(b.filter(v => !isGhost(v)).length).toBeGreaterThan(0)
  expect(a[a.length - 1]).toEqual({ x: 1 })
  expect(b[b.length - 1]).toEqual({ x: 1 })

  // Ghosts don't explode — a bounded number per subscriber.
  expect(a.filter(v => isGhost(v)).length).toBeLessThan(5)
  expect(b.filter(v => isGhost(v)).length).toBeLessThan(5)
})

// ─── Already-present data: subscribe pushes real value immediately ────

test('Ghost loop: subscribing to already-present path pushes real value', () => {
  const store = new SyncStore()
  store.applyPatch('me', { id: '1', hp: 100 })

  const received: any[] = []
  store._subscribePath('me', (v: any) => received.push(v))

  expect(received.length).toBe(1)
  expect(isGhost(received[0])).toBe(false)
  expect(received[0]).toMatchObject({ id: '1', hp: 100 })
})

// ─── Bridge full loop: watch, then apply remote patch ─────────────────

test('Ghost loop: bridge watch + remote patch delivers real value, no loop', async () => {
  const { SyncBridge } = await import('@alaq/link')

  let fetchCount = 0
  const store = new SyncStore({ onFetch: () => { fetchCount++ } })
  const hub = mockHub()
  const bridge = new SyncBridge({
    hub: hub as any,
    schema: { 'room.counter': { type: 'lww' } },
    store,
  })

  bridge.watch('room.counter')
  await new Promise(r => setTimeout(r, 5))
  const fetchesAfterWatch = fetchCount

  // Now simulate the server delivering data.
  store.applyPatch('room.counter', 42)
  await new Promise(r => setTimeout(r, 5))

  // Node sees the real value.
  const node = store.get('room.counter')
  expect(node.value).toBe(42)
  expect(node.$status.value).toBe('ready')

  // No runaway fetching after data arrives.
  expect(fetchCount - fetchesAfterWatch).toBeLessThan(3)

  bridge.destroy()
})
