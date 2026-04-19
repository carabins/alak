// @alaq/link-state — SyncMapNode coverage.
//
// Map values live at `${mapPath}.${key}`. The helper produces per-entry
// nodes via a caller-supplied valueFactory, so nesting (Map<K, Map<K2, V>>)
// is just two createMapNode calls.

import { test, expect, describe } from 'bun:test'
import { SyncStore } from '../src/store'
import { createMapNode } from '../src/map-node'
import type { ISyncNode } from '../src/types'

describe('createMapNode — basics', () => {
  test('peek/keys/entries reflect the snapshot', () => {
    const store = new SyncStore()
    store.applyPatch('room.scores', { a: 10, b: 20, c: 30 })

    const m = createMapNode<string, number, ISyncNode<number>>(
      store, 'room.scores', (p) => store.get(p),
    )

    expect(m.peek('a')).toBe(10)
    expect(m.peek('missing')).toBeUndefined()
    expect(m.keys().sort()).toEqual(['a', 'b', 'c'])
    expect(m.entries().sort((x, y) => x[0].localeCompare(y[0]))).toEqual([
      ['a', 10], ['b', 20], ['c', 30],
    ])
  })

  test('empty map snapshot → empty keys/entries', () => {
    const store = new SyncStore({ onFetch: () => {} })
    const m = createMapNode<string, number, ISyncNode<number>>(
      store, 'nope', (p) => store.get(p),
    )
    expect(m.keys()).toEqual([])
    expect(m.entries()).toEqual([])
    expect(m.peek('x')).toBeUndefined()
  })

  test('get(key) returns a reactive node at the entry path', () => {
    const store = new SyncStore()
    store.applyPatch('room.scores', { a: 10, b: 20 })

    const m = createMapNode<string, number, ISyncNode<number>>(
      store, 'room.scores', (p) => store.get(p),
    )
    const a = m.get('a')
    expect(a.$meta.path).toBe('room.scores.a')
    expect(a.value).toBe(10)
  })
})

describe('createMapNode — reactivity on entry updates', () => {
  test('subscribing to a single entry fires on an entry-specific patch', () => {
    const store = new SyncStore()
    store.applyPatch('room.scores', { a: 10, b: 20 })

    const m = createMapNode<string, number, ISyncNode<number>>(
      store, 'room.scores', (p) => store.get(p),
    )
    const aNode = m.get('a')

    const seen: any[] = []
    aNode.up(v => seen.push(v))
    expect(seen[0]).toBe(10)

    store.applyPatch('room.scores.a', 42)
    expect(seen[seen.length - 1]).toBe(42)
  })
})

describe('createMapNode — nested maps', () => {
  test('Map<K, Map<K2, V>> composes via two createMapNode calls', () => {
    const store = new SyncStore()
    store.applyPatch('room.roundVotes', {
      r1: { p1: 'UP', p2: 'DOWN' },
      r2: { p1: 'UP' },
    })

    const outer = createMapNode<string, Record<string, string>, any>(
      store, 'room.roundVotes',
      (innerPath) => createMapNode<string, string, ISyncNode<string>>(
        store, innerPath, (p) => store.get(p),
      ),
    )

    expect(outer.keys().sort()).toEqual(['r1', 'r2'])
    const r1 = outer.get('r1')
    expect(r1.peek('p1')).toBe('UP')
    expect(r1.keys().sort()).toEqual(['p1', 'p2'])

    // Drill all the way to a per-entry scalar.
    const p1 = r1.get('p1')
    expect(p1.$meta.path).toBe('room.roundVotes.r1.p1')
    expect(p1.value).toBe('UP')
  })
})

describe('createMapNode — numeric keys', () => {
  test('numeric keys stringify cleanly into the path', () => {
    const store = new SyncStore()
    store.applyPatch('m', { '1': 'a', '2': 'b' })

    const m = createMapNode<number, string, ISyncNode<string>>(
      store, 'm', (p) => store.get(p),
    )
    const one = m.get(1)
    expect(one.$meta.path).toBe('m.1')
    expect(one.value).toBe('a')
  })
})

describe('createMapNode — release flow', () => {
  test('$release on the underlying node does not throw', () => {
    const store = new SyncStore()
    store.applyPatch('m', { a: 1 })
    const m = createMapNode<string, number, ISyncNode<number>>(
      store, 'm', (p) => store.get(p),
    )
    expect(() => m.$release()).not.toThrow()
  })
})
