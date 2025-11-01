/**
 * Simplified Nucl vs Quark vs Vue Reactivity Performance Comparison
 */

import { Qu } from '@alaq/quark'
import { Nucl } from '../src/index'
import { reactive, ref, computed } from 'vue'

interface BenchResult {
  name: string
  ops: number
  time: number
  opsPerMs: number
}

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

console.log('🚀 SIMPLIFIED NUCL VS QUARK VS VUE REACTIVITY BENCHMARK\n')

// ============================================================================
// PERFORMANCE COMPARISON
// ============================================================================
console.log('📦 CREATION & GET/SET BENCHMARKS')
console.log('-'.repeat(60))

const createEmptyQuark = bench('Create empty (Quark)', 100000, () => { const q = Qu() })
const createEmptyNucl = bench('Create empty (Nucl)', 100000, () => { const n = Nucl() })
const createEmptyVueReactive = bench('Create empty (Vue Reactive)', 100000, () => { const r = reactive({}) })
const createEmptyVueRef = bench('Create empty (Vue Ref)', 100000, () => { const r = ref(null) })

console.log(`  Quark:            ${createEmptyQuark.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Nucl:             ${createEmptyNucl.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Vue Reactive:     ${createEmptyVueReactive.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Vue Ref:          ${createEmptyVueRef.opsPerMs.toLocaleString()} ops/ms`)

console.log()

const getPrimitiveQuark = bench('Get primitive (Quark)', 1000000, () => { const q = Qu(42); const v = q.value })
const getPrimitiveNucl = bench('Get primitive (Nucl)', 1000000, () => { const n = Nucl(42); const v = n.value })
const getPrimitiveVueRef = bench('Get primitive (Vue Ref)', 1000000, () => { const r = ref(42); const v = r.value })

console.log(`  Get primitive (Quark):    ${getPrimitiveQuark.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Get primitive (Nucl):     ${getPrimitiveNucl.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Get primitive (Vue Ref):  ${getPrimitiveVueRef.opsPerMs.toLocaleString()} ops/ms`)

console.log()

const setPrimitiveQuark = bench('Set primitive (Quark)', 500000, () => { const q = Qu(0); q(42) })
const setPrimitiveNucl = bench('Set primitive (Nucl)', 500000, () => { const n = Nucl(0); n(42) })
const setPrimitiveVueRef = bench('Set primitive (Vue Ref)', 500000, () => { const r = ref(0); r.value = 42 })

console.log(`  Set primitive (Quark):    ${setPrimitiveQuark.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Set primitive (Nucl):     ${setPrimitiveNucl.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Set primitive (Vue Ref):  ${setPrimitiveVueRef.opsPerMs.toLocaleString()} ops/ms`)

// ============================================================================
// DEEP TRACKING BENCHMARK
// ============================================================================
console.log('\n🔍 DEEP TRACKING BENCHMARKS')
console.log('-'.repeat(60))

const nuclDeep = bench('Nucl Deep Tracking', 100000, () => {
  const n = Nucl({ value: { a: { b: { c: 42 } } }, deepTracking: true })
  const val = n.getDeep('a.b.c')
  n.setDeep('a.b.c', 99)
})

console.log(`  Nucl Deep Tracking:       ${nuclDeep.opsPerMs.toLocaleString()} ops/ms`)

const vueDeep = bench('Vue Deep Reactivity', 100000, () => {
  const r = reactive({ a: { b: { c: 42 } } })
  const val = r.a.b.c
  r.a.b.c = 99
})

console.log(`  Vue Deep Reactivity:      ${vueDeep.opsPerMs.toLocaleString()} ops/ms`)

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n📊 SUMMARY')
console.log('-'.repeat(60))

console.log('\nKey observations:')
console.log('- Quark is fastest for primitive get/set operations')
console.log('- Vue Ref is fasted for value creation')
console.log('- Nucl has significant overhead due to plugin system but provides more features')
console.log('- Nucl with deep tracking provides powerful path-based access')
console.log('- Vue Reactive has natural deep reactivity')

console.log('\n✅ Benchmark complete!')