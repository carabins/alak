// Coverage for v0.4 `SyncMapNode` emission — map fields generate a
// per-key reactive accessor, with nested maps composed via recursive
// factory emission.

import { test, expect, describe } from 'bun:test'
import { generate } from '../src/index'
import type { IR } from '../../graph/src/types'

function mkIR(records: any = {}): IR {
  return {
    schemas: {
      s: {
        name: 'S',
        namespace: 's',
        version: 1,
        records,
        actions: {},
        enums: {},
        scalars: {},
        opaques: {},
      },
    },
  }
}

describe('map of scalars', () => {
  const ir = mkIR({
    R: {
      name: 'R',
      fields: [{
        name: 'scores', type: 'Map', required: true, list: false, map: true,
        mapKey: { type: 'ID', required: true, list: false },
        mapValue: { type: 'Int', required: true, list: false },
      }],
    },
  })
  const out = generate(ir).files[0].content

  test('interface uses SyncMapNode<string, number, ISyncNode<number>>', () => {
    expect(out).toContain(
      'readonly $scores: SyncMapNode<string, number, ISyncNode<number>>',
    )
  })

  test('factory composes createMapNode + store.get at leaf', () => {
    expect(out).toContain(
      `createMapNode(store, path + '.scores', (p0) => store.get(p0) as ISyncNode<number>)`,
    )
  })

  test('snapshot stays Record<string, number>', () => {
    expect(out).toContain('readonly scores: Record<string, number>')
  })
})

describe('map of records', () => {
  const ir = mkIR({
    Player: { name: 'Player', fields: [{ name: 'id', type: 'ID', required: true, list: false }] },
    R: {
      name: 'R',
      fields: [{
        name: 'byId', type: 'Map', required: true, list: false, map: true,
        mapKey: { type: 'ID', required: true, list: false },
        mapValue: { type: 'Player', required: true, list: false },
      }],
    },
  })
  const out = generate(ir).files[0].content

  test('interface uses SyncMapNode<string, IPlayer, PlayerNode>', () => {
    expect(out).toContain('readonly $byId: SyncMapNode<string, IPlayer, PlayerNode>')
  })

  test('factory composes createMapNode + createPlayerNode', () => {
    expect(out).toContain(
      `createMapNode(store, path + '.byId', (p0) => createPlayerNode(store, p0))`,
    )
  })
})

describe('map of map (nested)', () => {
  const ir = mkIR({
    R: {
      name: 'R',
      fields: [{
        name: 'roundVotes', type: 'Map', required: true, list: false, map: true,
        mapKey: { type: 'ID', required: true, list: false },
        mapValue: {
          type: 'Map', required: true, list: false, map: true,
          mapKey: { type: 'ID', required: true, list: false },
          mapValue: { type: 'String', required: true, list: false },
        },
      }],
    },
  })
  const out = generate(ir).files[0].content

  test('interface nests SyncMapNode inside SyncMapNode', () => {
    expect(out).toContain(
      'readonly $roundVotes: SyncMapNode<string, Record<string, string>, SyncMapNode<string, string, ISyncNode<string>>>',
    )
  })

  test('factory chains two createMapNode calls with unique params', () => {
    expect(out).toContain(
      `createMapNode(store, path + '.roundVotes', (p0) => createMapNode(store, p0, (p1) => store.get(p1) as ISyncNode<string>))`,
    )
  })

  test('snapshot stays Record<string, Record<string, string>>', () => {
    expect(out).toContain(
      'readonly roundVotes: Record<string, Record<string, string>>',
    )
  })
})

describe('map of list', () => {
  const ir = mkIR({
    Player: { name: 'Player', fields: [{ name: 'id', type: 'ID', required: true, list: false }] },
    R: {
      name: 'R',
      fields: [{
        name: 'rosters', type: 'Map', required: true, list: false, map: true,
        mapKey: { type: 'ID', required: true, list: false },
        mapValue: {
          type: 'Player', required: true, list: true, listItemRequired: true,
        },
      }],
    },
  })
  const out = generate(ir).files[0].content

  test('nested node type: SyncMapNode<K, IPlayer[], SyncListNode<IPlayer, PlayerNode>>', () => {
    expect(out).toContain(
      'readonly $rosters: SyncMapNode<string, IPlayer[], SyncListNode<IPlayer, PlayerNode>>',
    )
  })

  test('factory: createMapNode → createListNode → createPlayerNode leaf', () => {
    expect(out).toContain(
      `createMapNode(store, path + '.rosters', (p0) => createListNode(store, p0, (p1) => createPlayerNode(store, p1)))`,
    )
  })
})

describe('numeric-keyed map', () => {
  const ir = mkIR({
    R: {
      name: 'R',
      fields: [{
        name: 'byCount', type: 'Map', required: true, list: false, map: true,
        mapKey: { type: 'Int', required: true, list: false },
        mapValue: { type: 'String', required: true, list: false },
      }],
    },
  })
  const out = generate(ir).files[0].content

  test('key type maps to number', () => {
    expect(out).toContain(
      'readonly $byCount: SyncMapNode<number, string, ISyncNode<string>>',
    )
  })
})
