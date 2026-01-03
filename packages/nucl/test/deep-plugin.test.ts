import { test, expect } from 'bun:test'
import { Nucleus } from '../src/nucleus'
import { Nu, createNuRealm } from '../src/index'
import { deepStatePlugin } from '../src/deep-state/plugin'

test('Deep State Plugin via Nucleus', () => {
  const n = Nucleus({ a: { b: 1 } }, { deepWatch: true })

  let updateCount = 0
  n.up(() => updateCount++)

  // Deep update
  n.value.a.b = 2

  expect(n.value.a.b).toBe(2)
  expect(updateCount).toBe(1)
})

test('Deep State Plugin manually installed', () => {
  createNuRealm("custom-deep", deepStatePlugin)
  
  const n = Nu({ 
    value: { x: 10 },
    deepWatch: true,
    realm: "custom-deep"
  })

  let updateCount = 0
  n.up(() => updateCount++)

  n.value.x = 20
  expect(updateCount).toBe(1)
})

test('Deep State Plugin ignores non-deep instances', () => {
  createNuRealm("custom-mixed", deepStatePlugin)
  
  // deepWatch: false (default)
  const n = Nu({ 
    value: { x: 10 },
    realm: "custom-mixed"
  })

  let updateCount = 0
  n.up(() => updateCount++)
  
  // Initial call happens immediately
  expect(updateCount).toBe(1)

  n.value.x = 20
  
  // Should NOT trigger because deepWatch wasn't enabled for this instance
  expect(updateCount).toBe(1)
})
