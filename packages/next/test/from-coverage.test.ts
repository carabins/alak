import { test, expect } from 'bun:test'
import N, { installPlugin } from '@alaq/nucleus/index'
import { ComputedPlugin } from '../src/index'

// Устанавливаем ComputedPlugin для тестов
installPlugin(ComputedPlugin)

// Тесты для увеличения покрытия computed.ts

test('from - repeated .from() call throws error', () => {
  const a = N(1)
  const b = N(2)
  const result = N()

  // First .from() call
  result.from(a, b)

  // Second .from() call should throw
  try {
    result.from(a, b)
    throw new Error('should have thrown error')
  } catch (e) {
    expect(String(e)).toMatch(/from nucleons already has a assigned/)
  }
})

test('from - async mixFn returns promise', async () => {
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

  expect(result.isAwaiting).toBeTruthy()

  resolveValue(null)
  await new Promise(resolve => setTimeout(resolve, 20))

  expect(result.value).toBe(3)
})

test('from - source nucleus is awaiting', async () => {
  const a = N()
  const b = N(2)

  a(Promise.resolve(5))

  const sum = N.from(a, b).strong((x, y) => x + y)

  expect(sum.isAwaiting).toBeTruthy()

  await new Promise(resolve => setTimeout(resolve, 20))

  expect(sum.value).toBe(7)
})

test('from - weak mode recomputes on any change', () => {
  let callCount = 0
  const a = N(1)
  const b = N(2)

  const result = N.from(a, b).weak((x, y) => {
    callCount++
    return x + y
  })

  expect(callCount).toBe(1)

  a(5) // different value
  expect(callCount).toBe(2)

  b(10) // different value
  expect(callCount).toBe(3)
})

test('from - getterFn called directly by user', () => {
  const a = N(5)
  const b = N(3)
  const sum = N.from(a, b).strong((x, y) => x + y)

  expect(sum.value).toBe(8)

  // Вызов sum() напрямую должен вызвать getterFn
  const result = sum()
  expect(result).toBe(8)

  a(10)
  const newResult = sum()
  expect(newResult).toBe(13)
})

test('from - isChanged returns false in finite mode', () => {
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
  expect(callCount).toBe(initialCount)

  b(2)
  expect(callCount).toBe(initialCount)

  // Изменить значение - должен вычислить
  a(5)
  expect(callCount).toBe(initialCount + 1)
})

test('from - stateless source triggers computation', () => {
  let callCount = 0
  const event = N().stateless()
  const value = N(10)

  const result = N.from(event, value).strong((e, v) => {
    callCount++
    return v
  })

  expect(callCount).toBe(1)

  // Stateless вызывает mixer когда передает значение
  event('click')
  expect(callCount).toBe(2)

  event('another')
  expect(callCount).toBe(3)
})

test('from - multiple async sources', async () => {
  const a = N()
  const b = N()
  const c = N()

  a(Promise.resolve(1))
  b(Promise.resolve(2))
  c(Promise.resolve(3))

  const sum = N.from(a, b, c).strong((x, y, z) => x + y + z)

  expect(sum.isAwaiting).toBeTruthy()

  await new Promise(resolve => setTimeout(resolve, 30))

  expect(sum.value).toBe(6)
})

test('from - mixed sync and async in strong', async () => {
  const sync = N(10)
  const async = N()

  async(Promise.resolve(5))

  const result = N.from(sync, async).strong((s, a) => s + a)

  expect(result.isAwaiting).toBeTruthy()

  await new Promise(resolve => setTimeout(resolve, 20))

  expect(result.value).toBe(15)
})

test('from - nested promises in getterFn', async () => {
  const a = N()
  const b = N(2)

  const result = N.from(a, b).strong(async (x, y) => {
    if (x === undefined) return Promise.resolve(0)
    return x + y
  })

  a(Promise.resolve(5))

  await new Promise(resolve => setTimeout(resolve, 30))

  expect(result.value).toBe(7)
})
