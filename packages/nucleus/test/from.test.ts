import { test } from 'tap'
import N, { Nucleus, Q } from '@alaq/nucleus/index'

// ============================================================================
// SOME Strategy Tests
// ============================================================================

test('some from - basic usage', (t) => {
  const a = Nucleus(1)
  const b = Nucleus()
  const f = Nucleus.from(a, b).some((va, vb) => (va || 0) + (vb || 0))

  // Должно вычислить сразу, т.к. a уже имеет значение
  t.equal(f.value, 1, 'computed with first value')

  let receivedValues = []
  f.up((v) => receivedValues.push(v))

  // .up вызывается с текущим значением
  t.equal(receivedValues[0], 1, 'received current value on subscribe')

  b(1)
  t.equal(receivedValues[1], 2, 'updated when second value set')
  t.end()
})

test('some from - computes with partial data', (t) => {
  const a = N()
  const b = N()
  let callCount = 0

  const sum = N.from(a, b).some((x, y) => {
    callCount++
    return (x || 0) + (y || 0)
  })

  // some работает с частичными данными
  t.equal(callCount, 0, 'not computed with empty sources')

  a(5) // первое значение - теперь должно вычислить!
  t.equal(callCount, 1, 'computed with first value')
  t.equal(sum.value, 5)

  b(3) // второе значение
  t.equal(callCount, 2, 'recomputed with both values')
  t.equal(sum.value, 8)
  t.end()
})

test('some from - handles partial data', (t) => {
  const firstName = N()
  const lastName = N()
  const fullName = N.from(firstName, lastName).some((first, last) =>
    [first, last].filter(Boolean).join(' ')
  )

  // some не вычисляет с пустыми источниками
  t.equal(fullName.isEmpty, true, 'not computed initially')

  firstName('Пётр') // триггер изменения - теперь есть хотя бы одно значение
  t.equal(fullName.value, 'Пётр', 'works with only first name')

  lastName('Петров')
  t.equal(fullName.value, 'Пётр Петров', 'works with both names')
  t.end()
})

test('some from - updates on any change', (t) => {
  let callCount = 0
  const a = N(1)
  const b = N(2)
  const result = N.from(a, b).some((x, y) => {
    callCount++
    return x + y
  })

  t.equal(callCount, 1, 'computed on creation')
  a(3)
  t.equal(callCount, 2, 'recomputed on a change')
  b(4)
  t.equal(callCount, 3, 'recomputed on b change')
  t.end()
})

// ============================================================================
// WEAK Strategy Tests
// ============================================================================

test('weak from - basic usage', (t) => {
  t.plan(4)
  const na = Nucleus()
  const nb = Nucleus()
  const nf = Nucleus.from(na, nb).weak((a, b) => {
    t.ok(true)
  })
  na(null)
  na(undefined)
  nb(null)
  t.end()
})

test('weak from - finite mode (no duplicate recomputes)', (t) => {
  let callCount = 0
  const a = N(1)
  const b = N(2)
  const result = N.from(a, b).weak((x, y) => {
    callCount++
    return x + y
  })

  t.equal(callCount, 1, 'computed initially')

  a(1) // same value
  t.equal(callCount, 1, 'not recomputed for same value')

  a(5) // different value
  t.equal(callCount, 2, 'recomputed for new value')
  t.end()
})

test('weak from - works with undefined values', (t) => {
  const a = N()
  const b = N()
  const results = []

  const combined = N.from(a, b).weak((x, y) => {
    const result = { x, y }
    results.push(result)
    return result
  })

  // weak вызывается сразу при создании, даже с undefined
  t.equal(results.length, 1, 'computed initially even with undefined')
  t.same(results[0], { x: undefined, y: undefined })

  a(1)
  t.equal(results.length, 2, 'computed with partial data')
  t.same(results[1], { x: 1, y: undefined })

  b(2)
  t.equal(results.length, 3, 'computed again')
  t.same(results[2], { x: 1, y: 2 })
  t.end()
})

test('weak from - three sources', (t) => {
  const a = N(1)
  const b = N(2)
  const c = N(3)
  const sum = N.from(a, b, c).weak((x, y, z) => x + y + z)

  t.equal(sum.value, 6)
  a(10)
  t.equal(sum.value, 15)
  t.end()
})

// ============================================================================
// STRONG Strategy Tests
// ============================================================================

test('strong from - basic usage', (t) => {
  const a = N(2)
  const b = N(3)
  const sum = N.from(a, b).strong((x, y) => x + y)

  t.equal(sum.value, 5, 'computed with both values')
  a(10)
  t.equal(sum.value, 13, 'recomputed on change')
  t.end()
})

test('strong from - waits for all values', (t) => {
  let callCount = 0
  const a = N()
  const b = N()
  const result = N.from(a, b).strong((x, y) => {
    callCount++
    return x + y
  })

  t.equal(result.isEmpty, true, 'empty until all sources filled')
  t.equal(callCount, 0, 'not computed yet')

  a(5)
  t.equal(result.isEmpty, true, 'still empty with partial data')
  t.equal(callCount, 0, 'still not computed')

  b(3)
  t.equal(result.value, 8, 'computed when all values available')
  t.equal(callCount, 1, 'computed exactly once')
  t.end()
})

test('strong from - finite mode by default', (t) => {
  let callCount = 0
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => {
    callCount++
    return x + y
  })

  t.equal(callCount, 1, 'computed initially')

  a(1) // same value
  t.equal(callCount, 1, 'not recomputed for duplicate')

  a(5)
  t.equal(callCount, 2, 'recomputed for new value')

  b(2) // same value
  t.equal(callCount, 2, 'not recomputed for duplicate')
  t.end()
})

test('strong from - async sources', async (t) => {
  const a = N()
  const b = N()
  const sum = N.from(a, b).strong((x, y) => x + y)

  a(Promise.resolve(5))
  b(Promise.resolve(3))

  // Wait for promises to resolve
  await new Promise(resolve => setTimeout(resolve, 10))

  t.equal(sum.value, 8, 'computed from async values')
  t.end()
})

test('strong from - handles one async source', async (t) => {
  const a = N(5)
  const b = N()
  const sum = N.from(a, b).strong((x, y) => x + y)

  t.equal(sum.isEmpty, true, 'empty before async resolves')

  b(Promise.resolve(3))

  await new Promise(resolve => setTimeout(resolve, 10))

  t.equal(sum.value, 8, 'computed after async resolves')
  t.end()
})

test('strong from - multiple recomputations', (t) => {
  const price = N(100)
  const quantity = N(2)
  const discount = N(0)

  const total = N.from(price, quantity, discount).strong((p, q, d) => {
    return (p * q) * (1 - d)
  })

  t.equal(total.value, 200, 'initial calculation')

  price(150)
  t.equal(total.value, 300, 'updated price')

  quantity(3)
  t.equal(total.value, 450, 'updated quantity')

  discount(0.1)
  t.equal(total.value, 405, 'applied discount')
  t.end()
})


// ============================================================================
// Edge Cases and Advanced Tests
// ============================================================================

test('from - self-reference prevention', (t) => {
  const a = N(1)
  const b = N(2)
  const result = N.from(a, b).strong((x, y) => x + y)

  // Проверяем что result вычислился
  t.equal(result.value, 3, 'result computed correctly')

  // Вызов result() должен вернуть значение
  const mixedValue = result()
  t.equal(mixedValue, 3, 'result() returns value')
  t.end()
})

test('from - chain of computations', (t) => {
  const a = N(2)
  const b = N(3)
  const sum = N.from(a, b).strong((x, y) => x + y)
  const doubled = N.from(sum).strong(x => x * 2)

  t.equal(sum.value, 5)
  t.equal(doubled.value, 10)

  a(5)
  t.equal(sum.value, 8)
  t.equal(doubled.value, 16)
  t.end()
})

test('from - cleanup on decay', (t) => {
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => x + y)

  t.equal(a.haveListeners, true, 'a has listeners')
  t.equal(b.haveListeners, true, 'b has listeners')

  sum.decay()

  t.equal(a.haveListeners, false, 'a listeners cleaned up')
  t.equal(b.haveListeners, false, 'b listeners cleaned up')
  t.end()
})

test('from - transformation function', (t) => {
  const celsius = N(0)
  const fahrenheit = N.from(celsius).strong(c => c * 9/5 + 32)

  t.equal(fahrenheit.value, 32, '0°C = 32°F')

  celsius(100)
  t.equal(fahrenheit.value, 212, '100°C = 212°F')

  celsius(-40)
  t.equal(fahrenheit.value, -40, '-40°C = -40°F')
  t.end()
})

test('from - complex object transformation', (t) => {
  const user = N({ firstName: 'Иван', lastName: 'Петров' })
  const age = N(30)

  const profile = N.from(user, age).strong((u, a) => ({
    fullName: `${u.firstName} ${u.lastName}`,
    age: a,
    isAdult: a >= 18
  }))

  t.equal(profile.value.fullName, 'Иван Петров')
  t.equal(profile.value.isAdult, true)

  age(16)
  t.equal(profile.value.isAdult, false)
  t.end()
})

test('from - error handling in compute function', (t) => {
  const a = N(5)
  const b = N(0)

  let errorCount = 0
  const result = N.from(a, b).strong((x, y) => {
    if (y === 0) {
      errorCount++
      // В реальности ошибка выбросится, но тест продолжится
      return 0
    }
    return x / y
  })

  t.equal(errorCount, 1, 'error path executed')
  t.equal(result.value, 0, 'returned fallback value')

  b(2)
  t.equal(result.value, 2.5, 'computed after fixing error')
  t.end()
})

test('from - parents property', (t) => {
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => x + y)

  t.ok(Array.isArray(sum.parents), 'has parents array')
  t.equal(sum.parents.length, 2, 'has 2 parents')
  t.equal(sum.parents[0], a, 'first parent is a')
  t.equal(sum.parents[1], b, 'second parent is b')
  t.end()
})

test('from - async compute function', async (t) => {
  const a = N(1)
  const b = N(2)

  const asyncSum = N.from(a, b).strong(async (x, y) => {
    await new Promise(resolve => setTimeout(resolve, 10))
    return x + y
  })

  t.ok(asyncSum.isAwaiting, 'is awaiting (truthy Promise)')

  await new Promise(resolve => setTimeout(resolve, 20))

  t.equal(asyncSum.value, 3, 'async computed')
  t.equal(asyncSum.isAwaiting, false, 'no longer awaiting')
  t.end()
})

test('from - mix of sync and async updates', async (t) => {
  const syncVal = N(5)
  const asyncVal = N()

  const result = N.from(syncVal, asyncVal).strong((s, a) => s + a)

  asyncVal(Promise.resolve(3))

  await new Promise(resolve => setTimeout(resolve, 10))

  t.equal(result.value, 8)

  syncVal(10)
  t.equal(result.value, 13, 'sync update works after async')
  t.end()
})

test('from - subscription before computation', (t) => {
  let receivedValues = []
  const a = N(1)
  const b = N(2)

  const sum = N.from(a, b).strong((x, y) => x + y)

  sum.up(v => receivedValues.push(v))

  t.equal(receivedValues.length, 1, 'received initial computed value')
  t.equal(receivedValues[0], 3)

  a(5)
  t.equal(receivedValues.length, 2, 'received updated value')
  t.equal(receivedValues[1], 7)
  t.end()
})

test('from - multiple subscribers', (t) => {
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => x + y)

  let count1 = 0
  let count2 = 0

  sum.up(() => count1++)
  sum.up(() => count2++)

  a(5)

  t.equal(count1, 2, 'first subscriber called twice')
  t.equal(count2, 2, 'second subscriber called twice')
  t.end()
})
