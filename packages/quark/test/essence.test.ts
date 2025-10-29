/**
 * Essence Tests - суть проекта Quark
 */

import { test } from 'bun:test'
import { Qu, Qv } from '../src/index'

test('ESSENCE 1: High-Performance Reactive Container', () => {
  // Создание с пустым значением
  const counter = Qu()
  if (counter() !== undefined) throw new Error('Empty quark should be undefined')

  // Lazy initialization - listeners создаются только когда нужны
  if (counter.hasListeners) throw new Error('Should not have listeners initially')
  if ((counter as any).listeners) throw new Error('Listeners should not be initialized')

  // Подписка и немедленное получение текущего значения
  let callCount = 0
  let lastValue: any = null

  counter.up((value, quark) => {
    callCount++
    lastValue = value
  })

  // Listener не вызвался т.к. значение не было установлено
  if (callCount !== 0) throw new Error('Listener should not be called for empty quark')

  // Установка значения - триггерит listener
  counter(10)
  if (callCount !== 1) throw new Error('Listener should be called once')
  if (lastValue !== 10) throw new Error('Listener should receive value 10')

  // Performance: Fast path - нет listeners
  const fast = Qv(0)
  const start = Date.now()
  for (let i = 0; i < 100000; i++) {
    fast(i)
  }
  const time = Date.now() - start
  if (time > 50) throw new Error(`Fast path too slow: ${time}ms`)

  console.log(`✅ ESSENCE 1: Performance ${time}ms for 100k ops`)
})

test('ESSENCE 2: Quantum Bus - междоменная связь через realms', () => {
  // Кварки в разных realms
  const counter = Qv(0, { realm: 'counters', id: 'main-counter' })
  const timer = Qv(0, { realm: 'timers', id: 'main-timer' })
  const logger = Qu({ realm: 'logs', id: 'logger' })

  let awakeEvents: any[] = []
  let counterEvents: any[] = []
  let allRealmEvents: any[] = []

  // 1. QUARK_AWAKE - событие первой установки значения
  logger.on('counters:QUARK_AWAKE', (data) => {
    awakeEvents.push(data)
  })

  counter(5) // Первая установка - должен сработать QUARK_AWAKE
  if (awakeEvents.length !== 1) throw new Error('QUARK_AWAKE should be emitted once')
  if (awakeEvents[0].id !== 'main-counter') throw new Error('QUARK_AWAKE should have id')
  if (awakeEvents[0].value !== 5) throw new Error('QUARK_AWAKE should have value')

  counter(10) // Вторая установка - QUARK_AWAKE не должен сработать
  if (awakeEvents.length !== 1) throw new Error('QUARK_AWAKE should be emitted only once')

  // 2. Подписка на конкретное событие другого realm
  timer.on('counters:increment', (data) => {
    counterEvents.push(data)
  })

  counter.emit('increment', { delta: 1 })
  if (counterEvents.length !== 1) throw new Error('Cross-realm event should work')
  if (counterEvents[0].id !== 'main-counter') throw new Error('Event should include id')
  if (counterEvents[0].data.delta !== 1) throw new Error('Event should include data')

  // 3. Wildcard: on('*:*') - все события всех realms
  logger.on('*:*', (data) => {
    allRealmEvents.push(data)
  })

  counter.emit('test', 'counter-test')
  timer.emit('test', 'timer-test')

  if (allRealmEvents.length !== 2) throw new Error('Wildcard should receive all realm events')
  if (allRealmEvents[0].realm !== 'counters') throw new Error('Event should have realm')
  if (allRealmEvents[0].event !== 'test') throw new Error('Event should have event name')
  if (allRealmEvents[1].realm !== 'timers') throw new Error('Event should have realm')

  // 4. Wildcard: on('*') - все события текущего realm
  let realmWildcardEvents: any[] = []
  counter.on('*', (data) => {
    realmWildcardEvents.push(data)
  })

  counter.emit('foo')
  counter.emit('bar')

  if (realmWildcardEvents.length !== 2) throw new Error('Realm wildcard should receive all events')
  if (realmWildcardEvents[0].event !== 'foo') throw new Error('Should have event name')
  if (realmWildcardEvents[1].event !== 'bar') throw new Error('Should have event name')

  // 5. Lazy events - структуры создаются только когда используются
  const unused = Qv(0)
  if ((unused as any)._events) throw new Error('Events should not be initialized when not used')

  const used = Qv(0)
  used.on('test', () => {})
  if (!(used as any)._events) throw new Error('Events should be initialized when used')

  console.log('✅ ESSENCE 2: Quantum Bus works correctly')
})

test('ESSENCE 3: pipe, dedup, stateless', () => {
  // 1. pipe - трансформация и валидация
  const age = Qv(0)
  age.pipe((value) => {
    if (value < 0 || value > 150) return undefined // guard
    return Math.round(value) // modifier
  })

  age(25.7)
  if (age() !== 26) throw new Error('pipe should round value')

  age(-5)
  if (age() !== 26) throw new Error('pipe should reject negative value')

  age(200)
  if (age() !== 26) throw new Error('pipe should reject value > 150')

  // 2. dedup - дедупликация
  const name = Qv('John', { dedup: true })
  let nameCallCount = 0
  name.up(() => {
    nameCallCount++
  })

  // up() вызвал listener с текущим значением 'John' -> nameCallCount = 1
  if (nameCallCount !== 1) throw new Error('up should call listener with existing value')

  name('John') // То же значение - не должен вызваться благодаря dedup
  if (nameCallCount !== 1) throw new Error('dedup should prevent duplicate notifications')

  name('Jane')
  if (nameCallCount !== 2) throw new Error('dedup should allow different values')

  // 3. stateless - не хранить значение
  const bus = Qu({ stateless: true })
  let busValues: any[] = []

  bus.up((value) => {
    busValues.push(value)
  })

  bus('event1')
  bus('event2')

  if (busValues.length !== 2) throw new Error('stateless should still notify listeners')
  if (busValues[0] !== 'event1') throw new Error('stateless should pass correct value')
  if (bus() !== undefined) throw new Error('stateless should not store value')

  // 4. Методы для динамического изменения
  const counter = Qv(0)
  counter.dedup(true)

  let counterCalls = 0
  counter.up(() => {
    counterCalls++
  })

  // up() вызвал listener с 0 -> counterCalls = 1
  counter(5) // counterCalls = 2
  counter(5) // dedup предотвращает, counterCalls остается 2
  if (counterCalls !== 2) throw new Error('dedup() method should work')

  counter.dedup(false)
  counter(5) // counterCalls = 3 (dedup выключен)
  if (counterCalls !== 3) throw new Error('dedup(false) should disable dedup')

  console.log('✅ ESSENCE 3: pipe, dedup, stateless work correctly')
})
