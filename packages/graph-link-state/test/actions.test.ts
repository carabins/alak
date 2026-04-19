// Action emitter coverage — scoped vs unscoped, with/without input/output.

import { test, expect, describe } from 'bun:test'
import { generate } from '../src/index'
import type { IR } from '../../graph/src/types'

function mkIR(actions: any = {}, records: any = {}): IR {
  return {
    schemas: {
      s: {
        name: 'S',
        namespace: 's',
        version: 1,
        records,
        actions,
        enums: {},
        scalars: {},
        opaques: {},
      },
    },
  }
}

describe('unscoped action with input + output', () => {
  const ir = mkIR({
    CreateRoom: {
      name: 'CreateRoom',
      input: [{ name: 'settings', type: 'ID', required: true, list: false }],
      output: 'ID',
      outputRequired: true,
    },
  })

  const out = generate(ir).files[0].content

  test('emits top-level camelCase function', () => {
    expect(out).toContain(
      'export async function createRoom(store: SyncStore, input: { settings: string }): Promise<string>',
    )
  })

  test('delegates to options.onAction with empty path', () => {
    expect(out).toContain(`onAction('CreateRoom', '', input)`)
  })

  test('registered under api.actions', () => {
    expect(out).toContain('createRoom: (input: Parameters<typeof createRoom>[1]) => createRoom(store, input)')
  })
})

describe('unscoped action without input, with output', () => {
  const ir = mkIR({
    Ping: { name: 'Ping', output: 'Boolean', outputRequired: true },
  })
  const out = generate(ir).files[0].content
  test('no input param, just store', () => {
    expect(out).toContain('export async function ping(store: SyncStore): Promise<boolean>')
    expect(out).toContain(`onAction('Ping', '', undefined)`)
  })
})

describe('fire-forget action (no output)', () => {
  const ir = mkIR({
    Log: { name: 'Log', input: [{ name: 'msg', type: 'String', required: true, list: false }] },
  })
  const out = generate(ir).files[0].content
  test('output Promise<void>', () => {
    expect(out).toContain(
      'export async function log(store: SyncStore, input: { msg: string }): Promise<void>',
    )
  })
})

describe('scoped action — bound as method on record node', () => {
  const ir = mkIR(
    {
      JoinRoom: {
        name: 'JoinRoom',
        scope: 'room',
        input: [{ name: 'name', type: 'String', required: true, list: false }],
        output: 'ID',
        outputRequired: true,
      },
      StartGame: { name: 'StartGame', scope: 'room' },
    },
    {
      GameRoom: {
        name: 'GameRoom',
        scope: 'room',
        directives: [{ name: 'scope', args: { name: 'room' } }],
        fields: [{ name: 'id', type: 'ID', required: true, list: false }],
      },
    },
  )

  const out = generate(ir).files[0].content

  test('JoinRoom appears as method on GameRoomNode interface', () => {
    expect(out).toContain('joinRoom(input: { name: string }): Promise<string>')
  })

  test('StartGame is zero-arg Promise<void>', () => {
    expect(out).toContain('startGame(): Promise<void>')
  })

  test('factory wires delegation to base._act', () => {
    expect(out).toContain(`base._act('JoinRoom', input)`)
    expect(out).toContain(`base._act('StartGame', undefined)`)
  })

  test('scoped action does NOT get a top-level unscoped wrapper', () => {
    expect(out).not.toMatch(
      /export async function joinRoom\(store: SyncStore/,
    )
  })
})
