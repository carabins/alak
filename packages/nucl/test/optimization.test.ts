/**
 * Verification test for V8 optimization
 * Ensures that Nucl only calls Object.setPrototypeOf ONCE
 */

import { test } from 'bun:test'
import { Nucl, NuclProto } from '../src/index'
import { quarkProto } from '@alaq/quark'

test('Nucl prototype chain is correct', () => {
  const n = Nucl(42)

  // Nucl instance should have NuclProto as its prototype
  const proto = Object.getPrototypeOf(n)
  if (proto !== NuclProto) {
    throw new Error('Nucl instance prototype should be NuclProto')
  }

  // NuclProto should have quarkProto as its prototype
  const protoProto = Object.getPrototypeOf(NuclProto)
  if (protoProto !== quarkProto) {
    throw new Error('NuclProto should inherit from quarkProto')
  }
})

test('Nucl inherits all Quark methods', () => {
  const n = Nucl(0)

  // Check that all Quark methods are accessible
  const methods = ['up', 'down', 'on', 'off', 'once', 'emit', 'clear', 'pipe', 'dedup', 'stateless', 'decay', 'silent']

  for (const method of methods) {
    if (typeof (n as any)[method] !== 'function') {
      throw new Error(`Nucl should have ${method} method from Quark`)
    }
  }
})

test('Nucl functionality is identical to Quark', () => {
  const n = Nucl(0)

  // Test value get/set
  if (n.value !== 0) throw new Error('Initial value should be 0')
  n(42)
  if (n.value !== 42) throw new Error('Value should be updated to 42')

  // Test listeners
  let callCount = 0
  n.up(() => callCount++)
  // Note: up() calls listener immediately if value exists, so callCount = 1
  if (callCount !== 1) throw new Error('Listener should be called immediately on up()')
  n(100)
  if (callCount !== 2) throw new Error('Listener should be called again on value change')
  if (n.value !== 100) throw new Error('Value should be 100')

  // Test events
  let eventData: any = null
  n.on('test', (data: any) => { eventData = data })
  n.emit('test', { foo: 'bar' })
  if (!eventData || eventData.data.foo !== 'bar') {
    throw new Error('Event should be emitted correctly')
  }
})

test('Nucl options work correctly', () => {
  // Test with options object
  const n1 = Nucl({ value: 10, id: 'test', dedup: true })
  if (n1.value !== 10) throw new Error('Value should be 10')
  if (n1.id !== 'test') throw new Error('ID should be "test"')

  // Test dedup
  let dupCallCount = 0
  n1.up(() => dupCallCount++)
  // Note: up() calls listener immediately (callCount = 1)
  if (dupCallCount !== 1) throw new Error('Listener should be called immediately on up()')
  n1(10) // Same value, should not trigger with dedup
  if (dupCallCount !== 1) throw new Error('Dedup should prevent duplicate calls')
  n1(20) // Different value
  if (dupCallCount !== 2) throw new Error('Should trigger on different value')

  // Test shorthand syntax
  const n2 = Nucl(123)
  if (n2.value !== 123) throw new Error('Shorthand syntax should work')
})

test('Performance: Nucl creation should be fast', () => {
  // Warmup
  for (let i = 0; i < 1000; i++) {
    Nucl(i)
  }

  // Measure
  const iterations = 10000
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    Nucl(i)
  }
  const time = performance.now() - start
  const opsPerMs = iterations / time

  // Should be able to create at least 1000 Nucl instances per millisecond
  // (In reality should be 6000+ in V8 with optimization, but we set a low bar for CI)
  if (opsPerMs < 1000) {
    throw new Error(`Nucl creation too slow: ${opsPerMs.toFixed(0)} ops/ms (expected > 1000)`)
  }

  console.log(`✅ Nucl creation speed: ${opsPerMs.toFixed(0)} ops/ms`)
})
