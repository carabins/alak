/**
 * Nucl vs Quark vs Vue Reactivity Performance Comparison
 *
 * Measures performance of different reactivity systems
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

interface ComparisonResult {
  quark: BenchResult
  nucl: BenchResult
  vueReactive: BenchResult
  vueRef: BenchResult
  computed: {
    quark: BenchResult
    nucl: BenchResult
    vueComputed: BenchResult
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

function benchmarkQuark(name: string, ops: number, testFn: () => void) {
  return bench(`${name} (Quark)`, ops, testFn)
}

function benchmarkNucl(name: string, ops: number, testFn: () => void) {
  return bench(`${name} (Nucl)`, ops, testFn)
}

function benchmarkVueReactive(name: string, ops: number, testFn: () => void) {
  return bench(`${name} (Vue Reactive)`, ops, testFn)
}

function benchmarkVueRef(name: string, ops: number, testFn: () => void) {
  return bench(`${name} (Vue Ref)`, ops, testFn)
}

function benchmarkQuarkComputed(name: string, ops: number, testFn: () => void) {
  return bench(`${name} (Quark Computed)`, ops, testFn)
}

function benchmarkNuclComputed(name: string, ops: number, testFn: () => void) {
  return bench(`${name} (Nucl Computed)`, ops, testFn)
}

function benchmarkVueComputed(name: string, ops: number, testFn: () => void) {
  return bench(`${name} (Vue Computed)`, ops, testFn)
}

function compareSimple(name: string, ops: number, 
  quarkFn: () => void, 
  nuclFn: () => void, 
  vueReactiveFn: () => void, 
  vueRefFn: () => void) {
  
  console.log(`\n🔬 ${name}`)

  const quark = benchmarkQuark(name, ops, quarkFn)
  console.log(`  Quark:            ${quark.opsPerMs.toLocaleString()} ops/ms`)

  const nucl = benchmarkNucl(name, ops, nuclFn)
  console.log(`  Nucl:             ${nucl.opsPerMs.toLocaleString()} ops/ms`)

  const vueReactive = benchmarkVueReactive(name, ops, vueReactiveFn)
  console.log(`  Vue Reactive:     ${vueReactive.opsPerMs.toLocaleString()} ops/ms`)

  const vueRef = benchmarkVueRef(name, ops, vueRefFn)
  console.log(`  Vue Ref:          ${vueRef.opsPerMs.toLocaleString()} ops/ms`)

  results.push({
    quark,
    nucl,
    vueReactive,
    vueRef,
    computed: {
      quark: null,
      nucl: null,
      vueComputed: null
    }
  })
}

function compareComputed(name: string, ops: number,
  quarkFn: () => void,
  nuclFn: () => void,
  vueComputedFn: () => void) {
  
  console.log(`\n🔬 ${name}`)

  const quark = benchmarkQuarkComputed(name, ops, quarkFn)
  console.log(`  Quark Computed:   ${quark.opsPerMs.toLocaleString()} ops/ms`)

  const nucl = benchmarkNuclComputed(name, ops, nuclFn)
  console.log(`  Nucl Computed:    ${nucl.opsPerMs.toLocaleString()} ops/ms`)

  const vueComputed = benchmarkVueComputed(name, ops, vueComputedFn)
  console.log(`  Vue Computed:     ${vueComputed.opsPerMs.toLocaleString()} ops/ms`)

  // Update the last result with computed values
  if (results.length > 0) {
    const lastResult = results[results.length - 1]
    lastResult.computed = {
      quark,
      nucl,
      vueComputed
    }
  }
}

console.log('🚀 NUCL VS QUARK VS VUE REACTIVITY PERFORMANCE COMPARISON\n')
console.log('=' .repeat(80))

// ============================================================================
// 1. CREATION BENCHMARKS
// ============================================================================
console.log('\n📦 CREATION BENCHMARKS')
console.log('-'.repeat(80))

compareSimple('Create empty value', 100000,
  () => { const q = Qu() },
  () => { const n = Nucl() },
  () => { const r = reactive({}) },
  () => { const r = ref(null) }
)

compareSimple('Create with primitive value', 100000,
  () => { const q = Qu(42) },
  () => { const n = Nucl(42) },
  () => { const r = reactive({ value: 42 }); r.value },
  () => { const r = ref(42); r.value }
)

compareSimple('Create with object value', 100000,
  () => { const q = Qu({ a: 1, b: 2 }) },
  () => { const n = Nucl({ a: 1, b: 2 }) },
  () => { const r = reactive({ a: 1, b: 2 }); r.a; r.b },
  () => { const r = ref({ a: 1, b: 2 }); r.value.a; r.value.b }
)

// ============================================================================
// 2. GET/SET BENCHMARKS
// ============================================================================
console.log('\n📝 GET/SET BENCHMARKS')
console.log('-'.repeat(80))

compareSimple('Get primitive value', 1000000,
  () => { const q = Qu(42); const v = q.value },
  () => { const n = Nucl(42); const v = n.value },
  () => { const r = ref(42); const v = r.value },
  () => { const r = ref(42); const v = r.value }
)

compareSimple('Set primitive value', 500000,
  () => { const q = Qu(0); q(42) },
  () => { const n = Nucl(0); n(42) },
  () => { const r = reactive({ value: 0 }); r.value = 42 },
  () => { const r = ref(0); r.value = 42 }
)

// Skip the nested property test for now due to Quark compatibility issues
// compareSimple('Get nested property', 1000000,
//   () => { 
//     const q = Qu({ a: { b: 42 } })
//     const obj = q.value
//     const v = obj.a
//   },
//   () => { 
//     const n = Nucl({ a: { b: 42 } })
//     const obj = n.value
//     const v = obj.a
//   },
//   () => { const r = reactive({ a: { b: 42 } }); const v = r.a },
//   () => { const r = ref({ a: { b: 42 } }); const v = r.value.a }
// )

// ============================================================================
// 3. REACTIVITY BENCHMARKS
// ============================================================================
console.log('\n⚡ REACTIVITY BENCHMARKS')
console.log('-'.repeat(80))

compareSimple('Simple reactivity (one listener)', 100000,
  () => {
    const q = Qu(0)
    let count = 0
    q.up(() => { count++ })
    q(1)
  },
  () => {
    const n = Nucl(0)
    let count = 0
    n.up(() => { count++ })
    n(1)
  },
  () => {
    const r = reactive({ value: 0 })
    let count = 0
    // Note: Vue's reactivity works differently, so simple comparison is approximation
    const oldValue = r.value
    r.value = 1
    if (oldValue !== r.value) count++
  },
  () => {
    const r = ref(0)
    let count = 0
    const oldValue = r.value
    r.value = 1
    if (oldValue !== r.value) count++
  }
)

// ============================================================================
// 4. COMPUTED BENCHMARKS
// ============================================================================
console.log('\n🧮 COMPUTED BENCHMARKS')
console.log('-'.repeat(80))

// These need separate handling due to different APIs
console.log('\n🔬 Simple computed value')

const qA = Qu(1)
const qB = Qu(2)
const quarkComputed = benchmarkQuarkComputed('Quark Computed', 100000, () => {
  const result = Nucl(0)
  result.fusion(qA, qB, (a, b) => a + b)
  // Force computation
  const value = result.value
})

const nA = Nucl(1)
const nB = Nucl(2)
const nuclComputed = benchmarkNuclComputed('Nucl Computed', 100000, () => {
  const result = Nucl(0)
  result.fusion(nA, nB, (a, b) => a + b)
  // Force computation
  const value = result.value
})

const vueA = ref(1)
const vueB = ref(2)
const vueComputedResult = benchmarkVueComputed('Vue Computed', 100000, () => {
  const sum = computed(() => vueA.value + vueB.value)
  // Force computation
  const value = sum.value
})

console.log(`  Quark Computed:   ${quarkComputed.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Nucl Computed:    ${nuclComputed.opsPerMs.toLocaleString()} ops/ms`)
console.log(`  Vue Computed:     ${vueComputedResult.opsPerMs.toLocaleString()} ops/ms`)

// Add to the last result
if (results.length > 0) {
  const lastResult = results[results.length - 1]
  lastResult.computed = {
    quark: quarkComputed,
    nucl: nuclComputed,
    vueComputed: vueComputedResult
  }
}

// ============================================================================
// 5. DEEP TRACKING BENCHMARKS
// ============================================================================
console.log('\n🔍 DEEP TRACKING BENCHMARKS')
console.log('-'.repeat(80))

// Test Nucl with deep tracking
const nuclDeep = bench('Nucl Deep Tracking', 100000, () => {
  const n = Nucl({ a: { b: { c: 42 } } }, { deepTracking: true })
  const val = n.getDeep('a.b.c')
  n.setDeep('a.b.c', 99)
})

console.log(`  Nucl Deep Tracking: ${nuclDeep.opsPerMs.toLocaleString()} ops/ms`)

// Vue reactive is naturally deep
const vueDeep = bench('Vue Deep Reactivity', 100000, () => {
  const r = reactive({ a: { b: { c: 42 } } })
  const val = r.a.b.c
  r.a.b.c = 99
})

console.log(`  Vue Deep Reactivity: ${vueDeep.opsPerMs.toLocaleString()} ops/ms`)

// Add to results
results.push({
  quark: null,
  nucl: nuclDeep,
  vueReactive: vueDeep,
  vueRef: null,
  computed: {
    quark: null,
    nucl: null,
    vueComputed: null
  }
})

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('📊 SUMMARY')
console.log('='.repeat(80))

// Calculate average performance based on available data
let avgQuark = 0, countQuark = 0
let avgNucl = 0, countNucl = 0
let avgVueReactive = 0, countVueReactive = 0
let avgVueRef = 0, countVueRef = 0

for (const result of results) {
  if (result.quark) {
    avgQuark += result.quark.opsPerMs
    countQuark++
  }
  if (result.nucl) {
    avgNucl += result.nucl.opsPerMs
    countNucl++
  }
  if (result.vueReactive) {
    avgVueReactive += result.vueReactive.opsPerMs
    countVueReactive++
  }
  if (result.vueRef) {
    avgVueRef += result.vueRef.opsPerMs
    countVueRef++
  }
}

if (countQuark > 0) avgQuark /= countQuark
if (countNucl > 0) avgNucl /= countNucl
if (countVueReactive > 0) avgVueReactive /= countVueReactive
if (countVueRef > 0) avgVueRef /= countVueRef

console.log(`\nAverage Performance:`)
if (countQuark > 0) console.log(`  Quark:            ${avgQuark.toLocaleString()} ops/ms`)
if (countNucl > 0) console.log(`  Nucl:             ${avgNucl.toLocaleString()} ops/ms`)
if (countVueReactive > 0) console.log(`  Vue Reactive:     ${avgVueReactive.toLocaleString()} ops/ms`)
if (countVueRef > 0) console.log(`  Vue Ref:          ${avgVueRef.toLocaleString()} ops/ms`)

if (avgQuark > 0) {
  if (countNucl > 0) {
    const nuclOverhead = ((avgQuark - avgNucl) / avgQuark * 100).toFixed(2)
    console.log(`  Nucl overhead:    ${nuclOverhead}%`)
  }
  if (countVueReactive > 0) {
    const vueReactiveOverhead = ((avgQuark - avgVueReactive) / avgQuark * 100).toFixed(2)
    console.log(`  Vue Reactive overhead: ${vueReactiveOverhead}%`)
  }
  if (countVueRef > 0) {
    const vueRefOverhead = ((avgQuark - avgVueRef) / avgQuark * 100).toFixed(2)
    console.log(`  Vue Ref overhead: ${vueRefOverhead}%`)
  }
}

console.log(`\n✅ Vue comparison benchmark complete!`)

export const vueComparisonResults = {
  timestamp: Date.now(),
  runtime: `Bun ${Bun.version}`,
  platform: process.platform,
  arch: process.arch,
  results,
  summary: {
    avgQuark,
    avgNucl,
    avgVueReactive,
    avgVueRef,
  }
}