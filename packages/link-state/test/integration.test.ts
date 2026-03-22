import { test, expect, mock } from 'bun:test'
import { SyncStore } from '../src/store'
import { isGhost } from '@alaq/deep-state'

test('LinkState: Ghost -> Fetch -> Update flow', async () => {
  const onFetch = mock((path) => {
    // console.log('Fetching:', path)
  })
  
  const store = new SyncStore({ onFetch })
  
  const me = store.get('me')
  
  expect(me.__q).toBe(true)
  expect(isGhost(me.value)).toBe(true)
  expect(me.$status.value).toBe('pending')
  expect(onFetch).toHaveBeenCalledWith('me')
  
  let currentHp: any = null
  me.up((val: any) => {
    // val is ghost or real data
    currentHp = isGhost(val) ? undefined : val?.hp
  })
  
  expect(currentHp).toBeUndefined()
  
  store.applyPatch('me', { id: '1', hp: 100 })
  
  expect(isGhost(me.value)).toBe(false)
  expect(me.value.hp).toBe(100)
  expect(currentHp).toBe(100)
  expect(me.$status.value).toBe('ready')
})

test('LinkState: Nested ghosting', () => {
  const store = new SyncStore()
  const gold = store.get('player.inventory.gold')
  
  expect(gold.$meta.path).toBe('player.inventory.gold')
  expect(gold.$status.value).toBe('pending')
  
  store.applyPatch('player', { inventory: { gold: 500 } })
  
  expect(gold.value).toBe(500)
  expect(gold.$status.value).toBe('ready')
})

test('LinkState: Internal API _get and _node', () => {
  const store = new SyncStore()
  store.applyPatch('player', { id: '1', stats: { hp: 80 } })
  
  const player = store.get('player')
  
  // 1. _get: fast primitive access
  expect(player._get('id')).toBe('1')
  
  // 2. _node: child navigation
  const stats = player._node('stats')
  expect(stats.$meta.path).toBe('player.stats')
  expect(stats.value.hp).toBe(80)
  
  // 3. Deep _get
  expect(stats._get('hp')).toBe(80)
})

test('LinkState: Action _act', async () => {
  const onAction = mock((action, path, args) => Promise.resolve({ ok: true }))
  const store = new SyncStore({ onAction })
  
  const player = store.get('players.1')
  await player._act('move', { x: 10 })
  
  expect(onAction).toHaveBeenCalledWith('move', 'players.1', { x: 10 })
})
