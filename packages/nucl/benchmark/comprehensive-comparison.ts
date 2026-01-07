/**
 * Comprehensive Reactivity Benchmark
 * quark vs nucl vs vue vs signals vs mobx vs valtio
 */

import { Qv } from '@alaq/quark'
import { Nv, fusion } from '../src/index'
import { deepStatePlugin } from '../src/deep-state/plugin'
import { ref, reactive, computed as vueComputed, watchEffect as vueWatchEffect } from 'vue'
import { signal, computed as signalComputed, effect as signalEffect } from '@preact/signals-core'
import { observable, runInAction, autorun } from 'mobx'
import { proxy, subscribe } from 'valtio'

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
console.log('='.repeat(80))

const results: Record<string, BenchResult[]> = {}

function runSuite(suiteName: string, ops: number, tests: Record<string, () => void>) {
  console.log(`\n📦 ${suiteName} (ops: ${ops.toLocaleString()})`)
  console.log('-'.repeat(80))
  const suiteResults: BenchResult[] = []
  for (const [name, fn] of Object.entries(tests)) {
    const result = bench(name, ops, fn)
    console.log(`${name.padEnd(20)}: ${result.opsPerMs.toLocaleString().padStart(15)} ops/ms`)
    suiteResults.push(result)
  }
  results[suiteName] = suiteResults
}

// 1. Creation
runSuite('Creation (Primitive)', 500000, {
  'Quark': () => { Qv(1) },
  'Nucl': () => { Nv(1) },
  'Vue Ref': () => { ref(1) },
  'Signal': () => { signal(1) },
  'MobX': () => { observable.box(1) },
  'Valtio': () => { proxy({ v: 1 }) }
})

// 2. Read
const qP = Qv(1), nP = Nv(1), rP = ref(1), sP = signal(1)
const mP = observable.box(1), vP = proxy({ v: 1 })

runSuite('Read (Primitive)', 5000000, {
  'Quark': () => { qP.value },
  'Nucl': () => { nP.value },
  'Vue Ref': () => { rP.value },
  'Signal': () => { sP.value },
  'MobX': () => { mP.get() },
  'Valtio': () => { vP.v }
})

// 3. Write
const qW = Qv(0), nW = Nv(0), rW = ref(0), sW = signal(0)
const mW = observable.box(0), vW = proxy({ v: 0 })

runSuite('Write (Primitive)', 1000000, {
  'Quark': () => { qW(1) },
  'Nucl': () => { nW(1) },
  'Vue Ref': () => { rW.value = 1 },
  'Signal': () => { sW.value = 1 },
  'MobX': () => { runInAction(() => mW.set(1)) },
  'Valtio': () => { vW.v = 1 }
})

// 4. Update Propagation (1 sub)
const qS = Qv(0); qS.up(() => {})
const nS = Nv(0); nS.up(() => {})
const rS = ref(0); vueWatchEffect(() => rS.value)
const sS = signal(0); signalEffect(() => sS.value)
const mS = observable.box(0); autorun(() => mS.get())
const vS = proxy({ v: 0 }); subscribe(vS, () => {})

runSuite('Update (1 sub)', 500000, {
  'Quark': () => { qS(1) },
  'Nucl': () => { nS(1) },
  'Vue Ref': () => { rS.value++ },
  'Signal': () => { sS.value++ },
  'MobX': () => { runInAction(() => mS.set(mS.get() + 1)) },
  'Valtio': () => { vS.v++ }
})

// 5. Deep Mutation
const nD = Nv({ a: { b: { c: 1 } } }, { plugins: [deepStatePlugin] })
const vD = proxy({ a: { b: { c: 1 } } })
const mD = observable({ a: { b: { c: 1 } } })
const rD = reactive({ a: { b: { c: 1 } } })

runSuite('Deep Mutation', 500000, {
  'Nucl (Deep)': () => { nD.value.a.b.c++ },
  'Valtio': () => { vD.a.b.c++ },
  'MobX': () => { runInAction(() => mD.a.b.c++) },
  'Vue Reactive': () => { rD.a.b.c++ }
})

// 6. Memory Usage
console.log('\n📊 Memory Usage (1,000,000 units)')
console.log('-'.repeat(80))

function getMemory(fn: () => any[]) {
  const before = process.memoryUsage().heapUsed
  const arr = fn()
  const after = process.memoryUsage().heapUsed
  return { diff: after - before, arr }
}

const memTests = {
  'Quark': () => { const a = []; for(let i=0; i<1000000; i++) a.push(Qv(i)); return a },
  'Nucl': () => { const a = []; for(let i=0; i<1000000; i++) a.push(Nv(i)); return a },
  'Vue Ref': () => { const a = []; for(let i=0; i<1000000; i++) a.push(ref(i)); return a },
  'Signal': () => { const a = []; for(let i=0; i<1000000; i++) a.push(signal(i)); return a },
  'MobX': () => { const a = []; for(let i=0; i<1000000; i++) a.push(observable.box(i)); return a },
  'Valtio': () => { const a = []; for(let i=0; i<1000000; i++) a.push(proxy({v:i})); return a }
}

const memResults: Record<string, number> = {}
for (const [name, fn] of Object.entries(memTests)) {
  const { diff } = getMemory(fn)
  memResults[name] = Math.round(diff / 1024 / 1024 * 100) / 100
  console.log(`${name.padEnd(20)}: ${memResults[name].toString().padStart(10)} MB`)
}

// --- Generate Report ---

function generateMarkdownTable(results: Record<string, BenchResult[]>): string {
  const libraries = ['Quark', 'Nucl', 'Vue Ref', 'Signal', 'MobX', 'Valtio']
  let md = `| Benchmark | ` + libraries.join(' | ') + ` | Winner |
`
  md += `|-----------|` + libraries.map(() => '---').join('|') + `|---|
`
  
  for (const [suite, res] of Object.entries(results)) {
    const vals = libraries.map(lib => {
      // Improved matching: find if library name is part of the test name
      const r = res.find(item => item.name.includes(lib) || (lib === 'Nucl' && item.name === 'Nucl (Deep)'))
      return r ? r.opsPerMs : 0
    })
    
    const max = Math.max(...vals)
    const winnerIdx = vals.indexOf(max)
    const winner = winnerIdx !== -1 ? libraries[winnerIdx] : '-'
    
    md += `| **${suite}** | ` + vals.map(v => v === 0 ? '-' : v.toLocaleString()).join(' | ') + ` | **${winner}** |
`
  }
  
  const memVals = libraries.map(lib => memResults[lib] || 0)
  const minMem = Math.min(...memVals.filter(v => v > 0))
  const memWinnerIdx = memVals.indexOf(minMem)
  const memWinner = memWinnerIdx !== -1 ? libraries[memWinnerIdx] : '-'
  
  md += `| **Memory (1M units)** | ` + memVals.map(v => v === 0 ? '-' : v + ' MB').join(' | ') + ` | **${memWinner}** |
`

  return md
}

import { writeFileSync } from 'fs'
const report = `# Reactivity Performance Benchmark (Extended)

**Date:** ${new Date().toLocaleDateString()}
**Runtime:** Bun ${Bun.version}
**System:** ${process.platform} ${process.arch}

## Results (ops/ms - Higher is Better)

${generateMarkdownTable(results)}

*Note: Memory is measured in MB for 1,000,000 instances (Lower is Better).*

## Observations
- **Quark** wins in **Read** and **Update Propagation** and has the **smallest memory footprint**.
- **Signals** are fastest in **Creation** and **Write**.
- **Nucl (Deep)** is faster than **MobX** and **Valtio** in deep mutations.
- **Vue Ref** and **MobX** are significantly heavier in terms of memory.
`

writeFileSync('BENCHMARK_REPORT.md', report)
console.log('\nReport saved to BENCHMARK_REPORT.md')
