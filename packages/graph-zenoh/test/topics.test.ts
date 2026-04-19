// @alaq/graph-zenoh — topic-derivation tests.
//
// Covers the three cases from SPEC §11:
//   • unscoped record  → "{ns}/R"
//   • scoped record    → "{ns}/{scope}/{id}/R"
//   • scoped action    → "{ns}/{scope}/{id}/action/A"
//   • unscoped action  → "{ns}/action/A"

import { describe, expect, test } from 'bun:test'
import { LineBuffer } from '../src/utils'
import { emitTopicsModule } from '../src/topics-gen'
import { emitRecordImpl } from '../src/types-gen'
import { emitAction } from '../src/actions-gen'
import type { IRAction, IRRecord, IRSchema } from '../../graph/src/types'

const emptyCtx = { enums: {}, scalars: {}, records: {} }

function generate(fn: (buf: LineBuffer) => void): string {
  const buf = new LineBuffer()
  fn(buf)
  return buf.toString()
}

describe('topics module', () => {
  test('emits NAMESPACE + ACTION_PREFIX + OPAQUE_PREFIX constants', () => {
    const schema = {
      name: 'K', namespace: 'kotelok', version: 1,
      records: {}, actions: {}, enums: {}, scalars: {}, opaques: {},
    } as IRSchema
    const out = generate(buf => emitTopicsModule(buf, schema))
    expect(out).toContain(`pub const NAMESPACE: &'static str = "kotelok";`)
    expect(out).toContain(`pub const ACTION_PREFIX: &'static str = "kotelok/action";`)
    expect(out).toContain(`pub const OPAQUE_PREFIX: &'static str = "kotelok/stream";`)
  })
})

describe('record topic helpers', () => {
  test('unscoped record emits topic(namespace) helper', () => {
    const rec: IRRecord = {
      name: 'SystemInfo',
      fields: [{ name: 'online', type: 'Int', required: true, list: false }],
    }
    const out = generate(buf => emitRecordImpl(buf, rec, emptyCtx, 'kotelok', []))
    expect(out).toContain(`impl SystemInfo {`)
    expect(out).toContain(`pub fn topic(namespace: &str) -> String {`)
    expect(out).toContain(`format!("{}/SystemInfo", namespace)`)
  })

  test('scoped record emits SCOPE + topic(ns, id) helper', () => {
    const rec: IRRecord = {
      name: 'GameRoom',
      scope: 'room',
      fields: [{ name: 'id', type: 'ID', required: true, list: false }],
    }
    const out = generate(buf => emitRecordImpl(buf, rec, emptyCtx, 'kotelok', []))
    expect(out).toContain(`pub const SCOPE: &'static str = "room";`)
    expect(out).toContain(`pub fn topic(namespace: &str, id: &str) -> String {`)
    expect(out).toContain(`format!("{}/room/{}/GameRoom", namespace, id)`)
  })

  test('scope can be sourced from @scope directive when rec.scope is absent', () => {
    const rec: IRRecord = {
      name: 'GameRoom',
      fields: [],
      directives: [{ name: 'scope', args: { name: 'room' } }],
    }
    const out = generate(buf => emitRecordImpl(buf, rec, emptyCtx, 'kotelok', []))
    expect(out).toContain(`pub const SCOPE: &'static str = "room";`)
    expect(out).toContain(`format!("{}/room/{}/GameRoom", namespace, id)`)
  })

  test('@topic(pattern) override emits TOPIC_PATTERN constant', () => {
    const rec: IRRecord = {
      name: 'Beacon',
      fields: [],
      directives: [{ name: 'topic', args: { pattern: 'custom/{id}/beacon' } }],
    }
    const out = generate(buf => emitRecordImpl(buf, rec, emptyCtx, 'kotelok', []))
    expect(out).toContain(`pub const TOPIC_PATTERN: &'static str = "custom/{id}/beacon";`)
  })
})

describe('action topic helpers', () => {
  test('unscoped action → "{ns}/action/<Name>"', () => {
    const action: IRAction = {
      name: 'CreateRoom',
      input: [{ name: 'settings', type: 'GameSettings', required: false, list: false }],
      output: 'ID',
      outputRequired: true,
    }
    const out = generate(buf => emitAction(buf, action, emptyCtx))
    expect(out).toContain(`impl CreateRoomInput {`)
    expect(out).toContain(`pub fn topic(namespace: &str) -> String {`)
    expect(out).toContain(`format!("{}/action/CreateRoom", namespace)`)
  })

  test('scoped action → "{ns}/{scope}/{id}/action/<Name>"', () => {
    const action: IRAction = {
      name: 'JoinRoom',
      scope: 'room',
      input: [{ name: 'name', type: 'String', required: true, list: false }],
      output: 'Player',
      outputRequired: true,
    }
    const out = generate(buf => emitAction(buf, action, emptyCtx))
    expect(out).toContain(`pub fn topic(namespace: &str, id: &str) -> String {`)
    expect(out).toContain(`format!("{}/room/{}/action/JoinRoom", namespace, id)`)
  })

  test('input-less scoped action emits free-standing topic fn', () => {
    const action: IRAction = { name: 'StartGame', scope: 'room' }
    const out = generate(buf => emitAction(buf, action, emptyCtx))
    expect(out).toContain(`pub fn start_game_topic(namespace: &str, id: &str) -> String {`)
    expect(out).toContain(`format!("{}/room/{}/action/StartGame", namespace, id)`)
  })
})
