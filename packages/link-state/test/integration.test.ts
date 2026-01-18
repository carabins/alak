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

test('LinkState: Callable node(value)', () => {
  const store = new SyncStore()
  const hp = store.get('me.hp')
  
  hp(100)
  
  expect(hp.value).toBe(100)
  expect(hp()).toBe(100)
})
