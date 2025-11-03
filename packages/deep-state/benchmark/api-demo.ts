/**
 * Demo: New API - createState + deepWatch
 */

import { createState } from '../src/index'

console.log('=== New Deep State API Demo ===\n')

// 1. Создаем deep state instance
const deepState = createState((value, { path, type, target, oldValue }) => {
  console.log(`[${type}] ${path}:`, { newValue: target[path.split('.').pop()!], oldValue })
})

// 2. Начинаем отслеживать объект через deepWatch()
const state = deepState.deepWatch({
  user: {
    name: 'Alice',
    profile: {
      age: 25,
      city: 'Moscow'
    }
  },
  items: [1, 2, 3]
})

console.log('1. Setting user.name...')
state.user.name = 'Bob'

console.log('\n2. Replacing nested profile...')
state.user.profile = { age: 30, city: 'SPB' }

console.log('\n3. Pushing to array...')
state.items.push(4)

console.log('\n4. Direct array assignment...')
state.items = [10, 20, 30]

console.log('\n=== API Comparison ===\n')

console.log('OLD API:')
console.log('  const { wrap } = createTracker(notify, options)')
console.log('  const proxy = wrap(value)')

console.log('\nNEW API:')
console.log('  const state = createState(notify, options)')
console.log('  const proxy = state.deepWatch(value)')

console.log('\n✅ More intuitive: createState -> deepWatch')
console.log('✅ Perfect naming: "deep state" concept')
console.log('✅ Semantic clarity: state.deepWatch = глубокое отслеживание состояния')
console.log('✅ Future-ready: state.deepWatch(), state.unwatch(), etc.')
