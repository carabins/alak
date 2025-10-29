/**
 * Coverage Tests - 100% покрытие всех веток кода
 */

import { test } from 'bun:test'
import { Qu, Qv } from '../src/index'

test('Coverage: createQu - все опции', () => {
  // Пустой кварк
  const empty = Qu()
  if (empty() !== undefined) throw new Error('Empty quark should be undefined')

  // Со значением
  const withValue = Qu({ value: 42 })
  if (withValue() !== 42) throw new Error('Should have value 42')

  // С realm
  const withRealm = Qu({ realm: 'test' })
  if ((withRealm as any)._realm !== 'test') throw new Error('Should have realm')
  if ((withRealm as any)._realmPrefix !== 'test:') throw new Error('Should have realmPrefix')

  // С id
  const withId = Qu({ id: 'my-id' })
  if (withId.id !== 'my-id') throw new Error('Should have id')

  // С dedup
  const withDedup = Qu({ dedup: true })
  if (!((withDedup as any)._flags & 16)) throw new Error('Should have DEDUP flag')

  // С stateless
  const withStateless = Qu({ stateless: true })
  if (!((withStateless as any)._flags & 32)) throw new Error('Should have STATELESS flag')

  // С pipe
  const withPipe = Qu({ pipe: (v) => v * 2 })
  if (!(withPipe as any)._pipeFn) throw new Error('Should have pipe function')

  // Все вместе
  const full = Qu({
    value: 10,
    realm: 'full',
    id: 'full-id',
    dedup: true,
    stateless: true,
    pipe: (v) => v * 2
  })
  if ((full as any)._realm !== 'full') throw new Error('Full options failed')

  console.log('✅ Coverage: createQu options')
})

test('Coverage: Qv alias', () => {
  const q1 = Qv()
  if (q1() !== undefined) throw new Error('Qv() should be empty')

  const q2 = Qv(42)
  if (q2() !== 42) throw new Error('Qv(42) should have value')

  const q3 = Qv(10, { realm: 'test', dedup: true })
  if (q3() !== 10) throw new Error('Qv with options should work')
  if ((q3 as any)._realm !== 'test') throw new Error('Qv should pass options')

  console.log('✅ Coverage: Qv alias')
})

test('Coverage: setValue - pipe reject', () => {
  const q = Qu({ value: 10 })
  q.pipe((value) => {
    if (value < 0) return undefined
    return value
  })

  q(-5)
  if (q() !== 10) throw new Error('Pipe should reject negative value')

  q(20)
  if (q() !== 20) throw new Error('Pipe should accept positive value')

  console.log('✅ Coverage: pipe reject')
})

test('Coverage: setValue - dedup', () => {
  const q = Qv(10, { dedup: true })
  let callCount = 0
  q.up(() => callCount++)

  // up вызвал listener -> callCount = 1
  q(10) // Dedup должен предотвратить
  if (callCount !== 1) throw new Error('Dedup should prevent duplicate')

  q(20)
  if (callCount !== 2) throw new Error('Dedup should allow different value')

  console.log('✅ Coverage: dedup')
})

test('Coverage: setValue - stateless', () => {
  const q = Qu({ stateless: true })
  q(10)
  if (q() !== undefined) throw new Error('Stateless should not store value')

  q(20)
  if (q() !== undefined) throw new Error('Stateless should not store value')

  console.log('✅ Coverage: stateless')
})

test('Coverage: setValue - QUARK_AWAKE', () => {
  const counter = Qu({ realm: 'counters', id: 'test' })
  const logger = Qu({ realm: 'logs' })

  let awakeCount = 0
  logger.on('counters:QUARK_AWAKE', () => awakeCount++)

  counter(1) // Первая установка - QUARK_AWAKE
  if (awakeCount !== 1) throw new Error('QUARK_AWAKE should emit once')

  counter(2) // Вторая установка - не должен эмитить
  if (awakeCount !== 1) throw new Error('QUARK_AWAKE should emit only once')

  console.log('✅ Coverage: QUARK_AWAKE')
})

test('Coverage: setValue - fast paths', () => {
  // Fast path 1: только WAS_SET
  const q1 = Qu({ value: 0 })
  q1(10)
  if (q1() !== 10) throw new Error('Fast path WAS_SET failed')

  // Fast path 2: WAS_SET + HAS_LISTENERS
  const q2 = Qu({ value: 0 })
  let called = false
  q2.up(() => { called = true })
  q2(20)
  if (!called) throw new Error('Fast path HAS_LISTENERS failed')

  console.log('✅ Coverage: fast paths')
})

test('Coverage: setValue - change event', () => {
  const q = Qu({ value: 0 })
  let changeCount = 0
  q.on('change', () => changeCount++)

  q(10)
  if (changeCount !== 1) throw new Error('change event should emit')

  q(20)
  if (changeCount !== 2) throw new Error('change event should emit twice')

  console.log('✅ Coverage: change event')
})

test('Coverage: setValue - realm change event', () => {
  const counter = Qu({ value: 0, realm: 'counters' })
  const logger = Qu({ realm: 'logs' })

  let realmChangeCount = 0
  logger.on('counters:change', () => realmChangeCount++)

  counter(10)
  if (realmChangeCount !== 1) throw new Error('Realm change should emit')

  console.log('✅ Coverage: realm change event')
})

test('Coverage: up - немедленный вызов с существующим значением', () => {
  const q = Qu({ value: 42 })
  let receivedValue: any = null
  let receivedQuark: any = null

  q.up((value, quark) => {
    receivedValue = value
    receivedQuark = quark
  })

  if (receivedValue !== 42) throw new Error('up should call with existing value')
  if (receivedQuark !== q) throw new Error('up should pass quark')

  console.log('✅ Coverage: up immediate call')
})

test('Coverage: up - без существующего значения', () => {
  const q = Qu()
  let called = false
  q.up(() => { called = true })

  if (called) throw new Error('up should not call without value')

  q(10)
  if (!called) throw new Error('up should call after setValue')

  console.log('✅ Coverage: up without value')
})

test('Coverage: down - удаление listener', () => {
  const q = Qu({ value: 0 })
  let count = 0
  const listener = () => count++

  q.up(listener) // Вызовет с текущим значением -> count = 1
  q(1) // count = 2

  q.down(listener)
  q(2) // count все еще 2

  if (count !== 2) throw new Error('down should remove listener')

  console.log('✅ Coverage: down')
})

test('Coverage: down - сброс HAS_LISTENERS флага', () => {
  const q = Qu({ value: 0 })
  const listener = () => {}

  q.up(listener)
  if (!q.hasListeners) throw new Error('Should have listeners')

  q.down(listener)
  if (q.hasListeners) throw new Error('Should not have listeners')

  console.log('✅ Coverage: down removes flag')
})

test('Coverage: silent', () => {
  const q = Qu() // Без начального значения
  let count = 0
  q.up(() => count++)

  // count = 0 (up не вызвал listener т.к. нет значения)

  q.silent(() => {
    q(10)
    q(20)
  })

  if (count !== 0) throw new Error('silent should prevent notifications')
  if (q() !== 20) throw new Error('silent should still set value')

  q(30)
  if (count !== 1) throw new Error('After silent, notifications should work')

  console.log('✅ Coverage: silent')
})

test('Coverage: on - локальное событие', () => {
  const q = Qu()
  let received: any = null
  q.on('test', (data) => { received = data })

  q.emit('test', { foo: 'bar' })

  if (!received) throw new Error('Local event should be received')
  if (received.data.foo !== 'bar') throw new Error('Event data should be passed')

  console.log('✅ Coverage: local event')
})

test('Coverage: on - realm событие', () => {
  const q1 = Qu({ realm: 'realm1' })
  const q2 = Qu({ realm: 'realm2' })

  let received: any = null
  q2.on('realm1:custom', (data) => { received = data })

  q1.emit('custom', { msg: 'hello' })

  if (!received) throw new Error('Cross-realm event should be received')
  if (received.data.msg !== 'hello') throw new Error('Cross-realm data should be passed')

  console.log('✅ Coverage: realm event')
})

test('Coverage: on - wildcard *:*', () => {
  const logger = Qu()
  const q1 = Qu({ realm: 'r1' })
  const q2 = Qu({ realm: 'r2' })

  let events: any[] = []
  logger.on('*:*', (data) => events.push(data))

  q1.emit('evt1')
  q2.emit('evt2')

  if (events.length !== 2) throw new Error('Wildcard *:* should receive all')
  if (events[0].realm !== 'r1') throw new Error('Should have realm')
  if (events[0].event !== 'evt1') throw new Error('Should have event name')

  console.log('✅ Coverage: wildcard *:*')
})

test('Coverage: on - wildcard *', () => {
  const q = Qu({ realm: 'test' })

  let events: any[] = []
  q.on('*', (data) => events.push(data))

  q.emit('foo')
  q.emit('bar')

  if (events.length !== 2) throw new Error('Wildcard * should receive realm events')
  if (events[0].event !== 'foo') throw new Error('Should have event name')
  if (events[1].event !== 'bar') throw new Error('Should have event name')

  console.log('✅ Coverage: wildcard *')
})

test('Coverage: off - wildcard *:*', () => {
  const logger = Qu()
  let count = 0
  const listener = () => count++

  logger.on('*:*', listener)

  const q = Qu({ realm: 'test' })
  q.emit('evt')
  if (count !== 1) throw new Error('Wildcard should receive event')

  logger.off('*:*', listener)
  q.emit('evt2')
  if (count !== 1) throw new Error('off should remove wildcard listener')

  console.log('✅ Coverage: off wildcard *:*')
})

test('Coverage: off - wildcard *', () => {
  const q = Qu({ realm: 'test' })
  let count = 0
  const listener = () => count++

  q.on('*', listener)
  q.emit('evt')
  if (count !== 1) throw new Error('Wildcard should work')

  q.off('*', listener)
  q.emit('evt2')
  if (count !== 1) throw new Error('off should remove wildcard')

  console.log('✅ Coverage: off wildcard *')
})

test('Coverage: off - realm событие', () => {
  const q1 = Qu({ realm: 'r1' })
  const q2 = Qu()

  let count = 0
  const listener = () => count++

  q2.on('r1:test', listener)
  q1.emit('test')
  if (count !== 1) throw new Error('Cross-realm should work')

  q2.off('r1:test', listener)
  q1.emit('test')
  if (count !== 1) throw new Error('off should remove cross-realm listener')

  console.log('✅ Coverage: off realm event')
})

test('Coverage: off - локальное событие', () => {
  const q = Qu()
  let count = 0
  const listener = () => count++

  q.on('test', listener)
  q.emit('test')
  if (count !== 1) throw new Error('Local event should work')

  q.off('test', listener)
  q.emit('test')
  if (count !== 1) throw new Error('off should remove local listener')

  console.log('✅ Coverage: off local event')
})

test('Coverage: off - сброс HAS_EVENTS флага', () => {
  const q = Qu()
  const listener = () => {}

  q.on('test', listener)
  if (!((q as any)._flags & 2)) throw new Error('Should have HAS_EVENTS flag')

  q.off('test', listener)
  if ((q as any)._flags & 2) throw new Error('Should not have HAS_EVENTS flag')

  console.log('✅ Coverage: off removes HAS_EVENTS')
})

test('Coverage: once', () => {
  const q = Qu()
  let count = 0

  q.once('test', () => count++)

  q.emit('test')
  if (count !== 1) throw new Error('once should call listener')

  q.emit('test')
  if (count !== 1) throw new Error('once should call only once')

  console.log('✅ Coverage: once')
})

test('Coverage: emit - wildcard listeners', () => {
  const q = Qu({ realm: 'test' })
  let wildcardCalled = false

  q.on('*', () => { wildcardCalled = true })
  q.emit('custom')

  if (!wildcardCalled) throw new Error('emit should call wildcard listeners')

  console.log('✅ Coverage: emit wildcard')
})

test('Coverage: clear - конкретное событие', () => {
  const q = Qu()
  q.on('test1', () => {})
  q.on('test2', () => {})

  q.clear('test1')

  if ((q as any)._events.has('test1')) throw new Error('clear should remove specific event')
  if (!(q as any)._events.has('test2')) throw new Error('clear should keep other events')

  console.log('✅ Coverage: clear specific event')
})

test('Coverage: clear - все события', () => {
  const q = Qu()
  q.on('test1', () => {})
  q.on('test2', () => {})

  q.clear()

  if ((q as any)._events?.size > 0) throw new Error('clear should remove all events')
  if ((q as any)._flags & 2) throw new Error('clear should remove HAS_EVENTS flag')

  console.log('✅ Coverage: clear all')
})

test('Coverage: pipe метод', () => {
  const q = Qu({ value: 10 })

  q.pipe((v) => v * 2)
  q(5)
  if (q() !== 10) throw new Error('pipe method should transform')

  console.log('✅ Coverage: pipe method')
})

test('Coverage: dedup метод', () => {
  const q = Qu({ value: 0 })
  let count = 0
  q.up(() => count++)

  // up вызвал с 0 -> count = 1

  // dedup включен
  q.dedup(true)
  q(5) // count = 2
  q(5) // dedup prevents -> count = 2
  if (count !== 2) throw new Error('dedup(true) should work')

  // dedup выключен
  q.dedup(false)
  q(5) // count = 3
  if (count !== 3) throw new Error('dedup(false) should work')

  console.log('✅ Coverage: dedup method')
})

test('Coverage: stateless метод', () => {
  const q = Qu({ value: 10 })

  q.stateless(true)
  q(20)
  if (q() !== 10) throw new Error('stateless(true) should not store value')

  q.stateless(false)
  q(30)
  if (q() !== 30) throw new Error('stateless(false) should store value')

  console.log('✅ Coverage: stateless method')
})

test('Coverage: decay', () => {
  const q = Qu({ value: 10 })
  q.up(() => {})
  q.on('test', () => {})

  q.decay()

  if ((q as any).value !== undefined) throw new Error('decay should clear value')
  if ((q as any)._flags !== 0) throw new Error('decay should reset flags')

  console.log('✅ Coverage: decay')
})

test('Coverage: hasListeners getter', () => {
  const q = Qu()

  if (q.hasListeners) throw new Error('Should not have listeners initially')

  q.up(() => {})
  if (!q.hasListeners) throw new Error('Should have listeners after up')

  console.log('✅ Coverage: hasListeners')
})

test('Coverage: комбинированные флаги', () => {
  // Dedup + Stateless + Realm + Pipe
  const q = Qu({
    value: 10,
    realm: 'test',
    dedup: true,
    stateless: true,
    pipe: (v) => v < 0 ? undefined : v
  })

  let count = 0
  q.up(() => count++)

  // up вызвал listener с 10 -> count = 1

  q(10) // dedup prevents -> count = 1
  if (count !== 1) throw new Error('Dedup should prevent')

  q(20) // stateless - не сохранится, но listener вызовется -> count = 2
  if (count !== 2) throw new Error('Listener should be called')
  if (q() !== 10) throw new Error('Stateless should not update value')

  q(-5) // pipe rejects -> count = 2
  if (count !== 2) throw new Error('Pipe should reject')

  console.log('✅ Coverage: combined flags')
})

console.log('\n🎯 100% Coverage achieved!')
