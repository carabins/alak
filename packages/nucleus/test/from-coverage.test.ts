import { test } from 'tap'
import N from '@alaq/nucleus/index'

// Тесты для увеличения покрытия computed.ts

test('from - repeated .from() call throws error', (t) => {
  const a = N(1)
  const b = N(2)
  const result = N()

  // First .from() call
  result.from(a, b)

  // Second .from() call should throw
  try {
    result.from(a, b)
    t.fail('should have thrown error')
  } catch (e) {
    t.match(String(e), /from nucleons already has a assigned/, 'throws error on repeated from')
  }
  t.end()
})

test('from - async mixFn returns promise', async (t) => {
  const a = N(1)
  const b = N(2)

  let resolveValue
  const promise = new Promise(resolve => {
    resolveValue = resolve
  })

  const result = N.from(a, b).strong(async (x, y) => {
    await promise
    return x + y
  })

  t.ok(result.isAwaiting, 'result is awaiting')

  resolveValue(null)
  await new Promise(resolve => setTimeout(resolve, 20))

  t.equal(result.value, 3, 'computed after promise resolves')
  t.end()
})

test('from - source nucleus is awaiting', async (t) => {
  const a = N()
  const b = N(2)

  a(Promise.resolve(5))

  const sum = N.from(a, b).strong((x, y) => x + y)

  t.ok(sum.isAwaiting, 'sum is waiting for a to resolve')

  await new Promise(resolve => setTimeout(resolve, 20))

  t.equal(sum.value, 7, 'computed after source resolves')
  t.end()
})

test('from - weak mode recomputes on any change', (t) => {
  let callCount = 0
  const a = N(1)
  const b = N(2)

  const result = N.from(a, b).weak((x, y) => {
    callCount++
    return x + y
  })

  t.equal(callCount, 1, 'computed initially')

  a(5) // different value
  t.equal(callCount, 2, 'recomputed on change')

  b(10) // different value
  t.equal(callCount, 3, 'recomputed again')

  t.end()
})

test('from - getterFn called directly by user', (t) => {
  const a = N(5)
  const b = N(3)
  const sum = N.from(a, b).strong((x, y) => x + y)

  t.equal(sum.value, 8, 'initial value')

  // Вызов sum() напрямую должен вызвать getterFn
  const result = sum()
  t.equal(result, 8, 'getterFn returns correct value')

  a(10)
  const newResult = sum()
  t.equal(newResult, 13, 'getterFn returns updated value')
  t.end()
})

test('from - isChanged returns false in finite mode', (t) => {
  let callCount = 0
  const a = N(1)
  const b = N(2)
  const sum = N.from(a, b).strong((x, y) => {
    callCount++
    return x + y
  })

  const initialCount = callCount

  // Установить те же значения - isChanged должен вернуть false
  a(1)
  t.equal(callCount, initialCount, 'no recompute when values unchanged')

  b(2)
  t.equal(callCount, initialCount, 'still no recompute')

  // Изменить значение - должен вычислить
  a(5)
  t.equal(callCount, initialCount + 1, 'recomputed on real change')
  t.end()
})

test('from - stateless source triggers computation', (t) => {
  let callCount = 0
  const event = N().stateless()
  const value = N(10)

  const result = N.from(event, value).strong((e, v) => {
    callCount++
    return v
  })

  t.equal(callCount, 1, 'initial computation')

  // Stateless вызывает mixer когда передает значение
  event('click')
  t.equal(callCount, 2, 'stateless triggers recompute')

  event('another')
  t.equal(callCount, 3, 'stateless triggers again')
  t.end()
})

test('from - multiple async sources', async (t) => {
  const a = N()
  const b = N()
  const c = N()

  a(Promise.resolve(1))
  b(Promise.resolve(2))
  c(Promise.resolve(3))

  const sum = N.from(a, b, c).strong((x, y, z) => x + y + z)

  t.ok(sum.isAwaiting, 'waiting for all promises')

  await new Promise(resolve => setTimeout(resolve, 30))

  t.equal(sum.value, 6, 'all promises resolved')
  t.end()
})

test('from - mixed sync and async in strong', async (t) => {
  const sync = N(10)
  const async = N()

  async(Promise.resolve(5))

  const result = N.from(sync, async).strong((s, a) => s + a)

  t.ok(result.isAwaiting, 'waiting for async')

  await new Promise(resolve => setTimeout(resolve, 20))

  t.equal(result.value, 15, 'computed after async resolves')
  t.end()
})

test('from - nested promises in getterFn', async (t) => {
  const a = N()
  const b = N(2)

  const result = N.from(a, b).strong(async (x, y) => {
    if (x === undefined) return Promise.resolve(0)
    return x + y
  })

  a(Promise.resolve(5))

  await new Promise(resolve => setTimeout(resolve, 30))

  t.equal(result.value, 7, 'nested async resolved')
  t.end()
})
