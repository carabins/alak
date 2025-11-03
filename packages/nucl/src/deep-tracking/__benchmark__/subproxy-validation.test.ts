/**
 * Validation test: subProxy reuse correctness
 */

import { createState } from '../tracker'

function runTest(name: string, testFn: () => boolean) {
  try {
    const result = testFn()
    console.log(result ? '✅' : '❌', name)
    return result
  } catch (e) {
    console.log('❌', name, '- Error:', e.message)
    return false
  }
}

let allPassed = true

console.log('=== subProxy Reuse Validation ===\n')

// Test 1: Прокси переиспользуется при замене объекта
allPassed &= runTest('Proxy identity preserved when replacing object', () => {
  const obj = { nested: { a: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref1 = proxy.nested
  proxy.nested = { b: 2 }
  const ref2 = proxy.nested

  return ref1 === ref2 && ref2.b === 2 && ref2.a === undefined
})

// Test 2: Новое значение доступно через переиспользованный прокси
allPassed &= runTest('New value accessible through reused proxy', () => {
  const obj = { data: { x: 10 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const dataRef = proxy.data
  proxy.data = { y: 20, z: 30 }

  return dataRef.y === 20 && dataRef.z === 30 && dataRef.x === undefined
})

// Test 3: Старые дочерние прокси очищаются
allPassed &= runTest('Child proxies cleared on parent value change', () => {
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

  return newChildRef.value === 2 && oldValue === 1
})

// Test 4: Прокси удаляется при замене на примитив
allPassed &= runTest('Proxy removed when replaced with primitive', () => {
  const obj = { data: { x: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref = proxy.data
  proxy.data = 'string'

  return typeof proxy.data === 'string' && proxy.data === 'string'
})

// Test 5: Прокси удаляется при замене на null
allPassed &= runTest('Proxy removed when replaced with null', () => {
  const obj = { data: { x: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  proxy.data
  proxy.data = null

  return proxy.data === null
})

// Test 6: Множественные замены работают корректно
allPassed &= runTest('Multiple replacements work correctly', () => {
  const obj = { value: { n: 1 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref = proxy.value

  proxy.value = { n: 2 }
  const check1 = ref.n === 2

  proxy.value = { n: 3 }
  const check2 = ref.n === 3

  proxy.value = { n: 4 }
  const check3 = ref.n === 4

  return check1 && check2 && check3
})

// Test 7: Независимость прокси для разных ключей
allPassed &= runTest('Proxies for different keys are independent', () => {
  const obj = { a: { x: 1 }, b: { y: 2 } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const refA = proxy.a
  const refB = proxy.b

  proxy.a = { x: 10 }

  // refA обновился, refB не затронут
  return refA.x === 10 && refB.y === 2
})

// Test 8: Глубокая замена не ломает верхние уровни
allPassed &= runTest('Deep replacement does not break upper levels', () => {
  const obj = { level1: { level2: { level3: { value: 1 } } } }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref1 = proxy.level1
  const ref2 = proxy.level1.level2
  const ref3 = proxy.level1.level2.level3

  // Заменяем level2
  proxy.level1.level2 = { level3: { value: 2 } }

  // ref1 все еще работает
  const check1 = ref1 === proxy.level1
  // ref2 переиспользован
  const check2 = ref2 === proxy.level1.level2
  // новое значение доступно
  const check3 = ref2.level3.value === 2

  return check1 && check2 && check3
})

// Test 9: Массив заменяется корректно
allPassed &= runTest('Array replacement works correctly', () => {
  const obj = { items: [1, 2, 3] }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref = proxy.items
  proxy.items = [4, 5, 6]

  return ref[0] === 4 && ref.length === 3
})

// Test 10: Notify вызывается при изменениях
allPassed &= runTest('Notify called on value change', () => {
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

  return notified && receivedValue?.data?.x === 2
})

console.log('\n' + (allPassed ? '✅ All tests passed!' : '❌ Some tests failed'))
