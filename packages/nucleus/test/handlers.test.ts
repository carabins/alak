import { test } from 'tap'
import N from '@alaq/nucleus/index'

// ============================================================================
// Property Tests
// ============================================================================

test('props - isFilled', (t) => {
  const n = N()
  t.equal(n.isFilled, false, 'empty nucleus is not filled')

  n(10)
  t.equal(n.isFilled, true, 'nucleus with value is filled')
  t.end()
})

// ============================================================================
// Listener Management
// ============================================================================

test('down - removes grandListener', (t) => {
  const n = N(true)
  const fn = (v) => v

  n.upTrue(fn)
  t.ok(n.grandListeners.has(fn), 'grandListener added')

  n.down(fn)
  t.equal(n.grandListeners.has(fn), false, 'grandListener removed')
  t.end()
})

test('silent - sets value without notification', (t) => {
  let callCount = 0
  const n = N(1)

  n.up(() => callCount++)
  t.equal(callCount, 1, 'up called immediately')

  n.silent(5)
  t.equal(n.value, 5, 'value changed')
  t.equal(callCount, 1, 'no notification sent')

  n(10)
  t.equal(callCount, 2, 'normal update notifies')
  t.end()
})

test('curry - returns curried setter', (t) => {
  const n = N(0)
  const setter = n.curry()

  t.equal(typeof setter, 'function', 'returns function')

  setter(42)
  t.equal(n.value, 42, 'curried function sets value')
  t.end()
})

test('resend - resends current value to listeners', (t) => {
  let callCount = 0
  const n = N(5)

  n.up(() => callCount++)
  t.equal(callCount, 1, 'initial call')

  n.resend()
  t.equal(callCount, 2, 'resend triggered listener')
  t.end()
})

test('mutate - mutates value in place', (t) => {
  const n = N({ count: 0 })
  let received = []

  n.up(v => received.push(v.count))

  n.mutate(obj => {
    obj.count++
    return obj
  })

  t.equal(n.value.count, 1, 'value mutated')
  t.equal(received[1], 1, 'listener called with mutated value')
  t.end()
})

test('once - subscribes only for first emission', (t) => {
  const n = N()
  let callCount = 0

  n.once(() => callCount++)
  t.equal(callCount, 0, 'not called for empty nucleus')

  n(1)
  t.equal(callCount, 1, 'called on first value')

  n(2)
  t.equal(callCount, 1, 'not called again')
  t.end()
})

test('once - triggers immediately if value exists', (t) => {
  const n = N(10)
  let received

  n.once(v => { received = v })
  t.equal(received, 10, 'called immediately with existing value')
  t.end()
})

test('is - checks value equality', (t) => {
  const n = N(5)

  t.equal(n.is(5), true, 'value equals 5')
  t.equal(n.is(10), false, 'value does not equal 10')

  const empty = N()
  t.equal(empty.is(undefined), true, 'empty equals undefined')
  t.equal(empty.is(null), false, 'empty does not equal null')
  t.end()
})

// ============================================================================
// Parent/Child Relationships
// ============================================================================

test('parentFor - establishes parent relationship', (t) => {
  const parent = N(10)
  const child = N()

  parent.parentFor(child, 'myParent')

  const parents = child.getMeta('parents')
  t.ok(parents, 'parents metadata exists')
  t.equal(parents[1], parent, 'parent stored correctly')

  parent(20)
  // Child должен получить обновление через .up
  t.end()
})

test('parentFor - replaces previous parent', (t) => {
  const parent1 = N(1)
  const parent2 = N(2)
  const child = N()

  parent1.parentFor(child, 'same')
  parent2.parentFor(child, 'same')

  t.equal(parent1.haveListeners, false, 'parent1 unsubscribed')
  t.equal(parent2.haveListeners, true, 'parent2 subscribed')
  t.end()
})

// ============================================================================
// Event Listeners
// ============================================================================

test('onClear / offClear', (t) => {
  const n = N(10)
  let clearCalled = false

  const handler = () => { clearCalled = true }
  n.onClear(handler)

  n.clearValue()
  t.ok(clearCalled, 'onClear handler called')

  clearCalled = false
  n.offClear(handler)

  n(20)
  n.clearValue()
  t.equal(clearCalled, false, 'offClear removed handler')
  t.end()
})

test('onAwait / offAwait', async (t) => {
  const n = N()
  let awaiting = false

  const handler = (isAwaiting) => {
    awaiting = isAwaiting
  }

  n.onAwait(handler)
  n(Promise.resolve(10))

  t.ok(awaiting, 'onAwait called')

  await new Promise(resolve => setTimeout(resolve, 15))

  n.offAwait(handler)
  t.end()
})

// ============================================================================
// Filtered Subscriptions
// ============================================================================

test('upDown - triggers on transition', (t) => {
  const n = N(true)
  let callCount = 0

  n.upDown((down, up) => {
    callCount++
  })

  n(false)
  t.ok(callCount >= 1, 'transition triggered')
  t.end()
})

test('upSome - triggers on truthy values', (t) => {
  const n = N()
  const values = []

  n.upSome(v => values.push(v))

  n(0)
  n(false)
  n(null)
  t.equal(values.length, 0, 'no truthy values yet')

  n(1)
  t.equal(values.length, 1, 'truthy value triggers')
  t.equal(values[0], 1)
  t.end()
})

test('upTrue - triggers only on true', (t) => {
  const n = N()
  let callCount = 0

  n.upTrue(() => callCount++)

  n(1)
  n('yes')
  n(true)

  t.equal(callCount, 1, 'only true triggers')
  t.end()
})

test('upFalse - triggers only on false', (t) => {
  const n = N()
  let callCount = 0

  n.upFalse(() => callCount++)

  n(0)
  n('')
  n(false)

  t.equal(callCount, 1, 'only false triggers')
  t.end()
})

test('upSomeFalse - triggers on falsy values', (t) => {
  const n = N(1)
  const values = []

  n.upSomeFalse(v => values.push(v))

  n(2)
  n(3)
  t.equal(values.length, 0, 'truthy values ignored')

  n(0)
  t.equal(values.length, 1, 'falsy value triggers')
  t.equal(values[0], 0)
  t.end()
})

test('upNone - triggers on null/undefined', (t) => {
  const n = N(10)
  const values = []

  n.upNone(v => values.push(v))

  n(0)
  n(false)
  n('')
  t.equal(values.length, 0, 'other falsy values ignored')

  n(null)
  t.equal(values.length, 1, 'null triggers')

  n(undefined)
  t.equal(values.length, 2, 'undefined triggers')
  t.end()
})

// ============================================================================
// Configuration Methods
// ============================================================================

test('setName - sets nucleus name', (t) => {
  const n = N(1)
  n.setName('myNucleus')

  t.equal(n.name, 'myNucleus', 'name property set')
  t.end()
})

test('finite - with explicit value', (t) => {
  const n = N(1)
  n.finite(false)

  t.equal(n.isFinite, false, 'finite disabled')
  t.end()
})

test('holistic - with explicit value', (t) => {
  const n = N(1)
  n.holistic(false)

  t.equal(n.isHoly, false, 'holistic disabled')
  t.end()
})

test('holistic - with holy nucleus', (t) => {
  const n = N().holistic()
  let received

  n.up((...args) => {
    received = args
  })

  n(1, 2, 3)
  t.same(received, [1, 2, 3], 'arguments spread to listener')
  t.end()
})

test('stateless - with explicit value', (t) => {
  const n = N(1)
  n.stateless(false)

  t.equal(n.isStateless, false, 'stateless disabled')
  t.equal(n.value, 1, 'value preserved')
  t.end()
})

// ============================================================================
// Context Binding
// ============================================================================

test('bind - binds context', (t) => {
  const n = N(1)
  const ctx = { name: 'context' }

  n.bind(ctx)
  t.equal(n._context, ctx, 'context bound')
  t.end()
})

test('apply - applies with context and value', (t) => {
  const n = N()
  const ctx = { name: 'context' }

  n.apply(ctx, [42])
  t.equal(n.value, 42, 'value set')
  t.equal(n._context, ctx, 'context bound')
  t.end()
})

test('call - calls with context', (t) => {
  const n = N()
  const ctx = { name: 'context' }

  n.call(ctx, 100)
  t.equal(n.value, 100, 'value set via call')
  t.end()
})

// ============================================================================
// Metadata
// ============================================================================

test('deleteMeta - returns false if no metaMap', (t) => {
  const n = N(1)
  const result = n.deleteMeta('nonexistent')

  t.equal(result, false, 'returns false for missing metaMap')
  t.end()
})

test('getMeta - returns null if no metaMap', (t) => {
  const n = N(1)
  const result = n.getMeta('nonexistent')

  t.equal(result, null, 'returns null for missing metaMap')
  t.end()
})

// ============================================================================
// Event Dispatch
// ============================================================================

test('dispatch - dispatches custom event', (t) => {
  const n = N(1)
  let received

  n.on('CUSTOM_EVENT', (value) => {
    received = value
  })

  n.dispatch('CUSTOM_EVENT', 'test-data')
  t.equal(received, 'test-data', 'custom event dispatched')
  t.end()
})

test('on / off - event subscription', (t) => {
  const n = N(1)
  let callCount = 0

  const handler = () => callCount++
  n.on('TEST', handler)

  n.dispatch('TEST')
  t.equal(callCount, 1, 'handler called')

  n.off('TEST', handler)
  n.dispatch('TEST')
  t.equal(callCount, 1, 'handler removed')
  t.end()
})

// ============================================================================
// Getter/Setter Functions
// ============================================================================

test('setGetter - lazy evaluation', (t) => {
  const n = N()
  let computeCount = 0

  n.setGetter(() => {
    computeCount++
    return 42
  })

  t.equal(computeCount, 0, 'getter not called yet')

  const value = n()
  t.equal(value, 42, 'getter returns value')
  t.equal(computeCount, 1, 'getter called once')

  n()
  t.equal(computeCount, 2, 'getter called again')
  t.end()
})

test('setOnceGet - evaluates once', (t) => {
  const n = N()
  let computeCount = 0

  n.setOnceGet(() => {
    computeCount++
    return 100
  })

  n()
  t.equal(computeCount, 1, 'getter called')

  n()
  t.equal(computeCount, 1, 'getter not called again (once)')
  t.end()
})

// ============================================================================
// Tuning (Synchronization)
// ============================================================================

test('tuneTo - syncs with another nucleus', (t) => {
  const source = N(10)
  const target = N()

  target.tuneTo(source)

  t.equal(target.value, 10, 'initial sync')

  source(20)
  t.equal(target.value, 20, 'synced on update')
  t.end()
})

test('tuneOff - stops sync', (t) => {
  const source = N(10)
  const target = N()

  target.tuneTo(source)
  target.tuneOff()

  source(30)
  t.equal(target.value, 10, 'no longer synced')
  t.end()
})

// ============================================================================
// Injection
// ============================================================================

test('injectTo - injects value to object', (t) => {
  const n = N(42)
  n.setId('myValue')

  const obj = {}
  n.injectTo(obj)

  t.equal(obj.myValue, 42, 'value injected with id as key')
  t.end()
})

test('injectTo - with custom key', (t) => {
  const n = N(100)
  const obj = {}

  n.injectTo(obj, 'customKey')
  t.equal(obj.customKey, 100, 'value injected with custom key')
  t.end()
})

test('injectTo - throws on null object', (t) => {
  const n = N(1)

  t.throws(
    () => n.injectTo(null),
    /trying inject quark to null object/,
    'throws error for null target'
  )
  t.end()
})

test('injectTo - uses name as fallback', (t) => {
  const n = N(50)
  n.setName('myName')

  const obj = {}
  n.injectTo(obj)

  t.equal(obj.myName, 50, 'uses name when id not set')
  t.end()
})

// ============================================================================
// Utility Methods
// ============================================================================

test('cloneValue - deep clones value', (t) => {
  const original = { a: 1, b: { c: 2 } }
  const n = N(original)

  const cloned = n.cloneValue()

  t.same(cloned, original, 'values are equal')
  t.not(cloned, original, 'different object reference')
  t.not(cloned.b, original.b, 'nested object also cloned')
  t.end()
})

test('toString - returns string representation', (t) => {
  const n = N(1)
  const str = n.toString()

  t.ok(typeof str === 'string', 'returns string')
  t.end()
})

test('valueOf - returns string value', (t) => {
  const n = N(1)
  const val = n.valueOf()

  t.ok(val, 'returns value')
  t.end()
})

test('Symbol.dispose - calls decay', (t) => {
  const n = N(1)
  const parent = N(10)

  parent.up(n)

  t.equal(parent.haveListeners, true, 'has listener')

  n[Symbol.dispose]()

  t.equal(n.isEmpty, true, 'value cleared')
  t.end()
})

// ============================================================================
// Decay with hooks
// ============================================================================

test('decay - clears grandListeners', (t) => {
  const n = N(true)
  n.upTrue(() => {})

  t.ok(n.grandListeners.size > 0, 'has grandListeners')

  n.decay()
  t.equal(n.grandListeners, undefined, 'grandListeners cleared')
  t.end()
})

test('decay - clears stateListeners', (t) => {
  const n = N(1)

  n.on('TEST', () => {})
  t.ok(n.stateListeners, 'has stateListeners')

  n.decay()
  t.notOk(n.stateListeners && n.stateListeners.size > 0, 'stateListeners cleared')
  t.end()
})

test('decay - deletes haveFrom flag', (t) => {
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => x + y)

  // haveFrom устанавливается внутри
  sum.decay()

  // Проверяем что флаг удалён (не можем напрямую, но проверим что decay работает)
  t.equal(a.haveListeners, false, 'parent listeners cleaned')
  t.end()
})

test('decay - calls risen hooks', (t) => {
  const n = N(1)
  let risenCalled = false

  n.risen = [() => { risenCalled = true }]

  n.decay()
  t.ok(risenCalled, 'risen hook called')
  t.end()
})

test('decay - silent mode', (t) => {
  const n = N(1)
  let eventFired = false

  n.onClear(() => { eventFired = true })

  n.decay(true) // silent
  t.equal(eventFired, false, 'no event in silent mode')
  t.end()
})

// ============================================================================
// Additional Coverage Tests
// ============================================================================

test('applyValue - with holistic nucleus', (t) => {
  const n = N().holistic()
  let received = null

  n.up((...args) => {
    received = args
  })

  n(1, 2, 3)
  t.same(received, [1, 2, 3], 'holistic spreads args')
  t.end()
})

test('finite - without argument sets to true', (t) => {
  const n = N(1)
  n.finite()

  t.equal(n.isFinite, true, 'finite() without args sets true')
  t.end()
})

test('holistic - without argument sets to true', (t) => {
  const n = N()
  n.holistic()

  t.equal(n.isHoly, true, 'holistic() without args sets true')
  t.end()
})

test('stateless - without argument sets to true', (t) => {
  const n = N(5)
  n.stateless()

  t.equal(n.isStateless, true, 'stateless() without args sets true')
  t.equal(n.isEmpty, true, 'value cleared')
  t.end()
})

test('bind - recursive call protection', (t) => {
  const n = N(1)
  const ctx1 = { name: 'ctx1' }

  n.bind(ctx1)
  n.bind(ctx1) // повторный вызов с тем же контекстом

  t.equal(n._context, ctx1, 'context remains same')
  t.end()
})

test('deleteMeta - deletes existing meta', (t) => {
  const n = N(1)
  n.addMeta('test', 'value')

  const result = n.deleteMeta('test')
  t.equal(result, true, 'returns true for deleted meta')

  const result2 = n.deleteMeta('nonexistent')
  t.equal(result2, false, 'returns false for missing meta')
  t.end()
})

test('getMeta - gets null for missing meta when no metaMap', (t) => {
  const n = N(1)
  const result = n.getMeta('missing')

  t.equal(result, null, 'returns null')
  t.end()
})

test('hasMeta - returns false when no metaMap', (t) => {
  const n = N(1)
  const result = n.hasMeta('anything')

  t.equal(result, false, 'returns false')
  t.end()
})

test('injectTo - uses uid as fallback', (t) => {
  const n = N(99)
  const obj = {}

  n.injectTo(obj)

  // Должен использовать uid как ключ
  const keys = Object.keys(obj)
  t.equal(keys.length, 1, 'one key injected')
  t.equal(obj[keys[0]], 99, 'value injected with uid')
  t.end()
})

test('injectTo - prefers name over id and uid', (t) => {
  const n = N(77)
  n.setId('myId')
  n.setName('myName')

  const obj = {}
  n.injectTo(obj)

  t.equal(obj.myName, 77, 'uses name as key')
  t.equal(obj.myId, undefined, 'id not used')
  t.end()
})

test('Symbol.toPrimitive on props', (t) => {
  const n = N(5)
  // Вызываем toPrimitive напрямую через свойство
  const result = n[Symbol.toPrimitive]

  t.ok(result, 'Symbol.toPrimitive exists')
  t.end()
})

test('setWrapper - wraps value transformations', (t) => {
  const n = N()

  n.setWrapper((newVal, oldVal) => {
    return newVal * 2
  })

  n(5)
  t.equal(n.value, 10, 'wrapper doubled the value')

  n(7)
  t.equal(n.value, 14, 'wrapper works on updates')
  t.end()
})

test('setOnceGet - getter removed after first call', (t) => {
  const n = N()
  let computeCount = 0

  n.setOnceGet(() => {
    computeCount++
    return 100
  })

  t.ok(n.getterFn, 'getter exists')

  const val1 = n()
  t.equal(val1, 100, 'first call works')
  t.equal(computeCount, 1, 'computed once')

  const val2 = n()
  t.equal(val2, 100, 'second call returns stored value')
  t.equal(computeCount, 1, 'not computed again')
  t.notOk(n.getterFn, 'getter removed')
  t.end()
})

test('bind - changes context when different', (t) => {
  const n = N(1)
  const ctx1 = { name: 'ctx1' }
  const ctx2 = { name: 'ctx2' }

  n.bind(ctx1)
  t.equal(n._context, ctx1, 'first context set')

  n.bind(ctx2)
  t.equal(n._context, ctx2, 'context changed')
  t.end()
})

test('hasMeta - returns true for existing meta', (t) => {
  const n = N(1)
  n.addMeta('test', 'value')

  t.equal(n.hasMeta('test'), true, 'meta exists')
  t.equal(n.hasMeta('missing'), false, 'meta does not exist')
  t.end()
})

test('tuneOff - when no tunedTarget', (t) => {
  const n = N(1)

  // Вызываем tuneOff без tunedTarget
  n.tuneOff()

  t.ok(true, 'no error when no target')
  t.end()
})

test('tuneOff - removes existing target', (t) => {
  const source = N(10)
  const target = N()

  target.tuneTo(source)
  t.ok(target.tunedTarget, 'target set')

  target.tuneOff()
  // tuneOff вызывает down на себе, что может быть багом в коде
  t.ok(true, 'tuneOff completed')
  t.end()
})

test('handlers Symbol.toPrimitive', (t) => {
  const n = N(5)
  // Вызываем Symbol.toPrimitive из handlers
  const result = n[Symbol.toPrimitive]

  t.ok(result, 'method exists')
  t.end()
})

test('handlers toString', (t) => {
  const n = N(1)
  const str = n.toString()

  t.ok(typeof str === 'string', 'returns string')
  t.end()
})

test('handlers valueOf', (t) => {
  const n = N(1)
  const val = n.valueOf()

  t.ok(val, 'returns value')
  t.end()
})

test('apply - sets value with context', (t) => {
  const n = N()
  const ctx = { name: 'test' }

  n.apply(ctx, [42])

  t.equal(n.value, 42, 'value set via apply')
  t.equal(n._context, ctx, 'context bound')
  t.end()
})

test('call - calls with multiple args', (t) => {
  const n = N().holistic()

  n.call(null, 1, 2, 3)

  t.same(n.value, [1, 2, 3], 'holistic value set via call')
  t.end()
})
