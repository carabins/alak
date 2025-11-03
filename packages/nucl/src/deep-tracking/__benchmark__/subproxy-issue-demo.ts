/**
 * Демонстрация проблемы с subProxies при замене значений
 */

import { createState } from '../tracker'

const obj = {
  nested: { a: 1 },
  user: { name: 'John', profile: { age: 30 } }
}

let notifyCount = 0
const state = createState((info, type, target, oldValue) => {
  notifyCount++
  console.log(`[${notifyCount}] ${info}: ${type}`, { newValue: target, oldValue })
})

const proxy = state.deepWatch(obj)

console.log('=== Scenario 1: Замена вложенного объекта ===\n')

// Первый доступ - создается subProxy
const nested1 = proxy.nested
console.log('1. First access to nested:', nested1.a) // 1
console.log('   proxy.nested identity:', nested1 === proxy.nested) // true (кэшируется)

// Заменяем nested на новый объект
console.log('\n2. Replacing nested object...')
proxy.nested = { b: 2 }

// Второй доступ - получаем тот же subProxy?
const nested2 = proxy.nested
console.log('3. Second access to nested:', nested2)
console.log('   Has property "a"?', 'a' in nested2, nested2.a) // старый объект?
console.log('   Has property "b"?', 'b' in nested2, nested2.b) // новый объект?
console.log('   Identity preserved?', nested1 === nested2)

console.log('\n=== Scenario 2: Глубокая вложенность ===\n')

// Доступ к глубоко вложенному объекту
const profile1 = proxy.user.profile
console.log('4. Deep access:', profile1.age) // 30

// Заменяем user (родитель profile)
console.log('\n5. Replacing parent object...')
proxy.user = { name: 'Jane', profile: { age: 25 } }

// Пытаемся получить profile
const profile2 = proxy.user.profile
console.log('6. After parent replacement:')
console.log('   profile.age =', profile2.age) // должно быть 25, но что на самом деле?
console.log('   Identity:', profile1 === profile2)

console.log('\n=== Scenario 3: Замена объекта на примитив ===\n')

proxy.nested = 'now a string'
console.log('7. Replaced with primitive:', proxy.nested)
const nested3 = proxy.nested
console.log('   Type:', typeof nested3) // должен быть string, но может быть proxy?
