/**
 * Comprehensive Reactivity Benchmark
 * quark vs nucl vs vue vs signals vs mobx vs valtio vs reatom (v1000)
 */

import { Qv } from '../packages/quark/src/index'
import { Nv, fusion } from '../packages/nucl/src/index'
import { deepStatePlugin } from '../packages/nucl/src/deep-state/plugin'
import { Atom } from '../packages/atom/src/index'
import { ref, reactive, computed as vueComputed } from 'vue'
import { signal, computed as signalComputed } from '@preact/signals-core'
import { observable, runInAction, computed as mobxComputed } from 'mobx'
import { proxy } from 'valtio'
import { atom as reatomAtom, computed as reatomComputed, anonymizeNames } from '@reatom/core'

try { anonymizeNames() } catch(e) {}

// --- Benchmark Helpers ---

interface BenchResult {
  name: string
  ops: number
  time: number
  opsPerMs: number
}

function bench(name: string, ops: number, fn: () => void): BenchResult {
  for (let i = 0; i < 1000; i++) fn() // Warm-up
  const start = performance.now()
  for (let i = 0; i < ops; i++) fn()
  const time = performance.now() - start
  const safeTime = time === 0 ? 0.001 : time
  return {
    name,
    ops,
    time: Math.round(time * 100) / 100,
    opsPerMs: Math.round((ops / safeTime) * 100) / 100
  }
}

// --- Benchmark Suites ---

console.log('🚀 COMPREHENSIVE REACTIVITY BENCHMARK')
console.log(`Date: ${new Date().toISOString()}`)
console.log(`Runtime: Bun ${Bun.version}`)
console.log('='.repeat(100))

const results: Record<string, BenchResult[]> = {}
const RUNS = 5

async function runSuite(suiteName: string, ops: number, tests: Record<string, () => void>) {
  console.log(`\n📦 ${suiteName} (ops: ${ops.toLocaleString()}, runs: ${RUNS})
`)
  console.log('-'.repeat(100))
  
  const suiteResults: BenchResult[] = []
  
  for (const [name, fn] of Object.entries(tests)) {
    let bestResult: BenchResult | null = null
    
    // Multiple runs, pick best
    for (let i = 0; i < RUNS; i++) {
        const result = bench(name, ops, fn)
        if (!bestResult || result.opsPerMs > bestResult.opsPerMs) {
            bestResult = result
        }
        // Small pause to let GC breath
        await new Promise(r => setTimeout(r, 10))
    }
    
    if (bestResult) {
        console.log(`${name.padEnd(25)}: ${bestResult.opsPerMs.toLocaleString().padStart(15)} ops/ms`)
        suiteResults.push(bestResult)
    }
  }
  results[suiteName] = suiteResults
}

// Pre-compiled factories
const AtomPrimitiveFactory = Atom.define(class P { v = 1 })
const AtomObjectFactory = Atom.define(class O { a = 1 })

// 1. Creation (Primitive)
await runSuite('Creation (Primitive)', 500000, {
  'Quark': () => { Qv(1) },
  'Nucl': () => { Nv(1) },
  'Atom (Compiled)': () => { AtomPrimitiveFactory() },
  'Vue': () => { ref(1) },
  'Signal': () => { signal(1) },
  'MobX': () => { observable.box(1) },
  'Valtio': () => { proxy({ v: 1 }) },
  'Reatom': () => { reatomAtom(1) }
})

// 2. Creation (Object)
await runSuite('Creation (Object)', 500000, {
  'Quark': () => { Qv({a:1}) },
  'Nucl': () => { Nv({a:1}) },
  'Atom (Compiled)': () => { AtomObjectFactory() },
  'Vue': () => { reactive({a:1}) },
  'MobX': () => { observable({a:1}) },
  'Valtio': () => { proxy({a:1}) }
})

// 3. Read
const qP = Qv(1), nP = Nv(1), rP = ref(1), sP = signal(1)
const mP = observable.box(1), vP = proxy({ v: 1 }), reP = reatomAtom(1)
const aP = AtomPrimitiveFactory()

await runSuite('Read (Primitive)', 5000000, {
  'Quark': () => { qP.value },
  'Nucl': () => { nP.value },
  'Atom': () => { aP.v },
  'Vue': () => { rP.value },
  'Signal': () => { sP.value },
  'MobX': () => { mP.get() },
  'Valtio': () => { vP.v },
  'Reatom': () => { reP() }
})

// 4. Write
const qW = Qv(0), nW = Nv(0), rW = ref(0), sW = signal(0)
const mW = observable.box(0), vW = proxy({ v: 0 }), reW = reatomAtom(0)
const aW = Atom(class { v = 0 })

await runSuite('Write (Primitive)', 1000000, {
  'Quark': () => { qW(1) },
  'Nucl': () => { nW(1) },
  'Atom': () => { aW.v = 1 },
  'Vue': () => { rW.value = 1 },
  'Signal': () => { sW.value = 1 },
  'MobX': () => { runInAction(() => mW.set(1)) },
  'Valtio': () => { vW.v = 1 },
  'Reatom': () => { reW.set(1) }
})

// 5. Computed
const nC1 = Nv(1), nC2 = Nv(2)
const nComp = fusion(nC1, nC2).any((a, b) => a + b)
const rC1 = ref(1), rC2 = ref(2)
const rComp = vueComputed(() => rC1.value + rC2.value)
const sC1 = signal(1), sC2 = signal(2)
const sComp = signalComputed(() => sC1.value + sC2.value)
const mC1 = observable.box(1), mC2 = observable.box(2)
const mComp = mobxComputed(() => mC1.get() + mC2.get())
const reC1 = reatomAtom(1), reC2 = reatomAtom(2)
const reComp = reatomComputed(() => reC1() + reC2())
const aComp = Atom(class { a = 1; b = 2; get sum() { return this.a + this.b } })

await runSuite('Computed Read (Cached)', 2000000, {
  'Nucl': () => { nComp.value },
  'Atom': () => { aComp.sum },
  'Vue': () => { rComp.value },
  'Signal': () => { sComp.value },
  'MobX': () => { mComp.get() },
  'Reatom': () => { reComp() }
})

await runSuite('Computed Update', 500000, {
  'Nucl': () => { nC1(Math.random()); nComp.value },
  'Atom': () => { aComp.a = Math.random(); aComp.sum },
  'Vue': () => { rC1.value = Math.random(); rComp.value },
  'Signal': () => { sC1.value = Math.random(); sComp.value },
  'MobX': () => { runInAction(() => mC1.set(Math.random())); mComp.get() },
  'Reatom': () => { reC1.set(Math.random()); reComp() }
})

// 6. Deep Mutation
const nD = Nv({ a: { b: { c: 1 } } }, { plugins: [deepStatePlugin] })
const vD = proxy({ a: { b: { c: 1 } } })
const mD = observable({ a: { b: { c: 1 } } })
const rD = reactive({ a: { b: { c: 1 } } })

await runSuite('Deep Mutation', 500000, {
  'Nucl (Deep)': () => { nD.value.a.b.c++ },
  'Valtio': () => { vD.a.b.c++ },
  'MobX': () => { runInAction(() => mD.a.b.c++) },
  'Vue': () => { rD.a.b.c++ }
})

// --- Generate Report ---

const LIBRARIES = ['Quark', 'Nucl', 'Atom', 'Vue', 'Signal', 'MobX', 'Valtio', 'Reatom']
const winners: Record<string, string> = {}

function generateMarkdownTable(results: Record<string, BenchResult[]>): string {
  let md = `| Benchmark | ` + LIBRARIES.join(' | ') + ` | Winner |
|-----------|` + LIBRARIES.map(() => '---').join('|') + `|---|
`
  
  for (const [suite, res] of Object.entries(results)) {
    const vals = LIBRARIES.map(lib => {
      const r = res.find(item => item.name.includes(lib))
      return r ? r.opsPerMs : 0
    })
    const max = Math.max(...vals)
    const winnerIdx = vals.indexOf(max)
    const winner = winnerIdx !== -1 && max > 0 ? LIBRARIES[winnerIdx] : '-'
    winners[suite] = winner
    md += `| **${suite}** | ` + vals.map(v => v === 0 ? '-' : v.toLocaleString()).join(' | ') + ` | **${winner}** |
`
  }
  return md
}

import { writeFileSync } from 'fs'
const table = generateMarkdownTable(results);
const commonInfo = `**Date:** ${new Date().toLocaleDateString()}
**Runtime:** Bun ${Bun.version}
**System:** ${process.platform} ${process.arch}`;

const reportEn = `# Reactivity Performance Benchmark (Comprehensive)\n\n${commonInfo}\n\n## Results (ops/ms - Higher is Better)\n\n${table}`

writeFileSync('BENCHMARK_REPORT.md', reportEn)
console.log('\nReport saved to BENCHMARK_REPORT.md')
process.exit(0)
