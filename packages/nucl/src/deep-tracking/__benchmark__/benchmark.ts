import { reactive } from '@vue/reactivity'
import { createState } from '../index'


// Подготавливаем тестовые данные
const testData = {
  simpleObject: { a: 1, b: 2, c: { d: 3 } },
  nestedObject: { 
    level1: { 
      level2: { 
        level3: { 
          level4: { value: 'deep' },
          arr: [1, 2, 3, { deep: 'value' }]
        } 
      } 
    } 
  },
  array: [1, 2, 3, 4, 5],
  largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item${i}` })),
  // map: new Map([['key1', 'value1'], ['key2', { nested: 'value' }]]),
  // set: new Set([1, 2, 3, { obj: 'value' }])
}

// Функция для замера производительности
function benchmark(name: string, fn: () => void, iterations: number = 1000000) {
  const start = Date.now()

  for (let i = 0; i < iterations; i++) {
    fn()
  }

  const end = Date.now()
  console.log(`${name}: ${(end - start).toFixed(2)}ms for ${iterations} iterations`)
  return end - start
}

// Тестирование производительности обертывания объектов
console.log('=== Benchmarking Object Wrapping ===')

// Новая реализация
benchmark('New Tracker - Object Wrapping', () => {
  const tracker = createState(() => {})
  tracker.wrap({ ...testData.simpleObject })
})



// Vue reactive
benchmark('Vue Reactive - Object Wrapping', () => {
  reactive({ ...testData.simpleObject })
})

// Тестирование производительности обертывания массивов
console.log('\n=== Benchmarking Array Wrapping ===')

benchmark('New Tracker - Array Wrapping', () => {
  const tracker = createState(() => {})
  tracker.wrap([...testData.array])
})



benchmark('Vue Reactive - Array Wrapping', () => {
  reactive([...testData.array])
})

// Тестирование доступа к свойствам
console.log('\n=== Benchmarking Property Access ===')

const newTrackerObj = createState(() => {}).wrap({ ...testData.simpleObject })
const vueReactiveObj = reactive({ ...testData.simpleObject })

benchmark('New Tracker - Property Access', () => {
  const val = newTrackerObj.a
})


benchmark('Vue Reactive - Property Access', () => {
  const val = vueReactiveObj.a
})

// Тестирование обновления свойств
console.log('\n=== Benchmarking Property Update ===')

benchmark('New Tracker - Property Update', () => {
  const tracker = createState(() => {})
  const obj = tracker.wrap({ ...testData.simpleObject })
  obj.a = Math.random()
})

benchmark('Vue Reactive - Property Update', () => {
  const obj = reactive({ ...testData.simpleObject })
  obj.a = Math.random()
})

// Тестирование глубокой вложенности
console.log('\n=== Benchmarking Nested Object Access ===')

const newTrackerNested = createState(() => {}).wrap({ ...testData.nestedObject })
const vueReactiveNested = reactive({ ...testData.nestedObject })

benchmark('New Tracker - Nested Property Access', () => {
  const val = newTrackerNested.level1.level2.level3.level4.value
})

benchmark('Vue Reactive - Nested Property Access', () => {
  const val = vueReactiveNested.level1.level2.level3.level4.value
})

console.log('\n=== Benchmarking Nested Object Update ===')

// Create new objects for update tests to avoid mutation issues
benchmark('New Tracker - Nested Property Update', () => {
  const tracker = createState(() => {})
  const obj = tracker.wrap({ ...testData.nestedObject })
  obj.level1.level2.level3.level4.value = 'updated'
})

benchmark('Vue Reactive - Nested Property Update', () => {
  const obj = reactive({ ...testData.nestedObject })
  obj.level1.level2.level3.level4.value = 'updated'
})

// Тестирование операций с массивами
console.log('\n=== Benchmarking Array Operations ===')

benchmark('New Tracker - Array Index Access', () => {
  const tracker = createState(() => {})
  const arr = tracker.wrap([...testData.array])
  const val = arr[0]
})

benchmark('Vue Reactive - Array Index Access', () => {
  const arr = reactive([...testData.array])
  const val = arr[0]
})

benchmark('New Tracker - Array Index Update', () => {
  const tracker = createState(() => {})
  const arr = tracker.wrap([...testData.array])
  arr[0] = Math.random()
})

benchmark('Vue Reactive - Array Index Update', () => {
  const arr = reactive([...testData.array])
  arr[0] = Math.random()
})

// Тестирование работы с Map
console.log('\n=== Benchmarking Map Operations ===')

benchmark('Vue Reactive - Map Set', () => {
  const map = reactive(new Map([['key1', 'value1'], ['key2', { nested: 'value' }]]))
  map.set('testKey', Math.random())
})

benchmark('Vue Reactive - Map Get', () => {
  const map = reactive(new Map([['key1', 'value1'], ['key2', { nested: 'value' }]]))
  const val = map.get('key1')
})

// Тестирование работы с Set
console.log('\n=== Benchmarking Set Operations ===')

benchmark('Vue Reactive - Set Add', () => {
  const set = reactive(new Set([1, 2, 3, { obj: 'value' }]))
  set.add(Math.random())
})

benchmark('Vue Reactive - Set Has', () => {
  const set = reactive(new Set([1, 2, 3, { obj: 'value' }]))
  const val = set.has(1)
})

// Тестирование смешанных структур данных
console.log('\n=== Benchmarking Mixed Data Structures ===')

const mixedData = {
  obj: { a: 1, b: { c: 2 } },
  arr: [1, 2, { nested: 'value' }],
  map: new Map([['key', 'value']]),
  set: new Set([1, 2, 3])
}

const newTrackerMixed = createState(() => {}).wrap({ ...mixedData })
const vueReactiveMixed = reactive({ ...mixedData })

benchmark('New Tracker - Mixed Structure Access', () => {
  const val1 = newTrackerMixed.obj.b.c
  const val2 = newTrackerMixed.arr[2].nested
  const val3 = newTrackerMixed.map.get('key')
  const val4 = newTrackerMixed.set.has(1)
})

benchmark('Vue Reactive - Mixed Structure Access', () => {
  const val1 = vueReactiveMixed.obj.b.c
  const val2 = vueReactiveMixed.arr[2].nested
  const val3 = vueReactiveMixed.map.get('key')
  const val4 = vueReactiveMixed.set.has(1)
})

// Стресс-тест с большими наборами данных
console.log('\n=== Stress Testing with Large Data Sets ===')

const largeNestedObject = {
  items: Array.from({ length: 100 }, (_, i) => ({
    id: i,
    data: { value: i * 2, nested: { deep: `value${i}` } }
  }))
}

const newTrackerLarge = createState(() => {}).wrap({ ...largeNestedObject })
const vueReactiveLarge = reactive({ ...largeNestedObject })

benchmark('New Tracker - Large Object Creation', () => {
  createState(() => {}).wrap({ ...largeNestedObject })
})

benchmark('Vue Reactive - Large Object Creation', () => {
  reactive({ ...largeNestedObject })
})

benchmark('New Tracker - Large Object Property Access', () => {
  const val = newTrackerLarge.items[50].data.nested.deep
})

benchmark('Vue Reactive - Large Object Property Access', () => {
  const val = vueReactiveLarge.items[50].data.nested.deep
})

benchmark('New Tracker - Large Object Property Update', () => {
  const tracker = createState(() => {})
  const obj = tracker.wrap({ ...largeNestedObject })
  obj.items[50].data.nested.deep = 'updated'
})

benchmark('Vue Reactive - Large Object Property Update', () => {
  const obj = reactive({ ...largeNestedObject })
  obj.items[50].data.nested.deep = 'updated'
})

// Тестирование цепных операций (доступ + изменение)
console.log('\n=== Benchmarking Chained Operations ===')

const chainedObj = createState(() => {}).wrap({ data: { items: [{ value: 1 }] } })
const vueChainedObj = reactive({ data: { items: [{ value: 1 }] } })

benchmark('New Tracker - Chained Access and Update', () => {
  const tracker = createState(() => {})
  const obj = tracker.wrap({ data: { items: [{ value: 1 }] } })
  const item = obj.data.items[0]
  item.value = item.value + 1
})

benchmark('Vue Reactive - Chained Access and Update', () => {
  const obj = reactive({ data: { items: [{ value: 1 }] } })
  const item = obj.data.items[0]
  item.value = item.value + 1
})

benchmark('New Tracker - Multiple Sequential Updates', () => {
  const tracker = createState(() => {})
  const obj = tracker.wrap({ data: { items: [{ value: 1 }] } })
  obj.data.items[0].value++
  obj.data.items[0].value++
  obj.data.items[0].value++
})

benchmark('Vue Reactive - Multiple Sequential Updates', () => {
  const obj = reactive({ data: { items: [{ value: 1 }] } })
  obj.data.items[0].value++
  obj.data.items[0].value++
  obj.data.items[0].value++
})

console.log('\n=== Benchmarking Complete ===')

console.log('\n=== Benchmarking Complete ===')
