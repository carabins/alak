// /**
//  * Verification test for V8 optimization
//  * Ensures that Nv only calls Object.setPrototypeOf ONCE
//  */
//
// import { test } from 'bun:test'
// import { Nv, NvProto } from '../src/index'
// import { quarkProto } from '@alaq/quark'
//
// test('Nv prototype chain is correct', () => {
//   const n = Nv(42)
//
//   // Nv instance should have NvProto as its prototype
//   const proto = Object.getPrototypeOf(n)
//   if (proto !== NvProto) {
//     throw new Error('Nv instance prototype should be NvProto')
//   }
//
//   // NvProto should have quarkProto as its prototype
//   const protoProto = Object.getPrototypeOf(NvProto)
//   if (protoProto !== quarkProto) {
//     throw new Error('NvProto should inherit from quarkProto')
//   }
// })
//
// test('Nv inherits all Quark methods', () => {
//   const n = Nv(0)
//
//   // Check that all Quark methods are accessible
//   const methods = ['up', 'down', 'on', 'off', 'once', 'emit', 'clear', 'pipe', 'dedup', 'stateless', 'decay', 'silent']
//
//   for (const method of methods) {
//     if (typeof (n as any)[method] !== 'function') {
//       throw new Error(`Nv should have ${method} method from Quark`)
//     }
//   }
// })
//
// test('Nv functionality is identical to Quark', () => {
//   const n = Nv(0)
//
//   // Test value get/set
//   if (n.value !== 0) throw new Error('Initial value should be 0')
//   n(42)
//   if (n.value !== 42) throw new Error('Value should be updated to 42')
//
//   // Test listeners
//   let callCount = 0
//   n.up(() => callCount++)
//   // Note: up() calls listener immediately if value exists, so callCount = 1
//   if (callCount !== 1) throw new Error('Listener should be called immediately on up()')
//   n(100)
//   if (callCount !== 2) throw new Error('Listener should be called again on value change')
//   if (n.value !== 100) throw new Error('Value should be 100')
//
//   // Test events
//   let eventData: any = null
//   n.on('test', (data: any) => { eventData = data })
//   n.emit('test', { foo: 'bar' })
//   if (!eventData || eventData.data.foo !== 'bar') {
//     throw new Error('Event should be emitted correctly')
//   }
// })
//
// test('Nv options work correctly', () => {
//   // Test with options object
//   const n1 = Nv({ value: 10, id: 'test', dedup: true })
//   if (n1.value !== 10) throw new Error('Value should be 10')
//   if (n1.id !== 'test') throw new Error('ID should be "test"')
//
//   // Test dedup
//   let dupCallCount = 0
//   n1.up(() => dupCallCount++)
//   // Note: up() calls listener immediately (callCount = 1)
//   if (dupCallCount !== 1) throw new Error('Listener should be called immediately on up()')
//   n1(10) // Same value, should not trigger with dedup
//   if (dupCallCount !== 1) throw new Error('Dedup should prevent duplicate calls')
//   n1(20) // Different value
//   if (dupCallCount !== 2) throw new Error('Should trigger on different value')
//
//   // Test shorthand syntax
//   const n2 = Nv(123)
//   if (n2.value !== 123) throw new Error('Shorthand syntax should work')
// })
//
// test('Performance: Nv creation should be fast', () => {
//   // Warmup
//   for (let i = 0; i < 1000; i++) {
//     Nv(i)
//   }
//
//   // Measure
//   const iterations = 10000
//   const start = performance.now()
//   for (let i = 0; i < iterations; i++) {
//     Nv(i)
//   }
//   const time = performance.now() - start
//   const opsPerMs = iterations / time
//
//   // Should be able to create at least 1000 Nv instances per millisecond
//   // (In reality should be 6000+ in V8 with optimization, but we set a low bar for CI)
//   if (opsPerMs < 1000) {
//     throw new Error(`Nv creation too slow: ${opsPerMs.toFixed(0)} ops/ms (expected > 1000)`)
//   }
//
//   console.log(`✅ Nv creation speed: ${opsPerMs.toFixed(0)} ops/ms`)
// })
