/**
 * Benchmark: Proxy vs Prototype vs ES6 Class vs Object.create
 *
 * Сравнение всех основных подходов к созданию объектов в JavaScript
 */

import { performance } from 'perf_hooks'

// ============================================================================
// 1. PROXY-BASED (текущая реализация nucleus)
// ============================================================================

const handlersProxy = {
  up(this: any, f: Function) {
    this.listeners.add(f)
    if ('value' in this) f(this.value)
    return this._
  },
  down(this: any, f: Function) {
    this.listeners.delete(f)
    return this._
  },
  decay(this: any) {
    this.listeners.clear()
    delete this.value
  }
}

const propsProxy = {
  isEmpty(this: any) { return !('value' in this) },
  isFilled(this: any) { return 'value' in this }
}

function createProxy(value?: any) {
  const obj = function(...args: any[]) {
    if (args.length) {
      obj.value = args[0]
      obj.listeners.forEach(f => f(obj.value))
      return args[0]
    }
    return obj.value
  } as any

  obj.listeners = new Set()
  obj.uid = Math.random()

  obj._ = new Proxy(obj, {
    get(q, key) {
      const handler = handlersProxy[key]
      if (handler) return (...a) => handler.call(q, ...a)
      const prop = propsProxy[key]
      if (prop) return prop.call(q)
      return q[key]
    }
  })

  if (value !== undefined) obj.value = value
  return obj._
}

// ============================================================================
// 2. PROTOTYPE-BASED (Function + setPrototypeOf)
// ============================================================================

const nucleusProtoMethods = {
  up(this: any, f: Function) {
    this.listeners.add(f)
    if ('value' in this) f(this.value)
    return this
  },
  down(this: any, f: Function) {
    this.listeners.delete(f)
    return this
  },
  decay(this: any) {
    this.listeners.clear()
    delete this.value
  }
}

Object.defineProperties(nucleusProtoMethods, {
  isEmpty: {
    get(this: any) { return !('value' in this) },
    enumerable: true
  },
  isFilled: {
    get(this: any) { return 'value' in this },
    enumerable: true
  }
})

function createPrototype(value?: any) {
  const obj = function(...args: any[]) {
    if (args.length) {
      obj.value = args[0]
      obj.listeners.forEach(f => f(obj.value))
      return args[0]
    }
    return obj.value
  } as any

  obj.listeners = new Set()
  obj.uid = Math.random()

  Object.setPrototypeOf(obj, nucleusProtoMethods)

  if (value !== undefined) obj.value = value
  return obj
}

// ============================================================================
// 3. ES6 CLASS (синтаксический сахар над прототипами)
// ============================================================================

class NucleusClass {
  listeners: Set<Function>
  uid: number
  value?: any

  constructor(value?: any) {
    this.listeners = new Set()
    this.uid = Math.random()
    if (value !== undefined) this.value = value
  }

  // Callable через метод (классы не могут быть callable напрямую)
  call(...args: any[]) {
    if (args.length) {
      this.value = args[0]
      this.listeners.forEach(f => f(this.value))
      return args[0]
    }
    return this.value
  }

  up(f: Function) {
    this.listeners.add(f)
    if ('value' in this) f(this.value)
    return this
  }

  down(f: Function) {
    this.listeners.delete(f)
    return this
  }

  decay() {
    this.listeners.clear()
    delete this.value
  }

  get isEmpty() {
    return !('value' in this)
  }

  get isFilled() {
    return 'value' in this
  }
}

function createClass(value?: any) {
  return new NucleusClass(value)
}

// ============================================================================
// 4. OBJECT.CREATE (самый простой подход с прототипом)
// ============================================================================

const objectCreateProto = {
  call(...args: any[]) {
    if (args.length) {
      this.value = args[0]
      this.listeners.forEach(f => f(this.value))
      return args[0]
    }
    return this.value
  },
  up(f: Function) {
    this.listeners.add(f)
    if ('value' in this) f(this.value)
    return this
  },
  down(f: Function) {
    this.listeners.delete(f)
    return this
  },
  decay() {
    this.listeners.clear()
    delete this.value
  },
  get isEmpty() {
    return !('value' in this)
  },
  get isFilled() {
    return 'value' in this
  }
}

function createObjectCreate(value?: any) {
  const obj = Object.create(objectCreateProto)
  obj.listeners = new Set()
  obj.uid = Math.random()
  if (value !== undefined) obj.value = value
  return obj
}

// ============================================================================
// 5. PLAIN FUNCTION + MANUAL METHODS (без прототипа, все методы на объекте)
// ============================================================================

function createPlainFunction(value?: any) {
  const obj = function(...args: any[]) {
    if (args.length) {
      obj.value = args[0]
      obj.listeners.forEach(f => f(obj.value))
      return args[0]
    }
    return obj.value
  } as any

  obj.listeners = new Set()
  obj.uid = Math.random()

  // Методы прямо на объекте (не в прототипе!)
  obj.up = function(f: Function) {
    this.listeners.add(f)
    if ('value' in this) f(this.value)
    return this
  }

  obj.down = function(f: Function) {
    this.listeners.delete(f)
    return this
  }

  obj.decay = function() {
    this.listeners.clear()
    delete this.value
  }

  Object.defineProperties(obj, {
    isEmpty: {
      get() { return !('value' in this) },
      enumerable: true
    },
    isFilled: {
      get() { return 'value' in this },
      enumerable: true
    }
  })

  if (value !== undefined) obj.value = value
  return obj
}

// ============================================================================
// BENCHMARK UTILITIES
// ============================================================================

interface BenchmarkResult {
  name: string
  ops: number
  time: number
}

function benchmark(name: string, fn: () => void, iterations: number = 100000): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 1000; i++) fn()

  // Actual benchmark
  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn()
  const end = performance.now()

  const time = end - start
  const ops = Math.floor(iterations / (time / 1000))

  return { name, ops, time }
}

function formatOps(ops: number): string {
  if (ops > 1000000) return `${(ops / 1000000).toFixed(2)}M`
  if (ops > 1000) return `${(ops / 1000).toFixed(2)}K`
  return ops.toString()
}

// ============================================================================
// RUN BENCHMARKS
// ============================================================================

console.log('\n' + '='.repeat(120))
console.log('COMPREHENSIVE BENCHMARK: Proxy vs Prototype vs Class vs Object.create vs Plain Function')
console.log('='.repeat(120) + '\n')

const approaches = [
  { name: 'Proxy', create: createProxy },
  { name: 'Prototype', create: createPrototype },
  { name: 'ES6 Class', create: createClass },
  { name: 'Object.create', create: createObjectCreate },
  { name: 'Plain Function', create: createPlainFunction }
]

const ITERATIONS = 100000

// Test 1: Creation
console.log('📦 Test 1: Creation Performance')
console.log('-'.repeat(120))

const creationResults = approaches.map(({ name, create }) => {
  return benchmark(`${name.padEnd(20)} - Create`, () => create(), ITERATIONS)
})

creationResults.forEach(r => {
  console.log(`${r.name.padEnd(40)} | ${formatOps(r.ops).padStart(10)} ops/s | ${r.time.toFixed(2).padStart(8)}ms`)
})

const fastestCreation = Math.max(...creationResults.map(r => r.ops))
console.log('\n🏆 Winner: ' + creationResults.find(r => r.ops === fastestCreation)?.name)

// Test 2: Creation with value
console.log('\n\n📦 Test 2: Creation with Initial Value')
console.log('-'.repeat(120))

const creationValueResults = approaches.map(({ name, create }) => {
  return benchmark(`${name.padEnd(20)} - Create w/ value`, () => create(42), ITERATIONS)
})

creationValueResults.forEach(r => {
  console.log(`${r.name.padEnd(40)} | ${formatOps(r.ops).padStart(10)} ops/s | ${r.time.toFixed(2).padStart(8)}ms`)
})

const fastestCreationValue = Math.max(...creationValueResults.map(r => r.ops))
console.log('\n🏆 Winner: ' + creationValueResults.find(r => r.ops === fastestCreationValue)?.name)

// Test 3: Method calls
console.log('\n\n⚡ Test 3: Method Call Performance (up/down)')
console.log('-'.repeat(120))

const methodResults = approaches.map(({ name, create }) => {
  const obj = create(42)
  const fn = () => {}
  return benchmark(`${name.padEnd(20)} - Method calls`, () => {
    obj.up(fn)
    obj.down(fn)
  }, ITERATIONS / 10)
})

methodResults.forEach(r => {
  console.log(`${r.name.padEnd(40)} | ${formatOps(r.ops).padStart(10)} ops/s | ${r.time.toFixed(2).padStart(8)}ms`)
})

const fastestMethod = Math.max(...methodResults.map(r => r.ops))
console.log('\n🏆 Winner: ' + methodResults.find(r => r.ops === fastestMethod)?.name)

// Test 4: Property access
console.log('\n\n🔍 Test 4: Property Access (getters)')
console.log('-'.repeat(120))

const propResults = approaches.map(({ name, create }) => {
  const obj = create(42)
  return benchmark(`${name.padEnd(20)} - Property access`, () => {
    const a = obj.isEmpty
    const b = obj.isFilled
  }, ITERATIONS)
})

propResults.forEach(r => {
  console.log(`${r.name.padEnd(40)} | ${formatOps(r.ops).padStart(10)} ops/s | ${r.time.toFixed(2).padStart(8)}ms`)
})

const fastestProp = Math.max(...propResults.map(r => r.ops))
console.log('\n🏆 Winner: ' + propResults.find(r => r.ops === fastestProp)?.name)

// Test 5: Call as function (set/get value)
console.log('\n\n📞 Test 5: Function Call Performance')
console.log('-'.repeat(120))

const callResults = approaches.map(({ name, create }) => {
  let obj = create(0)

  // Object.create и ES6 Class используют метод call()
  if (name === 'Object.create' || name === 'ES6 Class') {
    return benchmark(`${name.padEnd(20)} - Function call`, () => {
      obj.call(Math.random())
      obj.call()
    }, ITERATIONS)
  }

  // Остальные поддерживают прямой вызов как функция
  return benchmark(`${name.padEnd(20)} - Function call`, () => {
    obj(Math.random())
    obj()
  }, ITERATIONS)
})

callResults.forEach(r => {
  console.log(`${r.name.padEnd(40)} | ${formatOps(r.ops).padStart(10)} ops/s | ${r.time.toFixed(2).padStart(8)}ms`)
})

const fastestCall = Math.max(...callResults.map(r => r.ops))
console.log('\n🏆 Winner: ' + callResults.find(r => r.ops === fastestCall)?.name)

// Test 6: Realistic scenario
console.log('\n\n🎯 Test 6: Realistic Usage Scenario')
console.log('-'.repeat(120))

const realisticResults = approaches.map(({ name, create }) => {
  return benchmark(`${name.padEnd(20)} - Realistic`, () => {
    const obj = create(0)
    obj.up(() => {})
    obj.up(() => {})

    if (name === 'Object.create' || name === 'ES6 Class') {
      obj.call(10)
      obj.call(20)
      const v = obj.call()
    } else {
      obj(10)
      obj(20)
      const v = obj()
    }

    const e = obj.isEmpty
    obj.decay()
  }, ITERATIONS / 100)
})

realisticResults.forEach(r => {
  console.log(`${r.name.padEnd(40)} | ${formatOps(r.ops).padStart(10)} ops/s | ${r.time.toFixed(2).padStart(8)}ms`)
})

const fastestRealistic = Math.max(...realisticResults.map(r => r.ops))
console.log('\n🏆 Winner: ' + realisticResults.find(r => r.ops === fastestRealistic)?.name)

// Summary
console.log('\n\n' + '='.repeat(120))
console.log('SUMMARY')
console.log('='.repeat(120))

const allTests = [
  { name: 'Creation', results: creationResults },
  { name: 'Creation w/ value', results: creationValueResults },
  { name: 'Method calls', results: methodResults },
  { name: 'Property access', results: propResults },
  { name: 'Function call', results: callResults },
  { name: 'Realistic', results: realisticResults }
]

const scores = approaches.map(a => ({ name: a.name, wins: 0 }))

console.log('\n' + 'Test'.padEnd(25) + approaches.map(a => a.name.padStart(18)).join(''))
console.log('-'.repeat(120))

allTests.forEach(test => {
  const maxOps = Math.max(...test.results.map(r => r.ops))
  const winner = test.results.find(r => r.ops === maxOps)
  const winnerIdx = approaches.findIndex(a => a.name === winner?.name.split('-')[0].trim())
  if (winnerIdx >= 0) scores[winnerIdx].wins++

  console.log(
    test.name.padEnd(25) +
    test.results.map(r => {
      const isWinner = r.ops === maxOps
      const ops = formatOps(r.ops)
      return isWinner ? `\x1b[32m${ops.padStart(18)}\x1b[0m` : ops.padStart(18)
    }).join('')
  )
})

console.log('\n' + '='.repeat(120))
console.log('WINS: ' + scores.map(s => `${s.name}: ${s.wins}`).join(' | '))

const topScore = Math.max(...scores.map(s => s.wins))
const winner = scores.find(s => s.wins === topScore)

console.log('\n🏆 OVERALL WINNER: ' + winner?.name + ' (' + winner?.wins + '/6 tests)')
console.log('='.repeat(120) + '\n')
