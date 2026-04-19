// @alaq/link-state — SyncListNode coverage.
//
// Exercises the per-index accessor built on top of an `ISyncNode<T[]>`.
// The helper is runtime-only (no codegen involvement); tests target the
// store paths directly.

import { test, expect, describe } from 'bun:test'
import { SyncStore } from '../src/store'
import { createListNode } from '../src/list-node'
import { isGhost } from '@alaq/deep-state'
import type { ISyncNode } from '../src/types'

describe('createListNode — basics', () => {
  test('exposes list length from the snapshot', () => {
    const store = new SyncStore()
    store.applyPatch('room.players', [
      { id: 'a' }, { id: 'b' }, { id: 'c' },
    ])
    const list = createListNode<any, ISyncNode<any>>(
      store,
      'room.players',
      (p) => store.get(p),
    )
    expect(list.length).toBe(3)
  })

  test('length is 0 when the path is missing or a ghost', () => {
    const store = new SyncStore({ onFetch: () => {} })
    const list = createListNode<any, ISyncNode<any>>(
      store, 'nope', (p) => store.get(p),
    )
    expect(list.length).toBe(0)
  })

  test('at(i) returns the snapshot element without creating a node', () => {
    const store = new SyncStore()
    store.applyPatch('room.players', [{ id: 'a' }, { id: 'b' }])
    const list = createListNode<any, ISyncNode<any>>(
      store, 'room.players', (p) => store.get(p),
    )
    // Deep-state proxies shadow Object.keys; compare via property access.
    expect(list.at(0)?.id).toBe('a')
    expect(list.at(1)?.id).toBe('b')
    expect(list.at(5)).toBeUndefined()
  })

  test('item(i) returns a reactive node at room.players.i', () => {
    const store = new SyncStore()
    store.applyPatch('room.players', [{ id: 'a', hp: 10 }])
    const list = createListNode<any, ISyncNode<any>>(
      store, 'room.players', (p) => store.get(p),
    )
    const p0 = list.item(0)
    expect(p0.$meta.path).toBe('room.players.0')
    const v: any = p0.value
    expect(v?.id).toBe('a')
    expect(v?.hp).toBe(10)
  })
})

describe('createListNode — reactivity', () => {
  test('updating one index does not require a full-list read to observe', () => {
    const store = new SyncStore()
    store.applyPatch('room.players', [{ id: 'a', hp: 10 }, { id: 'b', hp: 20 }])

    const list = createListNode<any, ISyncNode<any>>(
      store, 'room.players', (p) => store.get(p),
    )

    const item1 = list.item(1)
    const seen: any[] = []
    item1.up((v) => seen.push(v))

    // Initial push on subscribe is the current value.
    expect(seen.length).toBe(1)
    expect(seen[0]?.id).toBe('b')
    expect(seen[0]?.hp).toBe(20)

    // Patch only the second entry's hp. Store's _notifyPath walks subpaths,
    // so a parent-array patch should reach the child path we subscribed to.
    store.applyPatch('room.players.1.hp', 99)

    const last = seen[seen.length - 1]
    expect(last === undefined || last === 99 || (typeof last === 'object' && last.hp === 99)).toBe(true)
  })

  test('item(i) returns stable path for the same index', () => {
    const store = new SyncStore()
    store.applyPatch('xs', [1, 2, 3])
    const list = createListNode<number, ISyncNode<number>>(
      store, 'xs', (p) => store.get(p),
    )
    const a = list.item(0)
    const b = list.item(0)
    expect(a.$meta.path).toBe(b.$meta.path)
  })
})

describe('createListNode — ghost/pending', () => {
  test('item() on a missing list still produces a ghost node at the index path', () => {
    const store = new SyncStore({ onFetch: () => {} })
    const list = createListNode<any, ISyncNode<any>>(
      store, 'room.players', (p) => store.get(p),
    )
    const p0 = list.item(0)
    expect(p0.$meta.path).toBe('room.players.0')
    expect(isGhost(p0.value)).toBe(true)
  })
})

describe('createListNode — release flow', () => {
  test('calling $release on the underlying node does not throw', () => {
    const store = new SyncStore()
    store.applyPatch('xs', [1])
    const list = createListNode<number, ISyncNode<number>>(
      store, 'xs', (p) => store.get(p),
    )
    expect(() => list.$release()).not.toThrow()
  })
})
