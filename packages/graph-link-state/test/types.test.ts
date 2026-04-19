// Unit tests for the type-mapping layer. Keeps the scalar → TS translation
// honest across the whole SPEC §4.1 matrix and a sampling of list / optional
// combinations.

import { test, expect, describe } from 'bun:test'
import {
  mapBaseType,
  mapFieldType,
  mapFieldTypeOptional,
  camelCase,
  pascalCase,
  renderDefault,
  renderDirectiveComment,
  buildTypeContext,
} from '../src/utils'
import type { IRField } from '../../graph/src/types'

const emptyCtx = {
  enums: {},
  scalars: {},
  records: {},
}

const withEnum = (name: string, values: string[]) => ({
  enums: { [name]: { name, values } },
  scalars: {},
  records: {},
})

const withRecord = (name: string) => ({
  enums: {},
  scalars: {},
  records: { [name]: { name } },
})

const field = (over: Partial<IRField>): IRField => ({
  name: 'x',
  type: 'String',
  required: true,
  list: false,
  ...over,
})

describe('mapBaseType — SPEC §4.1 scalars', () => {
  test('ID, String, UUID, DeviceID, Bytes → string', () => {
    for (const t of ['ID', 'String', 'UUID', 'DeviceID', 'Bytes']) {
      expect(mapBaseType(t, emptyCtx)).toBe('string')
    }
  })

  test('Int, Float, Timestamp, Duration → number', () => {
    for (const t of ['Int', 'Float', 'Timestamp', 'Duration']) {
      expect(mapBaseType(t, emptyCtx)).toBe('number')
    }
  })

  test('Boolean → boolean', () => {
    expect(mapBaseType('Boolean', emptyCtx)).toBe('boolean')
  })

  test('enum name → enum name', () => {
    const ctx = withEnum('RoomStatus', ['LOBBY', 'ACTIVE'])
    expect(mapBaseType('RoomStatus', ctx)).toBe('RoomStatus')
  })

  test('record name → I<Record>', () => {
    const ctx = withRecord('Player')
    expect(mapBaseType('Player', ctx)).toBe('IPlayer')
  })

  test('user scalar → string (nominal on TS side)', () => {
    const ctx = { enums: {}, scalars: { DeviceID: { name: 'DeviceID' } }, records: {} }
    expect(mapBaseType('DeviceID', ctx)).toBe('string')
  })

  test('unknown type → unknown', () => {
    expect(mapBaseType('Gobbledigook', emptyCtx)).toBe('unknown')
  })
})

describe('mapFieldType — required, list, list-item required', () => {
  test('required scalar', () => {
    expect(mapFieldType(field({ type: 'Int', required: true }), emptyCtx)).toBe('number')
  })

  test('list of required strings', () => {
    expect(
      mapFieldType(field({ type: 'String', list: true, listItemRequired: true }), emptyCtx),
    ).toBe('string[]')
  })

  test('list of optional strings', () => {
    expect(
      mapFieldType(field({ type: 'String', list: true, listItemRequired: false }), emptyCtx),
    ).toBe('(string | undefined)[]')
  })
})

describe('mapFieldTypeOptional — optional wire value', () => {
  test('required field → bare type', () => {
    expect(
      mapFieldTypeOptional(field({ type: 'Boolean', required: true }), emptyCtx),
    ).toBe('boolean')
  })

  test('optional field → T | undefined', () => {
    expect(
      mapFieldTypeOptional(field({ type: 'String', required: false }), emptyCtx),
    ).toBe('string | undefined')
  })
})

describe('name casing — R063 compliance', () => {
  test('PascalCase action → camelCase call site', () => {
    expect(camelCase('CreateRoom')).toBe('createRoom')
    expect(camelCase('JoinRoom')).toBe('joinRoom')
  })

  test('already-camel stays camel', () => {
    expect(camelCase('joinRoom')).toBe('joinRoom')
  })

  test('pascalCase upcases first char', () => {
    expect(pascalCase('player')).toBe('Player')
  })
})

describe('renderDefault — SDL @default value rendering', () => {
  test('numeric default', () => {
    expect(renderDefault(10, 'Int', emptyCtx)).toBe('10')
  })

  test('boolean default', () => {
    expect(renderDefault(true, 'Boolean', emptyCtx)).toBe('true')
  })

  test('enum default becomes EnumName.MEMBER', () => {
    const ctx = withEnum('RoomStatus', ['LOBBY'])
    expect(renderDefault('LOBBY', 'RoomStatus', ctx)).toBe('RoomStatus.LOBBY')
  })

  test('string default quoted', () => {
    expect(renderDefault('hello', 'String', emptyCtx)).toBe('"hello"')
  })
})

describe('renderDirectiveComment — round-trips to @-syntax', () => {
  test('no-args directive', () => {
    expect(renderDirectiveComment({ name: 'store' })).toBe('@store')
  })

  test('string arg', () => {
    expect(renderDirectiveComment({ name: 'auth', args: { read: 'owner' } })).toBe(
      '@auth(read: "owner")',
    )
  })

  test('enum-like string arg stays bareword', () => {
    expect(renderDirectiveComment({ name: 'sync', args: { qos: 'REALTIME' } })).toBe(
      '@sync(qos: REALTIME)',
    )
  })

  test('numeric arg', () => {
    expect(renderDirectiveComment({ name: 'range', args: { min: 1, max: 100 } })).toBe(
      '@range(min: 1, max: 100)',
    )
  })
})

describe('buildTypeContext', () => {
  test('forwards enums/scalars/records from schema', () => {
    const schema = {
      name: 'S', namespace: 's', version: 1,
      records: { Player: { name: 'Player', fields: [] } },
      actions: {}, enums: { E: { name: 'E', values: ['A'] } },
      scalars: { DeviceID: { name: 'DeviceID' } },
      opaques: {},
    } as any
    const ctx = buildTypeContext(schema)
    expect(ctx.enums.E).toBeDefined()
    expect(ctx.scalars.DeviceID).toBeDefined()
    expect(ctx.records.Player).toBeDefined()
  })
})

// ── v0.3 additions ──────────────────────────────────────────────

describe('mapFieldType — v0.3 Map<K, V>', () => {
  test('scalar→scalar map emits Record<string, number>', () => {
    const f: IRField = {
      name: 'x', type: 'Map', required: true, list: false,
      map: true,
      mapKey:   { type: 'ID',  required: true, list: false },
      mapValue: { type: 'Int', required: true, list: false },
    }
    expect(mapFieldType(f, emptyCtx)).toBe('Record<string, number>')
  })

  test('nested map emits Record<string, Record<string, string>>', () => {
    const f: IRField = {
      name: 'x', type: 'Map', required: true, list: false,
      map: true,
      mapKey: { type: 'ID', required: true, list: false },
      mapValue: {
        type: 'Map', required: true, list: false, map: true,
        mapKey: { type: 'ID', required: true, list: false },
        mapValue: { type: 'String', required: true, list: false },
      },
    }
    expect(mapFieldType(f, emptyCtx)).toBe('Record<string, Record<string, string>>')
  })

  test('map value is a record → Record<string, IPlayer>', () => {
    const f: IRField = {
      name: 'x', type: 'Map', required: true, list: false,
      map: true,
      mapKey: { type: 'ID', required: true, list: false },
      mapValue: { type: 'Player', required: true, list: false },
    }
    const ctx = withRecord('Player')
    expect(mapFieldType(f, ctx)).toBe('Record<string, IPlayer>')
  })
})

describe('@range emits JSDoc in generated types (v0.3)', () => {
  test('field with @range has /** @range min=X max=Y */ JSDoc', async () => {
    const { generate } = await import('../src/index')
    const { compileSources } = await import('../../graph/src/index')
    const src = `schema S { version: 1, namespace: "s" }
record GameSettings {
  wordsPerPlayer: Int! @default(value: 10) @range(min: 1, max: 100)
}`
    const { ir } = compileSources([{ path: 't.aql', source: src }])
    const out = generate(ir!)
    const content = out.files[0]!.content
    // JSDoc block present
    expect(content).toMatch(/\/\*\*[\s\S]*@range min=1 max=100[\s\S]*\*\//)
    // And the field is still typed as number
    expect(content).toContain('readonly wordsPerPlayer: number')
  })

  test('no directives → no JSDoc block', async () => {
    const { generate } = await import('../src/index')
    const { compileSources } = await import('../../graph/src/index')
    const src = `schema S { version: 1, namespace: "s" }\nrecord R { x: Int! }`
    const { ir } = compileSources([{ path: 't.aql', source: src }])
    const out = generate(ir!)
    const content = out.files[0]!.content
    // The /** block above `x` should not exist — the only /** in output
    // would be the file header, which uses // not /**.
    expect(content).not.toMatch(/\/\*\*[\s\S]*?\*\/\s*readonly x:/)
  })
})
