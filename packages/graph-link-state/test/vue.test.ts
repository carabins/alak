// Vue composable emitter coverage. Mirrors the style of nodes.test.ts — uses
// hand-built IR fragments so tests target the emitter contract only.

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

describe('vue: false (default) — no Vue output', () => {
  const ir = mkIR({
    Player: {
      name: 'Player',
      fields: [{ name: 'id', type: 'ID', required: true, list: false }],
    },
  })

  const defaultOut = generate(ir).files[0].content
  const explicitOut = generate(ir, { vue: false }).files[0].content

  test('no vue imports', () => {
    expect(defaultOut).not.toContain(`from 'vue'`)
    expect(defaultOut).not.toContain(`@alaq/link-state-vue`)
  })

  test('no composable exports', () => {
    expect(defaultOut).not.toContain('export function usePlayer')
    expect(defaultOut).not.toContain('UsePlayerResult')
    expect(defaultOut).not.toContain('// Vue composables')
  })

  test('vue: false explicit === default', () => {
    expect(explicitOut).toBe(defaultOut)
  })
})

describe('vue: true — unscoped record', () => {
  const ir = mkIR({
    Player: {
      name: 'Player',
      fields: [
        { name: 'id', type: 'ID', required: true, list: false },
        { name: 'name', type: 'String', required: true, list: false },
      ],
    },
  })

  const out = generate(ir, { vue: true }).files[0].content

  test('emits vue imports', () => {
    expect(out).toContain(`import type { Ref } from 'vue'`)
    expect(out).toContain(`import { useNode, useStore } from '@alaq/link-state-vue'`)
  })

  test('emits section banner', () => {
    expect(out).toContain('// Vue composables')
  })

  test('emits UsePlayerResult interface', () => {
    expect(out).toContain('export interface UsePlayerResult {')
    expect(out).toContain('node: PlayerNode')
    expect(out).toContain('value: Ref<IPlayer | undefined>')
    expect(out).toContain(`status: Ref<'pending' | 'ready' | 'error' | undefined>`)
  })

  test('emits usePlayer(store, path) for unscoped', () => {
    expect(out).toContain(
      'export function usePlayer(store: SyncStore, path: string): UsePlayerResult',
    )
    expect(out).toContain('const node = createPlayerNode(store, path)')
    expect(out).toContain('value: useNode(node.$node),')
    // $status is an IQ<…>, not an ISyncNode<…>, so the generator casts through
    // unknown to reuse useNode without hacking the adapter.
    expect(out).toContain(
      `status: useNode(node.$status as unknown as ISyncNode<'pending' | 'ready' | 'error'>),`,
    )
  })

  test('emits usePlayerInScope(path) high-level wrapper', () => {
    expect(out).toContain(
      'export function usePlayerInScope(path: string): UsePlayerResult',
    )
    expect(out).toContain('return usePlayer(useStore(), path)')
  })
})

describe('vue: true — scoped record', () => {
  const ir = mkIR({
    GameRoom: {
      name: 'GameRoom',
      scope: 'room',
      directives: [{ name: 'scope', args: { name: 'room' } }],
      fields: [{ name: 'id', type: 'ID', required: true, list: false }],
    },
  })

  const out = generate(ir, { vue: true }).files[0].content

  test('useGameRoom takes id, not path', () => {
    expect(out).toContain(
      'export function useGameRoom(store: SyncStore, id: string): UseGameRoomResult',
    )
    expect(out).toContain('const node = createGameRoomNode(store, id)')
  })

  test('useGameRoomInScope takes id', () => {
    expect(out).toContain(
      'export function useGameRoomInScope(id: string): UseGameRoomResult',
    )
    expect(out).toContain('return useGameRoom(useStore(), id)')
  })
})

describe('vueImport override', () => {
  const ir = mkIR({
    Player: {
      name: 'Player',
      fields: [{ name: 'id', type: 'ID', required: true, list: false }],
    },
  })

  test('custom specifier replaces the default', () => {
    const out = generate(ir, { vue: true, vueImport: '#vue-adapter' }).files[0].content
    expect(out).toContain(`import { useNode, useStore } from '#vue-adapter'`)
    expect(out).not.toContain(`from '@alaq/link-state-vue'`)
  })
})

describe('multiple records — both scoped and unscoped get composables', () => {
  const ir = mkIR({
    GameRoom: {
      name: 'GameRoom',
      scope: 'room',
      directives: [{ name: 'scope', args: { name: 'room' } }],
      fields: [{ name: 'id', type: 'ID', required: true, list: false }],
    },
    Player: {
      name: 'Player',
      fields: [{ name: 'id', type: 'ID', required: true, list: false }],
    },
  })

  const out = generate(ir, { vue: true }).files[0].content

  test('both records produce a use*', () => {
    expect(out).toContain('export function useGameRoom(')
    expect(out).toContain('export function usePlayer(')
  })

  test('both records produce a use*InScope', () => {
    expect(out).toContain('export function useGameRoomInScope(')
    expect(out).toContain('export function usePlayerInScope(')
  })

  test('scoped vs unscoped signatures differ (id vs path)', () => {
    expect(out).toContain('useGameRoom(store: SyncStore, id: string)')
    expect(out).toContain('usePlayer(store: SyncStore, path: string)')
  })
})

describe('empty schema — no composables emitted', () => {
  const ir = mkIR({}, {}, {})
  const out = generate(ir, { vue: true }).files[0].content

  test('vue imports still appear (harmless for empty file)', () => {
    // This keeps the header logic simple: if vue=true we always include the
    // imports. For a truly empty schema the generated file is a header-only
    // stub anyway — consumer won't import it.
    expect(out).toContain(`from 'vue'`)
  })

  test('no composable section banner when no records', () => {
    expect(out).not.toContain('// Vue composables')
  })
})
