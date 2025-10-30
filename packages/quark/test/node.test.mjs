/**
 * Node.js Runtime Test - проверка работы в чистом Node.js
 *
 * Запуск: node test/node.test.mjs
 */

import { Qu, Qv } from '../dist/quark.mjs'

const createQu = Qu

let testsPassed = 0
let testsFailed = 0

function assert(condition, message) {
  if (!condition) {
    console.error('❌', message)
    testsFailed++
    throw new Error(message)
  } else {
    console.log('✅', message)
    testsPassed++
  }
}

function test(name, fn) {
  console.log(`\n🧪 ${name}`)
  try {
    fn()
  } catch (error) {
    console.error(`💥 Test failed: ${error.message}`)
  }
}

// ============================================================================
// TESTS
// ============================================================================

test('Node.js: Basic creation', () => {
  const q = createQu()
  assert(q.value === undefined, 'Empty quark should have undefined value')

  const q2 = createQu({ value: 42 })
  assert(q2.value === 42, 'Quark should have initial value 42')
})

test('Node.js: Qv alias', () => {
  const q = Qv(100)
  assert(q.value === 100, 'Qv should create quark with value')
})

test('Node.js: Get/Set', () => {
  const counter = Qv(0)
  assert(counter.value === 0, 'Initial value should be 0')

  counter(10)
  assert(counter.value === 10, 'Value should be updated to 10')

  counter(20)
  assert(counter.value === 20, 'Value should be updated to 20')
})

test('Node.js: Listeners', () => {
  const q = Qv(0)
  let callCount = 0
  let lastValue = null

  q.up((value) => {
    callCount++
    lastValue = value
  })

  assert(callCount === 1, 'Listener should be called immediately with existing value')
  assert(lastValue === 0, 'Listener should receive initial value 0')

  q(5)
  assert(callCount === 2, 'Listener should be called on update')
  assert(lastValue === 5, 'Listener should receive new value 5')
})

test('Node.js: Multiple listeners', () => {
  const q = Qv(0)
  let count1 = 0
  let count2 = 0

  q.up(() => count1++)
  q.up(() => count2++)

  // Both called immediately
  assert(count1 === 1, 'First listener called')
  assert(count2 === 1, 'Second listener called')

  q(10)
  assert(count1 === 2, 'First listener called on update')
  assert(count2 === 2, 'Second listener called on update')
})

test('Node.js: down() removes listener', () => {
  const q = Qv(0)
  let count = 0
  const listener = () => count++

  q.up(listener) // count = 1 (immediate call)
  q(5) // count = 2

  q.down(listener)
  q(10) // count still 2

  assert(count === 2, 'Listener should not be called after down()')
})

test('Node.js: dedup mode', () => {
  const q = Qv(10, { dedup: true })
  let callCount = 0

  q.up(() => callCount++)
  assert(callCount === 1, 'Listener called immediately')

  q(10) // Same value - should not trigger
  assert(callCount === 1, 'Dedup should prevent duplicate notifications')

  q(20) // Different value
  assert(callCount === 2, 'Different value should trigger')
})

test('Node.js: stateless mode', () => {
  const q = createQu({ stateless: true })
  let received = []

  q.up((value) => received.push(value))

  q('event1')
  q('event2')

  assert(received.length === 2, 'Stateless should still notify')
  assert(q.value === undefined, 'Stateless should not store value')
})

test('Node.js: pipe transform', () => {
  const q = Qv(0)
  q.pipe((value) => {
    if (value < 0) return undefined
    return Math.round(value)
  })

  q(5.7)
  assert(q.value === 6, 'Pipe should round value')

  q(-10)
  assert(q.value === 6, 'Pipe should reject negative value')
})

test('Node.js: Events - local', () => {
  const q = createQu()
  let received = null

  q.on('test', (data) => {
    received = data
  })

  q.emit('test', { foo: 'bar' })

  assert(received !== null, 'Event should be received')
  assert(received.data.foo === 'bar', 'Event data should be passed')
})

test('Node.js: Events - realm', () => {
  const q1 = createQu({ realm: 'r1', id: 'q1' })
  const q2 = createQu({ realm: 'r2' })

  let received = null

  q2.on('r1:custom', (data) => {
    received = data
  })

  q1.emit('custom', { msg: 'hello' })

  assert(received !== null, 'Cross-realm event should be received')
  assert(received.data.msg === 'hello', 'Cross-realm data should be passed')
})

test('Node.js: QUARK_AWAKE event', () => {
  const counter = createQu({ realm: 'counters', id: 'test' })
  const logger = createQu({ realm: 'logs' })

  let awakeCount = 0
  let awakeData = null

  logger.on('counters:QUARK_AWAKE', (data) => {
    awakeCount++
    awakeData = data
  })

  counter(1) // First set - should emit QUARK_AWAKE
  assert(awakeCount === 1, 'QUARK_AWAKE should emit once')
  assert(awakeData.id === 'test', 'QUARK_AWAKE should have id')

  counter(2) // Second set - should NOT emit
  assert(awakeCount === 1, 'QUARK_AWAKE should only emit once')
})

test('Node.js: Performance - rapid updates', () => {
  const q = Qv(0)
  let callCount = 0

  q.up(() => callCount++)

  const start = Date.now()
  for (let i = 0; i < 10000; i++) {
    q(i)
  }
  const time = Date.now() - start

  assert(callCount === 10001, 'All updates should trigger listener') // +1 for immediate call
  assert(time < 100, `Performance should be good: ${time}ms for 10k updates`)

  console.log(`   ⚡ Performance: ${time}ms for 10,000 updates`)
})

test('Node.js: silent() blocks notifications', () => {
  const q = Qv(0)
  let count = 0

  q.up(() => count++)
  assert(count === 1, 'Immediate call')

  q.silent(() => {
    q(10)
    q(20)
    q(30)
  })

  assert(count === 1, 'silent() should block notifications')
  assert(q.value === 30, 'Value should still be updated')

  q(40)
  assert(count === 2, 'Notifications should work after silent()')
})

test('Node.js: decay() cleanup', () => {
  const q = Qv(10)
  q.up(() => {})
  q.on('test', () => {})

  q.decay()

  assert(q.value === undefined, 'decay() should clear value')
  assert(!q.hasListeners, 'decay() should clear listeners')
})

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(80))
console.log('📊 Node.js Test Summary')
console.log('='.repeat(80))
console.log(`✅ Passed: ${testsPassed}`)
console.log(`❌ Failed: ${testsFailed}`)
console.log(`📈 Total:  ${testsPassed + testsFailed}`)

if (testsFailed === 0) {
  console.log('\n🎉 All Node.js tests passed!')
  process.exit(0)
} else {
  console.log('\n💥 Some tests failed!')
  process.exit(1)
}
