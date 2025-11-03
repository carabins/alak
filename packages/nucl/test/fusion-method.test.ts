import { test, expect } from 'bun:test'
import { Nu } from '../src/index'
import { NuFusion } from '../src/fusion'

// NuFusion provides .from() API instead of .fusion()
test('NuFusion - basic computation with alive strategy', () => {
  const a = Nu({ value: 5 })
  const b = Nu({ value: 10 })
  const result = NuFusion<number>()

  result.from(a, b).alive((av, bv) => av + bv)

  expect(result.value).toBe(15)

  a(20)
  expect(result.value).toBe(30)

  b(5)
  expect(result.value).toBe(25)
})

test('NuFusion - basic computation with any strategy', () => {
  const a = Nu({ value: 5 })
  const b = Nu({ value: 10 })
  const result = NuFusion<number>()

  result.from(a, b).any((av, bv) => av + bv)

  expect(result.value).toBe(15)

  a(20)
  expect(result.value).toBe(30)

  b(5)
  expect(result.value).toBe(25)
})

test('NuFusion - alive strategy behavior', () => {
  const enabled = Nu({ value: false })
  const data = Nu({ value: 100 })
  const result = NuFusion<number>()

  result.from(enabled, data).alive((e, d) => e ? d : 0)

  // Initial: enabled is false (falsy) - alive strategy should not compute
  expect(result.value).toBeUndefined()

  // With alive strategy, result should remain unchanged since enabled is falsy
  data(200)
  expect(result.value).toBeUndefined()

  // Enable (now truthy)
  enabled(true)
  expect(result.value).toBe(200) // Now it should compute

  // Change data (enabled still truthy)
  data(300)
  expect(result.value).toBe(300)
})

test('NuFusion - any strategy behavior (always recomputes)', () => {
  const a = Nu({ value: 0 })
  const b = Nu({ value: null })
  const result = NuFusion<number>()

  result.from(a, b).any((av, bv) => (av || 0) + (bv || 0))

  expect(result.value).toBe(0) // Initial value computed

  a(0) // Falsy but should trigger with 'any' strategy
  expect(result.value).toBe(0)

  b(5) // Should trigger
  expect(result.value).toBe(5)
})

test('NuFusion - multiple sources', () => {
  const a = Nu({ value: 1 })
  const b = Nu({ value: 2 })
  const c = Nu({ value: 3 })
  const result = NuFusion<number>()

  result.from(a, b, c).alive((av, bv, cv) => av + bv + cv)

  expect(result.value).toBe(6)

  a(10)
  expect(result.value).toBe(15)
})

test('NuFusion - some (alias for alive)', () => {
  const a = Nu({ value: 5 })
  const b = Nu({ value: 10 })
  const result = NuFusion<number>()

  result.from(a, b).some((av, bv) => av + bv)

  expect(result.value).toBe(15) // Initial computation should happen

  // Set a to falsy value - should not trigger computation with some strategy
  a(0) // 0 is falsy, so with some strategy, computation doesn't happen
  expect(result.value).toBe(15) // Should remain 15 (no update when source is falsy)

  // Set a to truthy again
  a(20)
  expect(result.value).toBe(30) // Should compute again
})
