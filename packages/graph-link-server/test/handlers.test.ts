// @alaq/graph-link-server — ActionHandlers interface shape tests.
//
// Unit-level: build small, hand-shaped IR inputs, then assert the output
// substrings one would actually read in an IDE. We don't try to lex/parse
// the generated TS — ripgrep-style substring checks are brittle but honest
// about what the codegen contract is.

import { test, expect, describe } from 'bun:test'
import { generate } from '../src/index'
import type { IR } from '../../graph/src/types'

function irOf(
  actions: Record<string, any>,
  records: Record<string, any> = {},
  enums: Record<string, any> = {},
): IR {
  return {
    schemas: {
      test: {
        name: 'Test',
        namespace: 'test',
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

function source(ir: IR): string {
  const res = generate(ir)
  expect(res.files.length).toBe(1)
  return res.files[0].content
}

describe('ActionHandlers — interface shape', () => {
  test('emits ActionHandlers with one method per action', () => {
    const src = source(irOf({
      CreateRoom: {
        name: 'CreateRoom',
        output: 'ID',
        outputRequired: true,
      },
      Ping: {
        name: 'Ping',
      },
    }))
    expect(src).toContain('export interface ActionHandlers {')
    expect(src).toContain('createRoom(ctx: ActionContext)')
    expect(src).toContain('ping(ctx: ActionContext)')
  })

  test('unscoped action with no input: ctx only', () => {
    const src = source(irOf({
      Ping: { name: 'Ping' },
    }))
    expect(src).toContain('ping(ctx: ActionContext): void | Promise<void>')
  })

  test('unscoped action with input: ctx + input object', () => {
    const src = source(irOf({
      CreateRoom: {
        name: 'CreateRoom',
        input: [{ name: 'name', type: 'String', required: true, list: false }],
        output: 'ID',
        outputRequired: true,
      },
    }))
    expect(src).toContain(
      'createRoom(ctx: ActionContext, input: { name: string }): string | Promise<string>',
    )
  })

  test('scoped action receives scopeId before input', () => {
    const src = source(irOf({
      JoinRoom: {
        name: 'JoinRoom',
        scope: 'room',
        input: [
          { name: 'name', type: 'String', required: true, list: false },
        ],
        output: 'Player',
        outputRequired: true,
      },
    }, {
      Player: {
        name: 'Player',
        fields: [
          { name: 'id', type: 'ID', required: true, list: false },
        ],
      },
    }))
    expect(src).toContain(
      'joinRoom(ctx: ActionContext, roomId: string, input: { name: string }): IPlayer | Promise<IPlayer>',
    )
  })

  test('scoped action with no input: ctx + scopeId only', () => {
    const src = source(irOf({
      LeaveRoom: {
        name: 'LeaveRoom',
        scope: 'room',
      },
    }))
    expect(src).toContain(
      'leaveRoom(ctx: ActionContext, roomId: string): void | Promise<void>',
    )
  })

  test('fire-and-forget (no output) returns void | Promise<void>', () => {
    const src = source(irOf({
      Beep: {
        name: 'Beep',
        input: [{ name: 'msg', type: 'String', required: true, list: false }],
      },
    }))
    expect(src).toContain(
      'beep(ctx: ActionContext, input: { msg: string }): void | Promise<void>',
    )
  })

  test('optional input fields use ? marker', () => {
    const src = source(irOf({
      SetName: {
        name: 'SetName',
        input: [
          { name: 'name', type: 'String', required: false, list: false },
        ],
      },
    }))
    expect(src).toMatch(/input:\s*\{\s*name\?:\s*string\s*\}/)
  })

  test('list input types emit T[]', () => {
    const src = source(irOf({
      SubmitWords: {
        name: 'SubmitWords',
        input: [
          {
            name: 'words',
            type: 'String',
            required: true,
            list: true,
            listItemRequired: true,
          },
        ],
      },
    }))
    expect(src).toContain('words: string[]')
  })

  test('record output becomes embedded I<Record>', () => {
    const src = source(irOf({
      GetPlayer: {
        name: 'GetPlayer',
        output: 'Player',
        outputRequired: true,
      },
    }, {
      Player: {
        name: 'Player',
        fields: [
          { name: 'id', type: 'ID', required: true, list: false },
          { name: 'name', type: 'String', required: true, list: false },
        ],
      },
    }))
    expect(src).toContain('export interface IPlayer {')
    expect(src).toContain('readonly id: string')
    expect(src).toContain('readonly name: string')
    expect(src).toMatch(/getPlayer\(ctx: ActionContext\): IPlayer \| Promise<IPlayer>/)
  })

  test('records only transitively reachable from actions are embedded', () => {
    const src = source(irOf({
      GetRoom: {
        name: 'GetRoom',
        output: 'Room',
        outputRequired: true,
      },
    }, {
      Room: {
        name: 'Room',
        fields: [
          { name: 'id', type: 'ID', required: true, list: false },
          { name: 'players', type: 'Player', required: true, list: true, listItemRequired: true },
        ],
      },
      Player: {
        name: 'Player',
        fields: [{ name: 'id', type: 'ID', required: true, list: false }],
      },
      Unused: {
        name: 'Unused',
        fields: [{ name: 'x', type: 'ID', required: true, list: false }],
      },
    }))
    expect(src).toContain('export interface IRoom {')
    expect(src).toContain('export interface IPlayer {')
    expect(src).not.toContain('IUnused')
  })

  test('enums are embedded verbatim when declared on schema', () => {
    const src = source(irOf(
      { Ping: { name: 'Ping' } },
      {},
      { Status: { name: 'Status', values: ['A', 'B'] } },
    ))
    expect(src).toContain('export enum Status {')
    expect(src).toContain("A = 'A'")
    expect(src).toContain("B = 'B'")
  })

  test('empty schema emits a warning + empty module', () => {
    const res = generate(irOf({}))
    expect(res.diagnostics.some(d => d.severity === 'warning')).toBe(true)
    expect(res.files[0].content).toContain('no actions')
    expect(res.files[0].content).toContain('export {}')
  })
})
