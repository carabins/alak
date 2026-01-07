/**
 * Test new Nucl API
 */

import { test, expect } from 'bun:test'
import { Nu } from '@alaq/nucl'
import { stdPlugin } from '@alaq/nucl/std/plugin'
import { createDeepPlugin } from '@alaq/nucl/deep-state/plugin'
import { fusionPlugin } from '@alaq/nucl/fusion/plugin'

// Import fusion functions
import { fusion, NuFusion, aliveFusion, anyFusion } from '@alaq/nucl/fusion'

const stdDeepPlugins = [stdPlugin, createDeepPlugin()]

test('Nu - minimal default kind', () => {
  const n = Nu({ value: 42 }); expect(n.value).toBe(42)

  n(100)
  expect(n.value).toBe(100)
})

test('Std Kind - array methods', () => {
  const arr = Nu({ value: [1, 2, 3], plugins: [stdPlugin] })

  expect(arr.value).toEqual([1, 2, 3])
  expect(arr.size).toBe(3)

  arr.push(4)
  expect(arr.value).toEqual([1, 2, 3, 4])
  expect(arr.size).toBe(4)

  const last = arr.pop()
  expect(last).toBe(4)
  expect(arr.size).toBe(3)
})

test('Std Kind - object methods', () => {
  const obj = Nu({ value: { name: 'John' }, plugins: [stdPlugin] })

  expect(obj.value).toEqual({ name: 'John' })
  expect(obj.keys).toEqual(['name'])

  obj.set('age', 25)
  expect(obj.value).toEqual({ name: 'John', age: 25 })
  expect(obj.keys).toEqual(['name', 'age'])

  expect(obj.get('name')).toBe('John')
})

test('Std Kind - universal methods', () => {
  const n = Nu({ value: 0, plugins: [stdPlugin] })

  expect(n.isEmpty).toBe(true)

  n(42)
  expect(n.isEmpty).toBe(false)
})

test('fusion - standalone builder with alive strategy', () => {
  const a = Nu({ value: 1 })
  const b = Nu({ value: 2 })

  const sum = fusion(a, b).alive((a, b) => a + b)
  expect(sum.value).toBe(3)

  a(10)
  expect(sum.value).toBe(12)
})

test('fusion - standalone builder with any strategy', () => {
  const a = Nu({ value: null })
  const b = Nu({ value: 2 })

  const result = fusion(a, b).any((a, b) => (a || 0) + b)
  expect(result.value).toBe(2) // null becomes 0

  a(5)
  expect(result.value).toBe(7)
})

test('NuFusion - Nucl-based builder with alive', () => {
  const a = Nu({ value: 2 })
  const b = Nu({ value: 3 })

  const product = NuFusion<number>({ plugins: [fusionPlugin] })
  product.from(a, b).alive((a, b) => a * b)

  expect(product.value).toBe(6)

  a(4)
  expect(product.value).toBe(12)
})

test('NuFusion - Nucl-based builder with some (alias for alive)', () => {
  const a = Nu({ value: 2 })
  const b = Nu({ value: 3 })

  const product = NuFusion<number>({ plugins: [fusionPlugin] })
  product.from(a, b).some((a, b) => a * b)

  expect(product.value).toBe(6)
})

test('NuFusion - Nucl-based builder with any', () => {
  const a = Nu({ value: null })
  const b = Nu({ value: 5 })

  const safe = NuFusion<number>({ plugins: [fusionPlugin] })
  safe.from(a, b).any((a, b) => (a || 0) + b)

  expect(safe.value).toBe(5)

  a(10)
  expect(safe.value).toBe(15)
})

test('aliveFusion - effect without creating Nucl', () => {
  const a = Nu({ value: 1 })
  const b = Nu({ value: 2 })

  let effectCount = 0
  let lastValues: [number, number] | null = null

  const decay = aliveFusion([a, b], (a: number, b: number) => {
    effectCount++
    lastValues = [a, b]
  })

  // Effect runs immediately
  expect(effectCount).toBe(1)
  expect(lastValues).toEqual([1, 2])

  // Effect runs on change
  a(10)
  expect(effectCount).toBe(2)
  expect(lastValues).toEqual([10, 2])

  // Cleanup
  decay()
})

test('anyFusion - effect that runs even with falsy values', () => {
  const a = Nu({ value: null })
  const b = Nu({ value: 2 })

  let effectCount = 0

  const decay = anyFusion([a, b], (a: any, b: number) => {
    effectCount++
  })

  // Runs immediately even though a is null
  expect(effectCount).toBe(1)

  // Runs on change
  a(5)
  expect(effectCount).toBe(2)

  decay()
})
