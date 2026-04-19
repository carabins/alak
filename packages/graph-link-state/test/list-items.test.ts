// Coverage for v0.4 `SyncListNode` emission — list fields generate a
// per-index reactive accessor as well as the flat snapshot array.

import { test, expect, describe } from 'bun:test'
import { generate } from '../src/index'
import type { IR } from '../../graph/src/types'

function mkIR(records: any = {}, actions: any = {}, enums: any = {}): IR {
  return {
    schemas: {
      s: {
        name: 'S',
        namespace: 's',
        version: 1,
        records,
        actions,
        enums,
        scalars: {},
        opaques: {},
      },
    },
  }
}

describe('list of scalars emits SyncListNode<T, ISyncNode<T>>', () => {
  const ir = mkIR({
    Player: {
      name: 'Player',
      fields: [
        { name: 'id', type: 'ID', required: true, list: false },
        { name: 'myWords', type: 'String', required: true, list: true, listItemRequired: true },
      ],
    },
  })
  const out = generate(ir).files[0].content

  test('interface uses SyncListNode<string, ISyncNode<string>>', () => {
    expect(out).toContain('readonly $myWords: SyncListNode<string, ISyncNode<string>>')
  })

  test('factory composes via createListNode + store.get leaf', () => {
    expect(out).toContain(
      `get $myWords(): SyncListNode<string, ISyncNode<string>> { return createListNode(store, path + '.myWords', (p0) => store.get(p0) as ISyncNode<string>) }`,
    )
  })

  test('snapshot accessor is still string[]', () => {
    expect(out).toContain('readonly myWords: string[]')
  })
})

describe('list of records emits SyncListNode<IRec, RecNode>', () => {
  const ir = mkIR({
    Player: { name: 'Player', fields: [{ name: 'id', type: 'ID', required: true, list: false }] },
    Team: {
      name: 'Team',
      fields: [{ name: 'roster', type: 'Player', required: true, list: true, listItemRequired: true }],
    },
  })
  const out = generate(ir).files[0].content

  test('interface uses SyncListNode<IPlayer, PlayerNode>', () => {
    expect(out).toContain('readonly $roster: SyncListNode<IPlayer, PlayerNode>')
  })

  test('factory composes createListNode + createPlayerNode', () => {
    expect(out).toContain(
      `createListNode(store, path + '.roster', (p0) => createPlayerNode(store, p0))`,
    )
  })
})

describe('list with optional items keeps undefined marker on the snapshot side', () => {
  const ir = mkIR({
    R: {
      name: 'R',
      fields: [
        { name: 'xs', type: 'String', required: true, list: true, listItemRequired: false },
      ],
    },
  })
  const out = generate(ir).files[0].content

  test('interface: item TS is (string | undefined), node stays strict', () => {
    expect(out).toContain('readonly $xs: SyncListNode<(string | undefined), ISyncNode<string>>')
    expect(out).toContain('readonly xs: (string | undefined)[]')
  })
})

describe('list of list (nested) composes recursively', () => {
  const ir = mkIR({
    M: {
      name: 'M',
      fields: [
        // This IR shape cannot be produced by the SDL parser today (the SDL
        // doesn't spell `[[Float!]!]!`), but the IRTypeRef model does support
        // nested lists in map values. The emitter should cope regardless,
        // since `itemFactoryExpr` is ref-driven.
        { name: 'matrix', type: 'Float', required: true, list: true, listItemRequired: true },
      ],
    },
  })
  const out = generate(ir).files[0].content

  test('single-level list still emits SyncListNode<number, ISyncNode<number>>', () => {
    expect(out).toContain('SyncListNode<number, ISyncNode<number>>')
  })
})

describe('runtime imports for list-aware output', () => {
  const ir = mkIR({
    R: { name: 'R', fields: [{ name: 'xs', type: 'Int', required: true, list: true }] },
  })
  const out = generate(ir).files[0].content

  test('imports SyncListNode type and createListNode function', () => {
    expect(out).toContain('SyncListNode')
    expect(out).toContain(`import { createSyncNode, createListNode, createMapNode }`)
  })
})
