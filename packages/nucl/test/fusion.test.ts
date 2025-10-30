import { test, expect } from 'bun:test'
import { Nucl } from '../src/index'
import { Fusion, NeoFusion, AliveFusion, AnyFusion } from '../src/fusion'

// ============ FUSION ============

test('Fusion - basic computation', () => {
  const a = Nucl(5)
  const b = Nucl(10)

  const sum = Fusion(a, b, (av, bv) => av + bv)

  expect(sum.value).toBe(15)

  a(20)
  expect(sum.value).toBe(30)

  b(5)
  expect(sum.value).toBe(25)
})

test('Fusion - alive strategy (default)', () => {
  const enabled = Nucl(false)
  const data = Nucl(100)

  const result = Fusion(enabled, data, (e, d) => e ? d : 0)

  // Initial: enabled is false (falsy) - should not compute
  expect(result.value).toBeUndefined()

  // Set data (enabled still false)
  data(200)
  expect(result.value).toBeUndefined()

  // Enable (now truthy)
  enabled(true)
  expect(result.value).toBe(200)

  // Change data (enabled still truthy)
  data(300)
  expect(result.value).toBe(300)
})

test('Fusion - multiple sources', () => {
  const a = Nucl(1)
  const b = Nucl(2)
  const c = Nucl(3)

  const sum = Fusion(a, b, c, (av, bv, cv) => av + bv + cv)

  expect(sum.value).toBe(6)

  a(10)
  expect(sum.value).toBe(15)
})

test('Fusion - chaining', () => {
  const firstName = Nucl('John')
  const lastName = Nucl('Doe')

  const fullName = Fusion(firstName, lastName, (f, l) => `${f} ${l}`)
  const greeting = Fusion(fullName, (name) => `Hello, ${name}!`)

  expect(greeting.value).toBe('Hello, John Doe!')

  firstName('Alice')
  expect(greeting.value).toBe('Hello, Alice Doe!')
})

// ============ NEOFUSION ============

test('NeoFusion.any - recomputes on all changes', () => {
  const a = Nucl(0)
  const b = Nucl(null)

  let computeCount = 0
  const result = NeoFusion(a, b).any((av, bv) => {
    computeCount++
    return (av || 0) + (bv || 0)
  })

  expect(computeCount).toBe(1) // Initial

  a(0) // Falsy but should trigger
  expect(computeCount).toBe(2)

  b(null) // Null but should trigger
  expect(computeCount).toBe(3)
})

test('NeoFusion.alive - same as Fusion', () => {
  const a = Nucl(null)
  const b = Nucl(5)

  const result = NeoFusion(a, b).alive((av, bv) => av + bv)

  expect(result.value).toBeUndefined() // a is null

  a(10)
  expect(result.value).toBe(15)
})

// ============ ALIVEFUSION ============

test('AliveFusion - side-effect only when truthy', () => {
  const data = Nucl(null)
  let effectCount = 0
  let lastValue: any = null

  const stop = AliveFusion([data], (d) => {
    effectCount++
    lastValue = d
  })

  expect(effectCount).toBe(0) // null, no effect

  data(100)
  expect(effectCount).toBe(1)
  expect(lastValue).toBe(100)

  data(null)
  expect(effectCount).toBe(1) // No change (null)

  data(200)
  expect(effectCount).toBe(2)
  expect(lastValue).toBe(200)

  stop()

  data(300)
  expect(effectCount).toBe(2) // Stopped, no more effects
})

test('AliveFusion - multiple sources', () => {
  const user = Nucl(null)
  const settings = Nucl(null)
  let effectCount = 0

  const stop = AliveFusion([user, settings], (u, s) => {
    effectCount++
  })

  expect(effectCount).toBe(0)

  user({ id: 1 })
  expect(effectCount).toBe(0) // settings still null

  settings({ theme: 'dark' })
  expect(effectCount).toBe(1) // Both truthy now

  user({ id: 2 })
  expect(effectCount).toBe(2)

  stop()
})

// ============ ANYFUSION ============

test('AnyFusion - triggers on all changes', () => {
  const count = Nucl(0)
  let effectCount = 0
  let lastValue: any

  const stop = AnyFusion([count], (c) => {
    effectCount++
    lastValue = c
  })

  expect(effectCount).toBe(1) // Runs immediately
  expect(lastValue).toBe(0)

  count(0)
  expect(effectCount).toBe(2) // Even 0 triggers

  count(5)
  expect(effectCount).toBe(3)

  count(null as any)
  expect(effectCount).toBe(4) // null triggers

  stop()

  count(10)
  expect(effectCount).toBe(4) // Stopped
})

test('AnyFusion - form validation use case', () => {
  const email = Nucl('')
  const password = Nucl('')
  let isValid = false

  const stop = AnyFusion([email, password], (e, p) => {
    isValid = e.length > 0 && p.length >= 6
  })

  expect(isValid).toBe(false) // Empty

  email('test@test.com')
  expect(isValid).toBe(false) // Password too short

  password('123456')
  expect(isValid).toBe(true) // Both valid

  password('')
  expect(isValid).toBe(false) // Empty password

  stop()
})

// ============ AUTO-CLEANUP ============

test('Fusion auto-cleanup on source decay', () => {
  const a = Nucl(1)
  const b = Nucl(2)

  const sum = Fusion(a, b, (av, bv) => av + bv)
  expect(sum.value).toBe(3)

  // Decay source
  a.decay()

  // sum should be decayed too
  expect(sum.value).toBeUndefined()
})
