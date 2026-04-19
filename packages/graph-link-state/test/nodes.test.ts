// SyncNode emitter coverage. Uses minimal hand-built IR fragments to keep
// these tests independent of the SDL parser — they target the emitter
// contract only.

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

describe('simple record', () => {
  const ir = mkIR({
    Player: {
      name: 'Player',
      fields: [
        { name: 'id', type: 'ID', required: true, list: false },
        { name: 'name', type: 'String', required: true, list: false },
        { name: 'avatar', type: 'String', required: false, list: false },
      ],
    },
  })

  const out = generate(ir).files[0].content

  test('emits IPlayer interface with readonly fields', () => {
    expect(out).toContain('export interface IPlayer {')
    expect(out).toContain('readonly id: string')
    expect(out).toContain('readonly avatar?: string')
  })

  test('emits PlayerNode interface with reactive + snapshot views', () => {
    expect(out).toContain('export interface PlayerNode {')
    expect(out).toContain('readonly $id: ISyncNode<string>')
    expect(out).toContain('readonly $avatar: ISyncNode<string | undefined>')
    expect(out).toContain('readonly id: string')
    expect(out).toContain('readonly avatar: string | undefined')
  })

  test('emits createPlayerNode factory taking (store, path)', () => {
    expect(out).toContain(
      'export function createPlayerNode(store: SyncStore, path: string): PlayerNode',
    )
    expect(out).toContain(`base._node('id')`)
    expect(out).toContain(`base._get('avatar')`)
  })
})

describe('nested record', () => {
  const ir = mkIR({
    Stats: { name: 'Stats', fields: [{ name: 'score', type: 'Int', required: true, list: false }] },
    Player: {
      name: 'Player',
      fields: [
        { name: 'id', type: 'ID', required: true, list: false },
        { name: 'stats', type: 'Stats', required: true, list: false },
      ],
    },
  })

  const out = generate(ir).files[0].content

  test('nested record field types to <Name>Node', () => {
    expect(out).toContain('readonly $stats: StatsNode')
    expect(out).toContain(`createStatsNode(store, path + '.stats')`)
  })
})

describe('scoped record', () => {
  const ir = mkIR({
    GameRoom: {
      name: 'GameRoom',
      scope: 'room',
      directives: [{ name: 'scope', args: { name: 'room' } }],
      fields: [{ name: 'id', type: 'ID', required: true, list: false }],
    },
  })

  const out = generate(ir).files[0].content

  test('scoped factory takes id and composes path', () => {
    expect(out).toContain(
      'export function createGameRoomNode(store: SyncStore, id: string): GameRoomNode',
    )
    expect(out).toContain('const path = `room.${id}`')
  })
})

describe('collision with runtime facade keys', () => {
  const ir = mkIR({
    Thing: {
      name: 'Thing',
      fields: [
        { name: 'status', type: 'String', required: true, list: false },
        { name: 'value', type: 'Int', required: true, list: false },
      ],
    },
  })

  const out = generate(ir).files[0].content

  test('$status → $statusField', () => {
    expect(out).toContain('$statusField: ISyncNode<string>')
    expect(out).not.toMatch(/readonly \$status: ISyncNode/)
  })

  test('value → valueValue (snapshot rename)', () => {
    expect(out).toContain('readonly valueValue: number')
  })
})

describe('list fields', () => {
  const ir = mkIR({
    Team: {
      name: 'Team',
      fields: [
        { name: 'ids', type: 'ID', required: true, list: true, listItemRequired: true },
        { name: 'maybe', type: 'String', required: true, list: true, listItemRequired: false },
      ],
    },
  })

  const out = generate(ir).files[0].content

  test('required list of required items', () => {
    expect(out).toContain('readonly ids: string[]')
  })

  test('list with optional items', () => {
    expect(out).toContain('readonly maybe: (string | undefined)[]')
  })
})
