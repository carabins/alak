// @alaq/graph-zenoh — type-mapping and struct-emission unit tests.
//
// Keeps the SDL → Rust translation honest across:
//   • SPEC §4.1 built-in scalars
//   • required / optional / list wrapping (§4.3)
//   • user scalars (emitted as `pub type X = String`)
//   • enum variant naming + `#[serde(rename_all = "SCREAMING_SNAKE_CASE")]`
//   • record struct derives and `#[serde(rename = ...)]` for camelCase fields

import { describe, expect, test } from 'bun:test'
import {
  LineBuffer,
  buildTypeContext,
  camelCase,
  mapBaseType,
  mapFieldType,
  pascalCase,
  renderDirectiveComment,
  rustIdent,
  snakeCase,
} from '../src/utils'
import {
  emitEnum,
  emitRecordImpl,
  emitRecordStruct,
  emitUserScalars,
  enumVariantName,
} from '../src/types-gen'
import type { IRField, IRRecord } from '../../graph/src/types'

const emptyCtx = { enums: {}, scalars: {}, records: {} }
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

// ────────────────────────────────────────────────────────────────
// Built-in scalars (SPEC §4.1)
// ────────────────────────────────────────────────────────────────

describe('mapBaseType — SPEC §4.1 → Rust', () => {
  test('ID/String/UUID → String', () => {
    for (const t of ['ID', 'String', 'UUID']) {
      expect(mapBaseType(t, emptyCtx)).toBe('String')
    }
  })

  test('Int/Timestamp/Duration → i64', () => {
    for (const t of ['Int', 'Timestamp', 'Duration']) {
      expect(mapBaseType(t, emptyCtx)).toBe('i64')
    }
  })

  test('Float → f64', () => {
    expect(mapBaseType('Float', emptyCtx)).toBe('f64')
  })

  test('Boolean → bool', () => {
    expect(mapBaseType('Boolean', emptyCtx)).toBe('bool')
  })

  test('Bytes → Vec<u8>', () => {
    expect(mapBaseType('Bytes', emptyCtx)).toBe('Vec<u8>')
  })

  test('enum ref resolves to its Rust enum name', () => {
    const ctx = withEnum('RoomStatus', ['LOBBY'])
    expect(mapBaseType('RoomStatus', ctx)).toBe('RoomStatus')
  })

  test('record ref resolves to PascalCase record name', () => {
    expect(mapBaseType('Player', withRecord('Player'))).toBe('Player')
  })

  test('user scalar ref keeps its alias name', () => {
    const ctx = { enums: {}, scalars: { DeviceID: { name: 'DeviceID' } }, records: {} }
    expect(mapBaseType('DeviceID', ctx)).toBe('DeviceID')
  })
})

// ────────────────────────────────────────────────────────────────
// Full field mapping — required / optional / list matrix
// ────────────────────────────────────────────────────────────────

describe('mapFieldType — required / list combinations', () => {
  test('T! → T', () => {
    expect(mapFieldType(field({ type: 'Int', required: true }), emptyCtx)).toBe('i64')
  })

  test('T → Option<T>', () => {
    expect(mapFieldType(field({ type: 'String', required: false }), emptyCtx))
      .toBe('Option<String>')
  })

  test('[T!]! → Vec<T>', () => {
    expect(
      mapFieldType(
        field({ type: 'String', list: true, required: true, listItemRequired: true }),
        emptyCtx,
      ),
    ).toBe('Vec<String>')
  })

  test('[T!] → Option<Vec<T>>', () => {
    expect(
      mapFieldType(
        field({ type: 'String', list: true, required: false, listItemRequired: true }),
        emptyCtx,
      ),
    ).toBe('Option<Vec<String>>')
  })

  test('[T]! → Vec<Option<T>>', () => {
    expect(
      mapFieldType(
        field({ type: 'String', list: true, required: true, listItemRequired: false }),
        emptyCtx,
      ),
    ).toBe('Vec<Option<String>>')
  })

  test('nested record inside list', () => {
    expect(
      mapFieldType(
        field({ type: 'Player', list: true, required: true, listItemRequired: true }),
        withRecord('Player'),
      ),
    ).toBe('Vec<Player>')
  })
})

// ────────────────────────────────────────────────────────────────
// Casing helpers
// ────────────────────────────────────────────────────────────────

describe('snakeCase', () => {
  test('camelCase → snake_case', () => {
    expect(snakeCase('wordsPerPlayer')).toBe('words_per_player')
    expect(snakeCase('myWords')).toBe('my_words')
  })

  test('already snake stays snake', () => {
    expect(snakeCase('updated_at')).toBe('updated_at')
  })

  test('PascalCase → snake_case', () => {
    expect(snakeCase('RoundState')).toBe('round_state')
  })
})

describe('pascalCase / camelCase', () => {
  test('pascalCase upcases first char', () => {
    expect(pascalCase('player')).toBe('Player')
  })

  test('camelCase downcases first char', () => {
    expect(camelCase('CreateRoom')).toBe('createRoom')
  })
})

describe('rustIdent escapes reserved words', () => {
  test('keyword gets r# prefix', () => {
    expect(rustIdent('type')).toBe('r#type')
    expect(rustIdent('match')).toBe('r#match')
  })

  test('non-keyword passes through', () => {
    expect(rustIdent('name')).toBe('name')
    expect(rustIdent('words_per_player')).toBe('words_per_player')
  })
})

// ────────────────────────────────────────────────────────────────
// Enum emission
// ────────────────────────────────────────────────────────────────

describe('enumVariantName', () => {
  test('SCREAMING_SNAKE → PascalCase variant', () => {
    expect(enumVariantName('LOBBY')).toBe('Lobby')
    expect(enumVariantName('GAME_ACTIVE')).toBe('GameActive')
    expect(enumVariantName('FINISHED')).toBe('Finished')
  })
})

describe('emitEnum', () => {
  test('produces #[serde(rename_all = "SCREAMING_SNAKE_CASE")] + PascalCase variants', () => {
    const buf = new LineBuffer()
    emitEnum(buf, { name: 'RoomStatus', values: ['LOBBY', 'GAME_ACTIVE', 'FINISHED'] })
    const out = buf.toString()
    expect(out).toContain(`pub enum RoomStatus {`)
    expect(out).toContain(`#[serde(rename_all = "SCREAMING_SNAKE_CASE")]`)
    expect(out).toContain(`Lobby,`)
    expect(out).toContain(`GameActive,`)
    expect(out).toContain(`Finished,`)
  })
})

// ────────────────────────────────────────────────────────────────
// User scalar aliases
// ────────────────────────────────────────────────────────────────

describe('emitUserScalars', () => {
  test('emits pub type alias over String', () => {
    const buf = new LineBuffer()
    emitUserScalars(buf, { DeviceID: { name: 'DeviceID' }, UUID: { name: 'UUID' } })
    const out = buf.toString()
    expect(out).toContain('pub type DeviceID = String;')
    expect(out).toContain('pub type UUID = String;')
  })
})

// ────────────────────────────────────────────────────────────────
// Record struct emission
// ────────────────────────────────────────────────────────────────

describe('emitRecordStruct', () => {
  test('simple record gets Serialize/Deserialize derives', () => {
    const buf = new LineBuffer()
    const rec: IRRecord = {
      name: 'Player',
      fields: [
        { name: 'id', type: 'ID', required: true, list: false },
        { name: 'name', type: 'String', required: true, list: false },
        { name: 'avatar', type: 'String', required: false, list: false },
      ],
    }
    emitRecordStruct(buf, rec, emptyCtx)
    const out = buf.toString()
    expect(out).toContain(`#[derive(Debug, Clone, Serialize, Deserialize)]`)
    expect(out).toContain(`pub struct Player {`)
    expect(out).toContain(`pub id: String,`)
    expect(out).toContain(`pub name: String,`)
    expect(out).toContain(`pub avatar: Option<String>,`)
  })

  test('camelCase field → snake_case with #[serde(rename)]', () => {
    const buf = new LineBuffer()
    const rec: IRRecord = {
      name: 'GameSettings',
      fields: [
        { name: 'wordsPerPlayer', type: 'Int', required: true, list: false },
      ],
    }
    emitRecordStruct(buf, rec, emptyCtx)
    const out = buf.toString()
    expect(out).toContain(`#[serde(rename = "wordsPerPlayer")]`)
    expect(out).toContain(`pub words_per_player: i64,`)
  })

  test('list of required records → Vec<Record>', () => {
    const buf = new LineBuffer()
    const rec: IRRecord = {
      name: 'Team',
      fields: [
        { name: 'memberIds', type: 'ID', required: true, list: true, listItemRequired: true },
      ],
    }
    emitRecordStruct(buf, rec, emptyCtx)
    const out = buf.toString()
    expect(out).toContain(`pub member_ids: Vec<String>,`)
  })
})

// ────────────────────────────────────────────────────────────────
// Directive comment rendering
// ────────────────────────────────────────────────────────────────

describe('renderDirectiveComment', () => {
  test('string arg quoted', () => {
    expect(renderDirectiveComment({ name: 'auth', args: { read: 'owner' } })).toBe(
      '@auth(read: "owner")',
    )
  })

  test('enum-like bareword stays unquoted', () => {
    expect(renderDirectiveComment({ name: 'sync', args: { qos: 'REALTIME' } })).toBe(
      '@sync(qos: REALTIME)',
    )
  })

  test('numeric args', () => {
    expect(renderDirectiveComment({ name: 'range', args: { min: 1, max: 100 } })).toBe(
      '@range(min: 1, max: 100)',
    )
  })

  test('no-args directive', () => {
    expect(renderDirectiveComment({ name: 'atomic' })).toBe('@atomic')
  })
})

// ────────────────────────────────────────────────────────────────
// buildTypeContext
// ────────────────────────────────────────────────────────────────

describe('buildTypeContext', () => {
  test('forwards enums/scalars/records from schema', () => {
    const schema = {
      name: 'S', namespace: 's', version: 1,
      records: { Player: { name: 'Player', fields: [] } },
      actions: {},
      enums: { E: { name: 'E', values: ['A'] } },
      scalars: { DeviceID: { name: 'DeviceID' } },
      opaques: {},
    } as any
    const ctx = buildTypeContext(schema)
    expect(ctx.enums.E).toBeDefined()
    expect(ctx.scalars.DeviceID).toBeDefined()
    expect(ctx.records.Player).toBeDefined()
  })
})
