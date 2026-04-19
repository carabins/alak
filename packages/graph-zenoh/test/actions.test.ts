// @alaq/graph-zenoh — action codegen tests.
//
// Per SPEC §11:
//   • fire-forget (no output) → session.put(...)
//   • request-reply (output)  → session.get(...).with_value(...).recv_async()
//
// Verify topic derivation, newtype output wrapping, fire-forget skip of output,
// and presence of the appropriate zenoh call.

import { describe, expect, test } from 'bun:test'
import { LineBuffer } from '../src/utils'
import { emitAction, emitActions } from '../src/actions-gen'
import type { IRAction } from '../../graph/src/types'

const emptyCtx = { enums: {}, scalars: {}, records: {} }

function gen(action: IRAction): string {
  const buf = new LineBuffer()
  emitAction(buf, action, emptyCtx)
  return buf.toString()
}

describe('fire-forget action (no output)', () => {
  const out = gen({ name: 'StartGame', scope: 'room' })

  test('no Output newtype emitted', () => {
    expect(out).not.toContain(`StartGameOutput`)
  })

  test('no Input struct emitted (no input)', () => {
    expect(out).not.toContain(`StartGameInput`)
  })

  test('call uses session.put + empty payload', () => {
    expect(out).toContain(`pub async fn call_start_game(`)
    expect(out).toContain(`session.put(&key, payload).res().await?`)
  })

  test('return type is ()', () => {
    expect(out).toContain(`-> zenoh::Result<()>`)
  })

  test('body has no session.get', () => {
    expect(out).not.toContain(`.get(&key)`)
  })
})

describe('request/reply action with input + output', () => {
  const out = gen({
    name: 'JoinRoom',
    scope: 'room',
    input: [{ name: 'name', type: 'String', required: true, list: false }],
    output: 'Player',
    outputRequired: true,
  })

  test('Input struct emitted with Serialize/Deserialize', () => {
    expect(out).toContain(`pub struct JoinRoomInput {`)
    expect(out).toContain(`pub name: String,`)
  })

  test('Output newtype wraps the declared output', () => {
    expect(out).toContain(`#[serde(transparent)]`)
    expect(out).toContain(`pub struct JoinRoomOutput(pub Player);`)
  })

  test('call signature takes id + input', () => {
    expect(out).toContain(`pub async fn call_join_room(`)
    expect(out).toContain(`id: &str,`)
    expect(out).toContain(`input: &JoinRoomInput,`)
  })

  test('uses session.get + .with_value', () => {
    expect(out).toContain(`.get(&key)`)
    expect(out).toContain(`.with_value(payload)`)
  })

  test('decodes reply into JoinRoomOutput', () => {
    expect(out).toContain(`let out: JoinRoomOutput = serde_json::from_slice(&bytes)`)
  })

  test('return type is Result<JoinRoomOutput>', () => {
    expect(out).toContain(`-> zenoh::Result<JoinRoomOutput>`)
  })
})

describe('unscoped action with input', () => {
  const out = gen({
    name: 'CreateRoom',
    input: [{ name: 'settings', type: 'GameSettings', required: false, list: false }],
    output: 'ID',
    outputRequired: true,
  })

  test('optional input field → Option<GameSettings>', () => {
    expect(out).toContain(`pub settings: Option<GameSettings>,`)
  })

  test('Output wraps ID (String)', () => {
    expect(out).toContain(`pub struct CreateRoomOutput(pub String);`)
  })

  test('topic fn on Input does not take id', () => {
    expect(out).toContain(`pub fn topic(namespace: &str) -> String {`)
    expect(out).not.toContain(`pub fn topic(namespace: &str, id: &str) -> String`)
  })
})

describe('boolean output', () => {
  const out = gen({
    name: 'JoinTeam',
    scope: 'room',
    input: [{ name: 'teamId', type: 'ID', required: true, list: false }],
    output: 'Boolean',
    outputRequired: true,
  })

  test('Output wraps bool', () => {
    expect(out).toContain(`pub struct JoinTeamOutput(pub bool);`)
  })

  test('camelCase input field renamed to snake', () => {
    expect(out).toContain(`#[serde(rename = "teamId")]`)
    expect(out).toContain(`pub team_id: String,`)
  })
})

describe('emitActions — sorted, grouped', () => {
  const buf = new LineBuffer()
  emitActions(
    buf,
    {
      BAction: { name: 'BAction', scope: 'room' },
      AAction: {
        name: 'AAction',
        input: [{ name: 'x', type: 'Int', required: true, list: false }],
        output: 'Boolean',
        outputRequired: true,
      },
    } as any,
    emptyCtx,
  )
  const out = buf.toString()

  test('emits both actions', () => {
    expect(out).toContain(`call_a_action`)
    expect(out).toContain(`call_b_action`)
  })

  test('A comes before B (alphabetical)', () => {
    expect(out.indexOf('call_a_action')).toBeLessThan(out.indexOf('call_b_action'))
  })
})
