/**
 * Validation test: subProxy reuse correctness
 */

import { test, expect } from 'bun:test'
import { createState } from '../src/index'

test('Proxy identity preserved when replacing object', () => {
  const obj = { nested: { a: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref1 = proxy.nested
  proxy.nested = { b: 2 }
  const ref2 = proxy.nested

  expect(ref1).toBe(ref2)
  expect(ref2.b).toBe(2)
  expect(ref2.a).toBeUndefined()
})

test('New value accessible through reused proxy', () => {
  const obj = { data: { x: 10 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const dataRef = proxy.data
  proxy.data = { y: 20, z: 30 }

  expect(dataRef.y).toBe(20)
  expect(dataRef.z).toBe(30)
  expect(dataRef.x).toBeUndefined()
})

test('Child proxies cleared on parent value change', () => {
  const obj = { parent: { child: { value: 1 } } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  // Создаем глубокий прокси
  const childRef = proxy.parent.child
  const oldValue = childRef.value

  // Заменяем parent
  proxy.parent = { child: { value: 2 } }

  // childRef должен все еще работать с новым объектом parent
  const newChildRef = proxy.parent.child

  expect(newChildRef.value).toBe(2)
  expect(oldValue).toBe(1)
})

test('Proxy removed when replaced with primitive', () => {
  const obj = { data: { x: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref = proxy.data
  proxy.data = 'string'

  expect(typeof proxy.data).toBe('string')
  expect(proxy.data).toBe('string')
})

test('Proxy removed when replaced with null', () => {
  const obj = { data: { x: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  proxy.data
  proxy.data = null

  expect(proxy.data).toBeNull()
})

test('Multiple replacements work correctly', () => {
  const obj = { value: { n: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref = proxy.value

  proxy.value = { n: 2 }
  expect(ref.n).toBe(2)

  proxy.value = { n: 3 }
  expect(ref.n).toBe(3)

  proxy.value = { n: 4 }
  expect(ref.n).toBe(4)
})

test('Proxies for different keys are independent', () => {
  const obj = { a: { x: 1 }, b: { y: 2 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const refA = proxy.a
  const refB = proxy.b

  proxy.a = { x: 10 }

  // refA обновился, refB не затронут
  expect(refA.x).toBe(10)
  expect(refB.y).toBe(2)
})

test('Deep replacement does not break upper levels', () => {
  const obj = { level1: { level2: { level3: { value: 1 } } } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref1 = proxy.level1
  const ref2 = proxy.level1.level2
  const ref3 = proxy.level1.level2.level3

  // Заменяем level2
  proxy.level1.level2 = { level3: { value: 2 } }

  // ref1 все еще работает
  expect(ref1).toBe(proxy.level1)
  // ref2 переиспользован
  expect(ref2).toBe(proxy.level1.level2)
  // новое значение доступно
  expect(ref2.level3.value).toBe(2)
})

test('Array replacement works correctly', () => {
  const obj = { items: [1, 2, 3] }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref = proxy.items
  proxy.items = [4, 5, 6]

  expect(ref[0]).toBe(4)
  expect(ref.length).toBe(3)
})

test('Notify called on value change', () => {
  let notified = false
  let receivedValue: any = null

  const obj = { data: { x: 1 } }
  const state = createState((payload) => {
    notified = true
    receivedValue = payload
  })
  const proxy = state.deepWatch(obj)

  proxy.data
  proxy.data = { x: 2 }

  expect(notified).toBe(true)
  expect(receivedValue?.data?.x).toBe(2)
})
