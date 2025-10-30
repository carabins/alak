/**
 * Nucl vs Quark Performance Comparison
 *
 * Measures performance overhead of Nucl's plugin system compared to bare Quark
 */

import { Qu } from '@alaq/quark'
import { Nucl } from '../src/index'
import { Nucl as NuclWithPlugins } from '../src/nucleus'
import { HeavyNucl } from '../src/heavy'

interface BenchResult {
  name: string
  ops: number
  time: number
  opsPerMs: number
}

interface ComparisonResult {
  quark: BenchResult
  nucl: BenchResult
  nuclWithPlugins: BenchResult
  heavyNucl: BenchResult
  overhead: {
    nucl: string
    nuclWithPlugins: string
    heavyNucl: string
  }
}

const results: ComparisonResult[] = []

function bench(name: string, ops: number, fn: () => void): BenchResult {
  // JIT warm-up
  for (let i = 0; i < 1000; i++) {
    fn()
  }

  // Actual benchmark
  const start = performance.now()
  for (let i = 0; i < ops; i++) {
    fn()
  }
  const time = performance.now() - start

  return {
    name,
    ops,
    time: Math.round(time * 100) / 100,
    opsPerMs: Math.round((ops / time) * 100) / 100
  }
}

function compare(name: string, ops: number, testFn: (factory: any) => void) {
  console.log(`\n🔬 ${name}`)

  const quark = bench(`${name} (Quark)`, ops, () => testFn(Qu))
  console.log(`  Quark:            ${quark.opsPerMs.toLocaleString()} ops/ms`)

  const nucl = bench(`${name} (Nucl)`, ops, () => testFn(Nucl))
  console.log(`  Nucl:             ${nucl.opsPerMs.toLocaleString()} ops/ms`)

  const nuclWithPlugins = bench(`${name} (Nucl+plugins)`, ops, () => testFn(NuclWithPlugins))
  console.log(`  Nucl+plugins:     ${nuclWithPlugins.opsPerMs.toLocaleString()} ops/ms`)

  const heavyNucl = bench(`${name} (HeavyNucl)`, ops, () => testFn(HeavyNucl))
  console.log(`  HeavyNucl:        ${heavyNucl.opsPerMs.toLocaleString()} ops/ms`)

  const nuclOverhead = ((quark.opsPerMs - nucl.opsPerMs) / quark.opsPerMs * 100).toFixed(2)
  const pluginsOverhead = ((quark.opsPerMs - nuclWithPlugins.opsPerMs) / quark.opsPerMs * 100).toFixed(2)
  const heavyOverhead = ((quark.opsPerMs - heavyNucl.opsPerMs) / quark.opsPerMs * 100).toFixed(2)

  console.log(`  Overhead: Nucl=${nuclOverhead}%, Nucl+plugins=${pluginsOverhead}%, HeavyNucl=${heavyOverhead}%`)

  results.push({
    quark,
    nucl,
    nuclWithPlugins,
    heavyNucl,
    overhead: {
      nucl: nuclOverhead + '%',
      nuclWithPlugins: pluginsOverhead + '%',
      heavyNucl: heavyOverhead + '%'
    }
  })
}

console.log('🚀 NUCL VS QUARK PERFORMANCE COMPARISON\n')
console.log('=' .repeat(60))

// ============================================================================
// 1. CREATION BENCHMARKS
// ============================================================================
console.log('\n📦 CREATION BENCHMARKS')
console.log('-'.repeat(60))

compare('Create empty', 100000, (Factory) => {
  const q = Factory()
})

compare('Create with value', 100000, (Factory) => {
  const q = Factory(42)
})

compare('Create with object value', 100000, (Factory) => {
  const q = Factory({ value: 42, id: 'test' })
})

// ============================================================================
// 2. GET/SET BENCHMARKS
// ============================================================================
console.log('\n📝 GET/SET BENCHMARKS')
console.log('-'.repeat(60))

compare('Get value', 1000000, (Factory) => {
  const q = Factory(42)
  const v = q.value
})

compare('Set value', 500000, (Factory) => {
  const q = Factory(0)
  q(42)
})

compare('Set value repeatedly', 100000, (Factory) => {
  const q = Factory(0)
  q(1)
  q(2)
  q(3)
  q(4)
  q(5)
})

// ============================================================================
// 3. LISTENER BENCHMARKS
// ============================================================================
console.log('\n👂 LISTENER BENCHMARKS')
console.log('-'.repeat(60))

compare('Add listener', 100000, (Factory) => {
  const q = Factory(0)
  q.up(() => {})
})

compare('Notify 1 listener', 100000, (Factory) => {
  const q = Factory(0)
  let count = 0
  q.up(() => count++)
  q(1)
})

compare('Notify 5 listeners', 50000, (Factory) => {
  const q = Factory(0)
  let count = 0
  q.up(() => count++)
  q.up(() => count++)
  q.up(() => count++)
  q.up(() => count++)
  q.up(() => count++)
  q(1)
})

// ============================================================================
// 4. PLUGIN-SPECIFIC BENCHMARKS (only for Nucl variants)
// ============================================================================
console.log('\n🔌 PLUGIN-SPECIFIC BENCHMARKS')
console.log('-'.repeat(60))

console.log('\n🔬 Array operations (isEmpty, size)')
const nuclArray = bench('Array .isEmpty', 500000, () => {
  const q = NuclWithPlugins([1, 2, 3]) as any
  const empty = q.isEmpty
})

const nuclArraySize = bench('Array .size', 500000, () => {
  const q = NuclWithPlugins([1, 2, 3]) as any
  const len = q.size
})

console.log(`  Array .isEmpty:   ${nuclArray.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Array .size:      ${nuclArraySize.opsPerMs.toLocaleString()} ops/ms`)

console.log('\n🔬 Object operations (keys, values)')
const nuclObjKeys = bench('Object .keys', 500000, () => {
  const q = NuclWithPlugins({ a: 1, b: 2, c: 3 }) as any
  const keys = q.keys
})

const nuclObjValues = bench('Object .values', 500000, () => {
  const q = NuclWithPlugins({ a: 1, b: 2, c: 3 }) as any
  const vals = q.values
})

console.log(`  Object .keys:     ${nuclObjKeys.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Object .values:   ${nuclObjValues.opsPerMs.toLocaleString()} ops/ms`)

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(60))
console.log('📊 SUMMARY')
console.log('='.repeat(60))

const avgQuark = results.reduce((sum, r) => sum + r.quark.opsPerMs, 0) / results.length
const avgNucl = results.reduce((sum, r) => sum + r.nucl.opsPerMs, 0) / results.length
const avgPlugins = results.reduce((sum, r) => sum + r.nuclWithPlugins.opsPerMs, 0) / results.length
const avgHeavy = results.reduce((sum, r) => sum + r.heavyNucl.opsPerMs, 0) / results.length

console.log(`\nAverage Performance:`)
console.log(`  Quark:            ${avgQuark.toLocaleString()} ops/ms`)
console.log(`  Nucl (bare):      ${avgNucl.toLocaleString()} ops/ms`)
console.log(`  Nucl+plugins:     ${avgPlugins.toLocaleString()} ops/ms`)
console.log(`  HeavyNucl:        ${avgHeavy.toLocaleString()} ops/ms`)

const avgNuclOverhead = ((avgQuark - avgNucl) / avgQuark * 100).toFixed(2)
const avgPluginsOverhead = ((avgQuark - avgPlugins) / avgQuark * 100).toFixed(2)
const avgHeavyOverhead = ((avgQuark - avgHeavy) / avgQuark * 100).toFixed(2)

console.log(`\nAverage Overhead:`)
console.log(`  Nucl (bare):      ${avgNuclOverhead}%`)
console.log(`  Nucl+plugins:     ${avgPluginsOverhead}%`)
console.log(`  HeavyNucl:        ${avgHeavyOverhead}%`)

console.log(`\n✅ Benchmark complete!`)

export const comparisonResults = {
  timestamp: Date.now(),
  runtime: `Bun ${Bun.version}`,
  platform: process.platform,
  arch: process.arch,
  results,
  summary: {
    avgQuark,
    avgNucl,
    avgPlugins,
    avgHeavy,
    avgNuclOverhead,
    avgPluginsOverhead,
    avgHeavyOverhead
  }
}
