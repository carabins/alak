import { test, expect } from 'bun:test'
import { Nucl } from '../src/index'

test('fusion method - basic computation with alive strategy', () => {
  const a = Nucl(5)
  const b = Nucl(10)
  const result = Nucl(0) // Start with an existing nucleon

  result.fusion(a, b, 'alive', (av, bv) => av + bv)

  expect(result.value).toBe(15)

  a(20)
  expect(result.value).toBe(30)

  b(5)
  expect(result.value).toBe(25)
})

test('fusion method - basic computation with any strategy', () => {
  const a = Nucl(5)
  const b = Nucl(10)
  const result = Nucl(0) // Start with an existing nucleon

  result.fusion(a, b, 'any', (av, bv) => av + bv)

  expect(result.value).toBe(15)

  a(20)
  expect(result.value).toBe(30)

  b(5)
  expect(result.value).toBe(25)
})

test('fusion method - alive strategy behavior', () => {
  const enabled = Nucl(false)
  const data = Nucl(100)
  const result = Nucl(0)

  result.fusion(enabled, data, 'alive', (e, d) => e ? d : 0)

  // Initial: enabled is false (falsy) - with alive strategy, result should be undefined or initial state
  // Since the initial computation happens immediately, with enabled=false (falsy), 
  // the strategy should prevent the update, so result should remain the original value (0)
  expect(result.value).toBe(0)

  // With alive strategy, result should remain unchanged since enabled is falsy
  data(200)
  expect(result.value).toBe(0) // Still 0 because enabled is falsy

  // Enable (now truthy)
  enabled(true)
  expect(result.value).toBe(200) // Now it should compute

  // Change data (enabled still truthy)
  data(300)
  expect(result.value).toBe(300)
})

test('fusion method - any strategy behavior (always recomputes)', () => {
  const a = Nucl(0)
  const b = Nucl(null)
  const result = Nucl(0)

  result.fusion(a, b, 'any', (av, bv) => (av || 0) + (bv || 0))

  expect(result.value).toBe(0) // Initial value computed

  a(0) // Falsy but should trigger with 'any' strategy
  expect(result.value).toBe(0)

  b(5) // Should trigger
  expect(result.value).toBe(5)
})

test('fusion method - multiple sources', () => {
  const a = Nucl(1)
  const b = Nucl(2)
  const c = Nucl(3)
  const result = Nucl(0)

  result.fusion(a, b, c, 'alive', (av, bv, cv) => av + bv + cv)

  expect(result.value).toBe(6)

  a(10)
  expect(result.value).toBe(15)
})

test('fusion method - chaining with existing nucleon', () => {
  const firstName = Nucl('John')
  const lastName = Nucl('Doe')
  const fullName = Nucl('')

  fullName.fusion(firstName, lastName, 'alive', (f, l) => `${f} ${l}`)
  const greeting = Nucl('').fusion(fullName, 'alive', (name) => `Hello, ${name}!`)

  expect(greeting.value).toBe('Hello, John Doe!')

  firstName('Alice')
  expect(greeting.value).toBe('Hello, Alice Doe!')
})

test('fusion method - default strategy is alive', () => {
  const a = Nucl(5)
  const b = Nucl(10)
  const result = Nucl(0) // Initial value

  // Omitting the strategy should default to 'alive'
  result.fusion(a, b, (av, bv) => av + bv)

  expect(result.value).toBe(15) // Initial computation should happen

  // Set a to falsy value - should not trigger computation with alive strategy
  a(0) // 0 is falsy, so with alive strategy, result should not change
  expect(result.value).toBe(15) // Should remain 15 if using alive strategy
})

test('fusion method - auto-cleanup on source decay', () => {
  const a = Nucl(1)
  const b = Nucl(2)
  const result = Nucl(0)

  result.fusion(a, b, 'alive', (av, bv) => av + bv)
  expect(result.value).toBe(3)

  // Decay source - this should trigger cleanup
  a.decay()

  // result nucleon should be decayed too since sources are no longer available
  // Check that the behavior is as expected after source decay
})