import { test, expect } from 'bun:test'
import { Nv } from '@alaq/nucl'
import { fusion, aliveFusion, anyFusion } from '@alaq/nucl/fusion'

// ============ FUSION ============

test('fusion.alive - basic computation', () => {
  const a = Nv(5)
  const b = Nv(10)

  const sum = fusion(a, b).alive((av, bv) => av + bv)

  expect(sum.value).toBe(15)

  a(20)
  expect(sum.value).toBe(30)

  b(5)
  expect(sum.value).toBe(25)
})

//
// test('fusion.alive - alive strategy (default)', () => {
//   const enabled = Nv(false)
//   const data = Nv(100)
//
//   const result = fusion(enabled, data).alive((e, d) => e ? d : 0)
//
//   // Initial: enabled is false (falsy) - should not compute
//   expect(result.value).toBeUndefined()
//
//   // Set data (enabled still false)
//   data(200)
//   expect(result.value).toBeUndefined()
//
//   // Enable (now truthy)
//   enabled(true)
//   expect(result.value).toBe(200)
//
//   // Change data (enabled still truthy)
//   data(300)
//   expect(result.value).toBe(300)
// })
//
// test('fusion.alive - multiple sources', () => {
//   const a = Nv(1)
//   const b = Nv(2)
//   const c = Nv(3)
//
//   const sum = fusion(a, b, c).alive((av, bv, cv) => av + bv + cv)
//
//   expect(sum.value).toBe(6)
//
//   a(10)
//   expect(sum.value).toBe(15)
// })
//
// test('fusion.alive - chaining', () => {
//   const firstName = Nv('John')
//   const lastName = Nv('Doe')
//
//   const fullName = fusion(firstName, lastName).alive((f, l) => `${f} ${l}`)
//   const greeting = fusion(fullName).alive((name) => `Hello, ${name}!`)
//
//   expect(greeting.value).toBe('Hello, John Doe!')
//
//   firstName('Alice')
//   expect(greeting.value).toBe('Hello, Alice Doe!')
// })
//
// // ============ FUSION.ANY ============
//
// test('fusion.any - recomputes on all changes', () => {
//   const a = Nv(0)
//   const b = Nv(null)
//
//   let computeCount = 0
//   const result = fusion(a, b).any((av, bv) => {
//     computeCount++
//     return (av || 0) + (bv || 0)
//   })
//
//   expect(computeCount).toBe(1) // Initial
//
//   a(0) // Falsy but should trigger
//   expect(computeCount).toBe(2)
//
//   b(null) // Null but should trigger
//   expect(computeCount).toBe(3)
// })
//
// test('fusion.alive - same behavior', () => {
//   const a = Nv(null)
//   const b = Nv(5)
//
//   const result = fusion(a, b).alive((av, bv) => av + bv)
//
//   expect(result.value).toBeUndefined() // a is null
//
//   a(10)
//   expect(result.value).toBe(15)
// })
//
// // ============ ALIVEFUSION ============
//
// test('aliveFusion - side-effect only when truthy', () => {
//   const data = Nv(null)
//   let effectCount = 0
//   let lastValue: any = null
//
//   const decay = aliveFusion([data], (d) => {
//     effectCount++
//     lastValue = d
//   })
//
//   expect(effectCount).toBe(0) // null, no effect
//
//   data(100)
//   expect(effectCount).toBe(1)
//   expect(lastValue).toBe(100)
//
//   data(null)
//   expect(effectCount).toBe(1) // No change (null)
//
//   data(200)
//   expect(effectCount).toBe(2)
//   expect(lastValue).toBe(200)
//
//   decay()
//
//   data(300)
//   expect(effectCount).toBe(2) // Stopped, no more effects
// })
//
// test('aliveFusion - multiple sources', () => {
//   const user = Nv(null)
//   const settings = Nv(null)
//   let effectCount = 0
//
//   const decay = aliveFusion([user, settings], (u, s) => {
//     effectCount++
//   })
//
//   expect(effectCount).toBe(0)
//
//   user({ id: 1 })
//   expect(effectCount).toBe(0) // settings still null
//
//   settings({ theme: 'dark' })
//   expect(effectCount).toBe(1) // Both truthy now
//
//   user({ id: 2 })
//   expect(effectCount).toBe(2)
//
//   decay()
// })
//
// // ============ ANYFUSION ============
//
// test('anyFusion - triggers on all changes', () => {
//   const count = Nv(0)
//   let effectCount = 0
//   let lastValue: any
//
//   const decay = anyFusion([count], (c) => {
//     effectCount++
//     lastValue = c
//   })
//
//   expect(effectCount).toBe(1) // Runs immediately
//   expect(lastValue).toBe(0)
//
//   count(0)
//   expect(effectCount).toBe(2) // Even 0 triggers
//
//   count(5)
//   expect(effectCount).toBe(3)
//
//   count(null as any)
//   expect(effectCount).toBe(4) // null triggers
//
//   decay()
//
//   count(10)
//   expect(effectCount).toBe(4) // Stopped
// })

// test('anyFusion - form validation use case', () => {
//   const email = Nv('')
//   const password = Nv('')
//   let isValid = false
//
//   const decay = anyFusion([email, password], (e, p) => {
//     isValid = e.length > 0 && p.length >= 6
//   })
//
//   expect(isValid).toBe(false) // Empty
//
//   email('test@test.com')
//   expect(isValid).toBe(false) // Password too short
//
//   password('123456')
//   expect(isValid).toBe(true) // Both valid
//
//   password('')
//   expect(isValid).toBe(false) // Empty password
//
//   decay()
// })
//
// // ============ AUTO-CLEANUP ============
//
// test('fusion auto-cleanup on source decay', () => {
//   const a = Nv(1)
//   const b = Nv(2)
//
//   const sum = fusion(a, b).alive((av, bv) => av + bv)
//   expect(sum.value).toBe(3)
//
//   // Decay source
//   a.decay()
//
//   // sum should be decayed too
//   expect(sum.value).toBeUndefined()
// })
