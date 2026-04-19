import { test, expect } from 'bun:test'
import { Nu } from '@alaq/nucl'
import { NuFusion } from '@alaq/nucl/fusion'

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

test('NuFusion - alive strategy skips when source is undefined', () => {
  const a = Nu<number>()
  const b = Nu({ value: 100 })
  const result = NuFusion<number>()

  result.from(a, b).alive((av, bv) => av + bv)

  // a is undefined — alive strategy should not compute
  expect(result.value).toBeUndefined()

  b(200)
  expect(result.value).toBeUndefined()

  // Define a — now all sources are alive
  a(10)
  expect(result.value).toBe(210)

  b(300)
  expect(result.value).toBe(310)
})

test('NuFusion - alive strategy computes with falsy but defined values', () => {
  const enabled = Nu({ value: false })
  const data = Nu({ value: 100 })
  const result = NuFusion<number>()

  result.from(enabled, data).alive((e, d) => e ? d : 0)

  // false is not undefined — alive considers it defined, computation happens
  expect(result.value).toBe(0)

  data(200)
  expect(result.value).toBe(0)

  enabled(true)
  expect(result.value).toBe(200)

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

test('NuFusion - some (alias for alive) checks undefined, not truthiness', () => {
  const a = Nu({ value: 5 })
  const b = Nu({ value: 10 })
  const result = NuFusion<number>()

  result.from(a, b).some((av, bv) => av + bv)

  expect(result.value).toBe(15)

  // 0 is falsy but defined — alive/some still recomputes
  a(0)
  expect(result.value).toBe(10)

  a(20)
  expect(result.value).toBe(30)
})
