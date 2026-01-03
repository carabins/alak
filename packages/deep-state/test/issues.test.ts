
import { test, expect } from 'bun:test'
import { createState } from '../src/index'

test('Path construction should include dot separators', () => {
  let lastPath = ''
  const state = createState((val, change) => {
    lastPath = change.path
  })
  const proxy = state.deepWatch({
    a: {
      b: {
        c: 1
      }
    }
  })

  proxy.a.b.c = 2
  
  // Current logic likely produces "abc" or similar without dots
  // We expect "a.b.c"
  expect(lastPath).toBe('a.b.c')
})

test('Array mutation (shift) should update proxy cache for indices', () => {
  const state = createState(() => {})
  const list = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const proxy = state.deepWatch(list)

  // 1. Access index 0 to create/cache the proxy
  const item0 = proxy[0]
  expect(item0.id).toBe(1)

  // 2. Mutate array (shift removes first element)
  // [ {id:1}, {id:2}, {id:3} ] -> [ {id:2}, {id:3} ]
  proxy.shift()

  // 3. Access index 0 again. It should be {id: 2} now.
  const newItem0 = proxy[0]
  
  // If cache is stale, this will fail (it will still be {id: 1})
  expect(newItem0.id).toBe(2)
})

test('Console log spam should be removed', () => {
    // This is a manual check, but we'll flag it if we see it in output.
    // Ideally we grep the source code for this.
})
