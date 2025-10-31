import { test, expect } from 'bun:test'
import N, { Nucleus, Q, installPlugin } from '@alaq/nucleus/index'
import { ComputedPlugin } from '../src/index'

// Устанавливаем ComputedPlugin для тестов
installPlugin(ComputedPlugin)

// ============================================================================
// SOME Strategy Tests
// ============================================================================

test('some from - basic usage', () => {
  const a = Nucleus(1)
  const b = Nucleus()
  const f = Nucleus.from(a, b).some((va, vb) => (va || 0) + (vb || 0))

  // Должно вычислить сразу, т.к. a уже имеет значение
  expect(f.value).toBe(1)

  let receivedValues = []
  f.up((v) => receivedValues.push(v))

  // .up вызывается с текущим значением
  expect(receivedValues[0]).toBe(1)

  b(1)
  expect(receivedValues[1]).toBe(2)
})

test('some from - computes with partial data', () => {
  const a = N()
  const b = N()
  let callCount = 0

  const sum = N.from(a, b).some((x, y) => {
    callCount++
    return (x || 0) + (y || 0)
  })

  // some работает с частичными данными
  expect(callCount).toBe(0)

  a(5) // первое значение - теперь должно вычислить!
  expect(callCount).toBe(1)
  expect(sum.value).toBe(5)

  b(3) // второе значение
  expect(callCount).toBe(2)
  expect(sum.value).toBe(8)
})

test('some from - handles partial data', () => {
  const firstName = N()
  const lastName = N()
  const fullName = N.from(firstName, lastName).some((first, last) =>
    [first, last].filter(Boolean).join(' ')
  )

  // some не вычисляет с пустыми источниками
  expect(fullName.isEmpty).toBe(true)

  firstName('Пётр') // триггер изменения - теперь есть хотя бы одно значение
  expect(fullName.value).toBe('Пётр')

  lastName('Петров')
  expect(fullName.value).toBe('Пётр Петров')
})

test('some from - updates on any change', () => {
  let callCount = 0
  const a = N(1)
  const b = N(2)
  const result = N.from(a, b).some((x, y) => {
    callCount++
    return x + y
  })

  expect(callCount).toBe(1)
  a(3)
  expect(callCount).toBe(2)
  b(4)
  expect(callCount).toBe(3)
})

// ============================================================================
// WEAK Strategy Tests
// ============================================================================

test('weak from - basic usage', () => {
  const na = Nucleus()
  const nb = Nucleus()
  const nf = Nucleus.from(na, nb).weak((a, b) => {
    expect(true).toBeTruthy()
  })
  na(null)
  na(undefined)
  nb(null)
})

test('weak from - finite mode (no duplicate recomputes)', () => {
  let callCount = 0
  const a = N(1)
  const b = N(2)
  const result = N.from(a, b).weak((x, y) => {
    callCount++
    return x + y
  })

  expect(callCount).toBe(1)

  a(1) // same value
  expect(callCount).toBe(1)

  a(5) // different value
  expect(callCount).toBe(2)
})

test('weak from - works with undefined values', () => {
  const a = N()
  const b = N()
  const results = []

  const combined = N.from(a, b).weak((x, y) => {
    const result = { x, y }
    results.push(result)
    return result
  })

  // weak вызывается сразу при создании, даже с undefined
  expect(results.length).toBe(1)
  expect(results[0]).toEqual({ x: undefined, y: undefined })

  a(1)
  expect(results.length).toBe(2)
  expect(results[1]).toEqual({ x: 1, y: undefined })

  b(2)
  expect(results.length).toBe(3)
  expect(results[2]).toEqual({ x: 1, y: 2 })
})

test('weak from - three sources', () => {
  const a = N(1)
  const b = N(2)
  const c = N(3)
  const sum = N.from(a, b, c).weak((x, y, z) => x + y + z)

  expect(sum.value).toBe(6)
  a(10)
  expect(sum.value).toBe(15)
})

// ============================================================================
// STRONG Strategy Tests
// ============================================================================

test('strong from - basic usage', () => {
  const a = N(2)
  const b = N(3)
  const sum = N.from(a, b).strong((x, y) => x + y)

  expect(sum.value).toBe(5)
  a(10)
  expect(sum.value).toBe(13)
})

test('strong from - waits for all values', () => {
  let callCount = 0
  const a = N()
  const b = N()
  const result = N.from(a, b).strong((x, y) => {
    callCount++
    return x + y
  })

  expect(result.isEmpty).toBe(true)
  expect(callCount).toBe(0)

  a(5)
  expect(result.isEmpty).toBe(true)
  expect(callCount).toBe(0)

  b(3)
  expect(result.value).toBe(8)
  expect(callCount).toBe(1)
})

test('strong from - finite mode by default', () => {
  let callCount = 0
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => {
    callCount++
    return x + y
  })

  expect(callCount).toBe(1)

  a(1) // same value
  expect(callCount).toBe(1)

  a(5)
  expect(callCount).toBe(2)

  b(2) // same value
  expect(callCount).toBe(2)
})

test('strong from - async sources', async () => {
  const a = N()
  const b = N()
  const sum = N.from(a, b).strong((x, y) => x + y)

  a(Promise.resolve(5))
  b(Promise.resolve(3))

  // Wait for promises to resolve
  await new Promise(resolve => setTimeout(resolve, 10))

  expect(sum.value).toBe(8)
})

test('strong from - handles one async source', async () => {
  const a = N(5)
  const b = N()
  const sum = N.from(a, b).strong((x, y) => x + y)

  expect(sum.isEmpty).toBe(true)

  b(Promise.resolve(3))

  await new Promise(resolve => setTimeout(resolve, 10))

  expect(sum.value).toBe(8)
})

test('strong from - multiple recomputations', () => {
  const price = N(100)
  const quantity = N(2)
  const discount = N(0)

  const total = N.from(price, quantity, discount).strong((p, q, d) => {
    return (p * q) * (1 - d)
  })

  expect(total.value).toBe(200)

  price(150)
  expect(total.value).toBe(300)

  quantity(3)
  expect(total.value).toBe(450)

  discount(0.1)
  expect(total.value).toBe(405)
})


// ============================================================================
// Edge Cases and Advanced Tests
// ============================================================================

test('from - self-reference prevention', () => {
  const a = N(1)
  const b = N(2)
  const result = N.from(a, b).strong((x, y) => x + y)

  // Проверяем что result вычислился
  expect(result.value).toBe(3)

  // Вызов result() должен вернуть значение
  const mixedValue = result()
  expect(mixedValue).toBe(3)
})

test('from - chain of computations', () => {
  const a = N(2)
  const b = N(3)
  const sum = N.from(a, b).strong((x, y) => x + y)
  const doubled = N.from(sum).strong(x => x * 2)

  expect(sum.value).toBe(5)
  expect(doubled.value).toBe(10)

  a(5)
  expect(sum.value).toBe(8)
  expect(doubled.value).toBe(16)
})

test('from - cleanup on decay', () => {
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => x + y)

  expect(a.haveListeners).toBe(true)
  expect(b.haveListeners).toBe(true)

  sum.decay()

  expect(a.haveListeners).toBe(false)
  expect(b.haveListeners).toBe(false)
})

test('from - transformation function', () => {
  const celsius = N(0)
  const fahrenheit = N.from(celsius).strong(c => c * 9/5 + 32)

  expect(fahrenheit.value).toBe(32)

  celsius(100)
  expect(fahrenheit.value).toBe(212)

  celsius(-40)
  expect(fahrenheit.value).toBe(-40)
})

test('from - complex object transformation', () => {
  const user = N({ firstName: 'Иван', lastName: 'Петров' })
  const age = N(30)

  const profile = N.from(user, age).strong((u, a) => ({
    fullName: `${u.firstName} ${u.lastName}`,
    age: a,
    isAdult: a >= 18
  }))

  expect(profile.value.fullName).toBe('Иван Петров')
  expect(profile.value.isAdult).toBe(true)

  age(16)
  expect(profile.value.isAdult).toBe(false)
})

test('from - error handling in compute function', () => {
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

  expect(errorCount).toBe(1)
  expect(result.value).toBe(0)

  b(2)
  expect(result.value).toBe(2.5)
})

test('from - parents property', () => {
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => x + y)

  expect(Array.isArray(sum.parents)).toBeTruthy()
  expect(sum.parents.length).toBe(2)
  expect(sum.parents[0]).toBe(a)
  expect(sum.parents[1]).toBe(b)
})

test('from - async compute function', async () => {
  const a = N(1)
  const b = N(2)

  const asyncSum = N.from(a, b).strong(async (x, y) => {
    await new Promise(resolve => setTimeout(resolve, 10))
    return x + y
  })

  expect(asyncSum.isAwaiting).toBeTruthy()

  await new Promise(resolve => setTimeout(resolve, 20))

  expect(asyncSum.value).toBe(3)
  expect(asyncSum.isAwaiting).toBe(false)
})

test('from - mix of sync and async updates', async () => {
  const syncVal = N(5)
  const asyncVal = N()

  const result = N.from(syncVal, asyncVal).strong((s, a) => s + a)

  asyncVal(Promise.resolve(3))

  await new Promise(resolve => setTimeout(resolve, 10))

  expect(result.value).toBe(8)

  syncVal(10)
  expect(result.value).toBe(13)
})

test('from - subscription before computation', () => {
  let receivedValues = []
  const a = N(1)
  const b = N(2)

  const sum = N.from(a, b).strong((x, y) => x + y)

  sum.up(v => receivedValues.push(v))

  expect(receivedValues.length).toBe(1)
  expect(receivedValues[0]).toBe(3)

  a(5)
  expect(receivedValues.length).toBe(2)
  expect(receivedValues[1]).toBe(7)
})

test('from - multiple subscribers', () => {
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => x + y)

  let count1 = 0
  let count2 = 0

  sum.up(() => count1++)
  sum.up(() => count2++)

  a(5)

  expect(count1).toBe(2)
  expect(count2).toBe(2)
})
