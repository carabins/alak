// End-to-end with vue: true. Reuses the Kotelok fixture compiled via
// @alaq/graph and asserts the generated source includes composables for every
// record while staying backward-compatible with the non-Vue snapshot.

import { test, expect, describe, beforeAll } from 'bun:test'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const KOTELOK_DIR = join(import.meta.dir, '..', '..', 'graph', 'test', 'fixtures', 'kotelok')
const SNAPSHOT_PLAIN = join(import.meta.dir, 'snapshots', 'kotelok.ts.snap')
const SNAPSHOT_VUE = join(import.meta.dir, 'snapshots', 'kotelok.vue.ts.snap')

const FILES = ['identity.aql', 'players.aql', 'lobby.aql', 'round.aql', 'system.aql']

function loadFixture() {
  return FILES.map(n => ({
    path: join(KOTELOK_DIR, n),
    source: readFileSync(join(KOTELOK_DIR, n), 'utf8'),
  }))
}

let plainSource: string
let vueSource: string

beforeAll(() => {
  const res = compileSources(loadFixture())
  expect(res.ir).not.toBeNull()
  const errs = res.diagnostics.filter(d => d.severity === 'error')
  expect(errs).toEqual([])

  plainSource = generate(res.ir!, { namespace: 'kotelok' }).files[0].content
  vueSource = generate(res.ir!, { namespace: 'kotelok', vue: true }).files[0].content
})

describe('Kotelok — vue: true adds composables', () => {
  test('vue imports present in vue-variant only', () => {
    expect(vueSource).toContain(`import type { Ref } from 'vue'`)
    expect(vueSource).toContain(`import { useNode, useStore } from '@alaq/link-state-vue'`)
    expect(plainSource).not.toContain(`from 'vue'`)
    expect(plainSource).not.toContain(`@alaq/link-state-vue`)
  })

  test('composable section banner only in vue-variant', () => {
    expect(vueSource).toContain('// Vue composables')
    expect(plainSource).not.toContain('// Vue composables')
  })

  test('useGameRoom signature matches scoped record convention', () => {
    expect(vueSource).toContain(
      'export function useGameRoom(store: SyncStore, id: string): UseGameRoomResult',
    )
    expect(vueSource).toContain(
      'export function useGameRoomInScope(id: string): UseGameRoomResult',
    )
  })

  test('useGameSettings signature matches unscoped record convention', () => {
    expect(vueSource).toContain(
      'export function useGameSettings(store: SyncStore, path: string): UseGameSettingsResult',
    )
    expect(vueSource).toContain(
      'export function useGameSettingsInScope(path: string): UseGameSettingsResult',
    )
  })

  test('every record has a matching use* composable', () => {
    for (const name of [
      'Player', 'Team', 'GameRoom', 'GameSettings', 'WordSubmission',
      'RoundState', 'RoundStats', 'SystemInfo',
    ]) {
      expect(vueSource).toContain(`export interface Use${name}Result {`)
      expect(vueSource).toContain(`export function use${name}(`)
      expect(vueSource).toContain(`export function use${name}InScope(`)
    }
  })

  test('result shape is {node, value, status}', () => {
    expect(vueSource).toContain('node: GameRoomNode')
    expect(vueSource).toContain('value: Ref<IGameRoom | undefined>')
    expect(vueSource).toContain(`status: Ref<'pending' | 'ready' | 'error' | undefined>`)
  })
})

describe('Kotelok — backward compatibility', () => {
  test('vue: false output is byte-identical to the plain snapshot', () => {
    const stored = readFileSync(SNAPSHOT_PLAIN, 'utf8')
    expect(plainSource).toBe(stored)
  })

  test('vue-variant is a pure superset of the plain variant', () => {
    // The vue output includes everything the plain one does, plus extra
    // lines. We don't assert a prefix (imports shift) but every non-vue
    // export should still be present.
    for (const needle of [
      'export enum RoomStatus {',
      'export interface IGameRoom {',
      'export interface GameRoomNode {',
      'export function createGameRoomNode(',
      'export function createApi(',
    ]) {
      expect(vueSource).toContain(needle)
    }
  })
})

describe('Kotelok vue snapshot', () => {
  test('matches stored vue snapshot byte-for-byte', () => {
    if (!existsSync(SNAPSHOT_VUE)) {
      writeFileSync(SNAPSHOT_VUE, vueSource)
      console.warn(`[snapshot] created ${SNAPSHOT_VUE}`)
      return
    }
    const stored = readFileSync(SNAPSHOT_VUE, 'utf8')
    if (stored !== vueSource) {
      const a = stored.split('\n')
      const b = vueSource.split('\n')
      const max = Math.max(a.length, b.length)
      for (let i = 0; i < max; i++) {
        if (a[i] !== b[i]) {
          console.error(`line ${i + 1}: expected ${JSON.stringify(a[i])}\n         got ${JSON.stringify(b[i])}`)
          break
        }
      }
    }
    expect(vueSource).toBe(stored)
  })
})
