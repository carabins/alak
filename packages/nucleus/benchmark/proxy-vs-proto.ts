/**
 * Benchmark: Proxy vs Prototype для Nucleus
 *
 * Сравнение производительности между текущей реализацией на Proxy
 * и альтернативной реализацией на прототипах
 */

import { performance } from 'perf_hooks'

// ============================================================================
// PROXY-BASED IMPLEMENTATION (текущая)
// ============================================================================

interface QuarkProxy {
  (...args: any[]): any
  _: any
  value?: any
  listeners: Set<Function>
  uid: number
}

const handlersProxy = {
  up(this: QuarkProxy, f: Function) {
    this.listeners.add(f)
    if ('value' in this) {
      f(this.value)
    }
    return this._
  },
  down(this: QuarkProxy, f: Function) {
    this.listeners.delete(f)
    return this._
  },
  decay(this: QuarkProxy) {
    this.listeners.clear()
    delete this.value
  },
  silent(this: QuarkProxy, value: any) {
    this.value = value
    return this._
  },
  resend(this: QuarkProxy) {
    const v = this.value
    this.listeners.forEach(f => f(v))
    return this._
  },
  mutate(this: QuarkProxy, mutator: Function) {
    this.value = mutator(this.value)
    this.listeners.forEach(f => f(this.value))
    return this._
  }
}

const propsProxy = {
  isEmpty(this: QuarkProxy) {
    return !('value' in this)
  },
  isFilled(this: QuarkProxy) {
    return 'value' in this
  },
  haveListeners(this: QuarkProxy) {
    return this.listeners.size > 0
  }
}

function notifyListenersProxy(quark: QuarkProxy) {
  const v = quark.value
  quark.listeners.forEach(f => f(v))
}

function setValueProxy(quark: QuarkProxy, value: any) {
  quark.value = value
  notifyListenersProxy(quark)
  return value
}

const proxyHandler = {
  get(q: QuarkProxy, key: string): any {
    // Проверяем методы
    const handler = handlersProxy[key]
    if (handler) {
      return (...a) => handler.call(q, ...a)
    }

    // Проверяем свойства
    const prop = propsProxy[key]
    if (prop) {
      return prop.call(q)
    }

    // Возвращаем значение из quark
    return q[key]
  },
  set(q: QuarkProxy, key: string, value: any) {
    q[key] = value
    return true
  }
}

function createNucleusProxy(value?: any): any {
  const quark = function(...args: any[]) {
    if (args.length) {
      return setValueProxy(quark as any, args[0])
    } else {
      return quark.value
    }
  } as QuarkProxy

  quark.listeners = new Set()
  quark.uid = Math.random() * 1e15

  quark._ = new Proxy(quark, proxyHandler)

  if (value !== undefined) {
    quark.value = value
  }

  return quark._
}

// ============================================================================
// PROTOTYPE-BASED IMPLEMENTATION (альтернативная)
// ============================================================================

interface QuarkProto {
  (...args: any[]): any
  value?: any
  listeners: Set<Function>
  uid: number
}

function notifyListenersProto(this: QuarkProto) {
  const v = this.value
  this.listeners.forEach(f => f(v))
}

function setValueProto(this: QuarkProto, value: any) {
  this.value = value
  notifyListenersProto.call(this)
  return value
}

// Прототип с методами
const nucleusProtoMethods = {
  up(this: QuarkProto, f: Function) {
    this.listeners.add(f)
    if ('value' in this) {
      f(this.value)
    }
    return this
  },
  down(this: QuarkProto, f: Function) {
    this.listeners.delete(f)
    return this
  },
  decay(this: QuarkProto) {
    this.listeners.clear()
    delete this.value
  },
  silent(this: QuarkProto, value: any) {
    this.value = value
    return this
  },
  resend(this: QuarkProto) {
    notifyListenersProto.call(this)
    return this
  },
  mutate(this: QuarkProto, mutator: Function) {
    this.value = mutator(this.value)
    notifyListenersProto.call(this)
    return this
  }
}

// Геттеры для свойств
Object.defineProperties(nucleusProtoMethods, {
  isEmpty: {
    get(this: QuarkProto) {
      return !('value' in this)
    },
    enumerable: true
  },
  isFilled: {
    get(this: QuarkProto) {
      return 'value' in this
    },
    enumerable: true
  },
  haveListeners: {
    get(this: QuarkProto) {
      return this.listeners.size > 0
    },
    enumerable: true
  }
})

function createNucleusProto(value?: any): any {
  const quark = function(this: QuarkProto, ...args: any[]) {
    if (args.length) {
      return setValueProto.call(quark as any, args[0])
    } else {
      return quark.value
    }
  } as QuarkProto

  quark.listeners = new Set()
  quark.uid = Math.random() * 1e15

  // Устанавливаем прототип
  Object.setPrototypeOf(quark, nucleusProtoMethods)

  if (value !== undefined) {
    quark.value = value
  }

  return quark
}

// ============================================================================
// BENCHMARK UTILITIES
// ============================================================================

interface BenchmarkResult {
  name: string
  ops: number
  time: number
  avg: number
}

function benchmark(name: string, fn: () => void, iterations: number = 100000): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 1000; i++) {
    fn()
  }

  // Actual benchmark
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const end = performance.now()

  const time = end - start
  const avg = time / iterations
  const ops = Math.floor(iterations / (time / 1000))

  return { name, ops, time, avg }
}

function formatResult(result: BenchmarkResult): string {
  return `${result.name.padEnd(50)} | ${result.ops.toLocaleString().padStart(15)} ops/s | ${result.time.toFixed(2).padStart(10)}ms | ${(result.avg * 1000).toFixed(3).padStart(10)}µs/op`
}

function compareResults(proxy: BenchmarkResult, proto: BenchmarkResult): string {
  const diff = ((proto.ops - proxy.ops) / proxy.ops) * 100
  const faster = diff > 0 ? 'Prototype' : 'Proxy'
  const color = diff > 0 ? '\x1b[32m' : '\x1b[31m'
  const reset = '\x1b[0m'

  return `${color}${faster} is ${Math.abs(diff).toFixed(2)}% faster${reset}`
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

console.log('\n' + '='.repeat(100))
console.log('NUCLEUS PERFORMANCE BENCHMARK: Proxy vs Prototype')
console.log('='.repeat(100) + '\n')

const ITERATIONS = 100000

// Test 1: Создание nucleus
console.log('\n📦 Test 1: Creation Performance')
console.log('-'.repeat(100))

const proxyCreate = benchmark('Proxy - Create nucleus', () => {
  createNucleusProxy()
}, ITERATIONS)

const protoCreate = benchmark('Prototype - Create nucleus', () => {
  createNucleusProto()
}, ITERATIONS)

console.log(formatResult(proxyCreate))
console.log(formatResult(protoCreate))
console.log(compareResults(proxyCreate, protoCreate))

// Test 2: Создание с начальным значением
console.log('\n📦 Test 2: Creation with Initial Value')
console.log('-'.repeat(100))

const proxyCreateValue = benchmark('Proxy - Create with value', () => {
  createNucleusProxy(42)
}, ITERATIONS)

const protoCreateValue = benchmark('Prototype - Create with value', () => {
  createNucleusProto(42)
}, ITERATIONS)

console.log(formatResult(proxyCreateValue))
console.log(formatResult(protoCreateValue))
console.log(compareResults(proxyCreateValue, protoCreateValue))

// Test 3: Установка значения
console.log('\n✍️  Test 3: Set Value Performance')
console.log('-'.repeat(100))

let proxyN = createNucleusProxy()
const proxySet = benchmark('Proxy - Set value', () => {
  proxyN(Math.random())
}, ITERATIONS)

let protoN = createNucleusProto()
const protoSet = benchmark('Prototype - Set value', () => {
  protoN(Math.random())
}, ITERATIONS)

console.log(formatResult(proxySet))
console.log(formatResult(protoSet))
console.log(compareResults(proxySet, protoSet))

// Test 4: Получение значения
console.log('\n👁️  Test 4: Get Value Performance')
console.log('-'.repeat(100))

proxyN = createNucleusProxy(42)
const proxyGet = benchmark('Proxy - Get value', () => {
  proxyN()
}, ITERATIONS)

protoN = createNucleusProto(42)
const protoGet = benchmark('Prototype - Get value', () => {
  protoN()
}, ITERATIONS)

console.log(formatResult(proxyGet))
console.log(formatResult(protoGet))
console.log(compareResults(proxyGet, protoGet))

// Test 5: Подписка (up)
console.log('\n🔗 Test 5: Subscribe (up) Performance')
console.log('-'.repeat(100))

const listener = (v) => v

proxyN = createNucleusProxy(42)
const proxyUp = benchmark('Proxy - Subscribe (up)', () => {
  proxyN.up(() => {})
}, ITERATIONS / 10) // Меньше итераций для подписок

protoN = createNucleusProto(42)
const protoUp = benchmark('Prototype - Subscribe (up)', () => {
  protoN.up(() => {})
}, ITERATIONS / 10)

console.log(formatResult(proxyUp))
console.log(formatResult(protoUp))
console.log(compareResults(proxyUp, protoUp))

// Test 6: Нотификация слушателей
console.log('\n📢 Test 6: Notify Listeners Performance')
console.log('-'.repeat(100))

proxyN = createNucleusProxy(0)
for (let i = 0; i < 10; i++) {
  proxyN.up((v) => v + 1)
}
const proxyNotify = benchmark('Proxy - Notify 10 listeners', () => {
  proxyN(Math.random())
}, ITERATIONS / 10)

protoN = createNucleusProto(0)
for (let i = 0; i < 10; i++) {
  protoN.up((v) => v + 1)
}
const protoNotify = benchmark('Prototype - Notify 10 listeners', () => {
  protoN(Math.random())
}, ITERATIONS / 10)

console.log(formatResult(proxyNotify))
console.log(formatResult(protoNotify))
console.log(compareResults(proxyNotify, protoNotify))

// Test 7: Доступ к свойствам (isEmpty, isFilled)
console.log('\n🔍 Test 7: Property Access Performance')
console.log('-'.repeat(100))

proxyN = createNucleusProxy(42)
const proxyProps = benchmark('Proxy - Access properties', () => {
  const a = proxyN.isEmpty
  const b = proxyN.isFilled
  const c = proxyN.haveListeners
}, ITERATIONS)

protoN = createNucleusProto(42)
const protoProps = benchmark('Prototype - Access properties', () => {
  const a = protoN.isEmpty
  const b = protoN.isFilled
  const c = protoN.haveListeners
}, ITERATIONS)

console.log(formatResult(proxyProps))
console.log(formatResult(protoProps))
console.log(compareResults(proxyProps, protoProps))

// Test 8: Вызов методов
console.log('\n⚡ Test 8: Method Call Performance')
console.log('-'.repeat(100))

proxyN = createNucleusProxy(0)
const proxyMethods = benchmark('Proxy - Method calls', () => {
  proxyN.silent(Math.random())
  proxyN.resend()
}, ITERATIONS / 10)

protoN = createNucleusProto(0)
const protoMethods = benchmark('Prototype - Method calls', () => {
  protoN.silent(Math.random())
  protoN.resend()
}, ITERATIONS / 10)

console.log(formatResult(proxyMethods))
console.log(formatResult(protoMethods))
console.log(compareResults(proxyMethods, protoMethods))

// Test 9: Реалистичный сценарий
console.log('\n🎯 Test 9: Realistic Usage Scenario')
console.log('-'.repeat(100))

const proxyRealistic = benchmark('Proxy - Realistic scenario', () => {
  const n = createNucleusProxy(0)
  n.up((v) => v * 2)
  n.up((v) => v + 1)
  n(10)
  n(20)
  const val = n()
  n.decay()
}, ITERATIONS / 100)

const protoRealistic = benchmark('Prototype - Realistic scenario', () => {
  const n = createNucleusProto(0)
  n.up((v) => v * 2)
  n.up((v) => v + 1)
  n(10)
  n(20)
  const val = n()
  n.decay()
}, ITERATIONS / 100)

console.log(formatResult(proxyRealistic))
console.log(formatResult(protoRealistic))
console.log(compareResults(proxyRealistic, protoRealistic))

// Summary
console.log('\n' + '='.repeat(100))
console.log('SUMMARY')
console.log('='.repeat(100))

const tests = [
  { name: 'Creation', proxy: proxyCreate, proto: protoCreate },
  { name: 'Creation w/ value', proxy: proxyCreateValue, proto: protoCreateValue },
  { name: 'Set value', proxy: proxySet, proto: protoSet },
  { name: 'Get value', proxy: proxyGet, proto: protoGet },
  { name: 'Subscribe', proxy: proxyUp, proto: protoUp },
  { name: 'Notify listeners', proxy: proxyNotify, proto: protoNotify },
  { name: 'Property access', proxy: proxyProps, proto: protoProps },
  { name: 'Method calls', proxy: proxyMethods, proto: protoMethods },
  { name: 'Realistic scenario', proxy: proxyRealistic, proto: protoRealistic },
]

let proxyWins = 0
let protoWins = 0

console.log('\nTest'.padEnd(25) + 'Proxy'.padStart(20) + 'Prototype'.padStart(20) + 'Winner'.padStart(20))
console.log('-'.repeat(100))

tests.forEach(test => {
  const winner = test.proto.ops > test.proxy.ops ? 'Prototype' : 'Proxy'
  const diff = Math.abs(((test.proto.ops - test.proxy.ops) / test.proxy.ops) * 100).toFixed(1)

  if (winner === 'Prototype') protoWins++
  else proxyWins++

  const color = winner === 'Prototype' ? '\x1b[32m' : '\x1b[33m'
  const reset = '\x1b[0m'

  console.log(
    test.name.padEnd(25) +
    test.proxy.ops.toLocaleString().padStart(20) +
    test.proto.ops.toLocaleString().padStart(20) +
    `${color}${winner} (+${diff}%)${reset}`.padStart(30)
  )
})

console.log('\n' + '='.repeat(100))
console.log(`\nFinal Score: Proxy: ${proxyWins} | Prototype: ${protoWins}`)

if (protoWins > proxyWins) {
  console.log('\n✅ Prototype-based implementation is generally faster!')
} else if (proxyWins > protoWins) {
  console.log('\n⚠️  Proxy-based implementation performs better in most cases')
} else {
  console.log('\n🤝 Both implementations show similar performance')
}

console.log('\n' + '='.repeat(100) + '\n')
