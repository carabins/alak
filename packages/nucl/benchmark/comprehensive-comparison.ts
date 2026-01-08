/**
 * Comprehensive Reactivity Benchmark (Ultra-Stable Memory)
 * quark vs nucl vs vue vs signals vs mobx vs valtio vs reatom (v1000)
 */

import { Qv } from '@alaq/quark'
import { Nv, fusion } from '../src/index'
import { deepStatePlugin } from '../src/deep-state/plugin'
import { ref, reactive, computed as vueComputed } from 'vue'
import { signal, computed as signalComputed } from '@preact/signals-core'
import { observable, runInAction, computed as mobxComputed } from 'mobx'
import { proxy } from 'valtio'
import { atom as reatomAtom, computed as reatomComputed, anonymizeNames } from '@reatom/core'

try { anonymizeNames() } catch(e) {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- Benchmark Helpers ---

interface BenchResult {
  name: string
  ops: number
  time: number
  opsPerMs: number
}

function bench(name: string, ops: number, fn: () => void): BenchResult {
  for (let i = 0; i < 5000; i++) fn() 
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

async function runSuite(suiteName: string, ops: number, tests: Record<string, () => void>) {
  console.log(`\n📦 ${suiteName} (ops: ${ops.toLocaleString()})`)
  console.log('-'.repeat(100))
  const suiteResults: BenchResult[] = []
  for (const [name, fn] of Object.entries(tests)) {
    const result = bench(name, ops, fn)
    console.log(`${name.padEnd(25)}: ${result.opsPerMs.toLocaleString().padStart(15)} ops/ms`)
    suiteResults.push(result)
  }
  results[suiteName] = suiteResults
}

// 1. Creation
await runSuite('Creation (Primitive)', 500000, {
  'Quark': () => { Qv(1) },
  'Nucl': () => { Nv(1) },
  'Vue': () => { ref(1) },
  'Signal': () => { signal(1) },
  'MobX': () => { observable.box(1) },
  'Valtio': () => { proxy({ v: 1 }) },
  'Reatom': () => { reatomAtom(1) }
})

await runSuite('Creation (Object)', 500000, {
  'Quark': () => { Qv({a:1}) },
  'Nucl': () => { Nv({a:1}) },
  'Vue': () => { reactive({a:1}) },
  'Signal': () => { signal({a:1}) },
  'MobX': () => { observable({a:1}) },
  'Valtio': () => { proxy({a:1}) }
})

// 2. Read
const qP = Qv(1), nP = Nv(1), rP = ref(1), sP = signal(1)
const mP = observable.box(1), vP = proxy({ v: 1 }), reP = reatomAtom(1)

await runSuite('Read (Primitive)', 5000000, {
  'Quark': () => { qP.value },
  'Nucl': () => { nP.value },
  'Vue': () => { rP.value },
  'Signal': () => { sP.value },
  'MobX': () => { mP.get() },
  'Valtio': () => { vP.v },
  'Reatom': () => { reP() }
})

// 3. Write
const qW = Qv(0), nW = Nv(0), rW = ref(0), sW = signal(0)
const mW = observable.box(0), vW = proxy({ v: 0 }), reW = reatomAtom(0)

await runSuite('Write (Primitive)', 1000000, {
  'Quark': () => { qW(1) },
  'Nucl': () => { nW(1) },
  'Vue': () => { rW.value = 1 },
  'Signal': () => { sW.value = 1 },
  'MobX': () => { runInAction(() => mW.set(1)) },
  'Valtio': () => { vW.v = 1 },
  'Reatom': () => { reW.set(1) }
})

// 4. Computed
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

await runSuite('Computed Read (Cached)', 2000000, {
  'Nucl': () => { nComp.value },
  'Vue': () => { rComp.value },
  'Signal': () => { sComp.value },
  'MobX': () => { mComp.get() },
  'Reatom': () => { reComp() }
})

await runSuite('Computed Update', 500000, {
  'Nucl': () => { nC1(Math.random()); nComp.value },
  'Vue': () => { rC1.value = Math.random(); rComp.value },
  'Signal': () => { sC1.value = Math.random(); sComp.value },
  'MobX': () => { runInAction(() => mC1.set(Math.random())); mComp.get() },
  'Reatom': () => { reC1.set(Math.random()); reComp() }
})

// 5. Deep Mutation
const nD = Nv({ a: { b: { c: 1 } } }, { plugins: [deepStatePlugin] })
const vD = proxy({ a: { b: { c: 1 } } })
const mD = observable({ a: { b: { c: 1 } } })
const rD = reactive({ a: { b: { c: 1 } } })

await runSuite('Deep Mutation', 500000, {
  'Nucl': () => { nD.value.a.b.c++ },
  'Valtio': () => { vD.a.b.c++ },
  'MobX': () => { runInAction(() => mD.a.b.c++) },
  'Vue': () => { rD.a.b.c++ }
})

// 6. Memory Usage (STABLE)
console.log('\n📊 Memory Usage (1,000,000 units)')
console.log('-'.repeat(100))

// Important: Keep all arrays in global scope to prevent GC during the whole memory test block
const globalRetention: any[] = [];

async function getMemoryStable(fn: () => any[]) {
  // Clear previous junk
  Bun.gc(true); await sleep(100); 
  Bun.gc(true); await sleep(100);
  
  const before = process.memoryUsage().heapUsed
  const arr = fn()
  globalRetention.push(arr); // Hold it! 
  
  const after = process.memoryUsage().heapUsed
  return Math.max(0, after - before)
}

const memTests = {
  'Quark': () => { const a = []; for(let i=0; i<1000000; i++) a.push(Qv(i)); return a },
  'Nucl': () => { const a = []; for(let i=0; i<1000000; i++) a.push(Nv(i)); return a },
  'Vue': () => { const a = []; for(let i=0; i<1000000; i++) a.push(ref(i)); return a },
  'Signal': () => { const a = []; for(let i=0; i<1000000; i++) a.push(signal(i)); return a },
  'MobX': () => { const a = []; for(let i=0; i<1000000; i++) a.push(observable.box(i)); return a },
  'Valtio': () => { const a = []; for(let i=0; i<1000000; i++) a.push(proxy({v:i})); return a },
  'Reatom': () => { const a = []; for(let i=0; i<1000000; i++) a.push(reatomAtom(i)); return a }
}

const memResults: Record<string, number> = {}
for (const [name, fn] of Object.entries(memTests)) {
  const diff = await getMemoryStable(fn)
  memResults[name] = Math.round(diff / 1024 / 1024 * 100) / 100
  console.log(`${name.padEnd(25)}: ${memResults[name].toString().padStart(10)} MB`)
}

// --- Generate Report ---

const LIBRARIES = ['Quark', 'Nucl', 'Vue', 'Signal', 'MobX', 'Valtio', 'Reatom']
const winners: Record<string, string> = {}

function generateMarkdownTable(results: Record<string, BenchResult[]>): string {
  let md = `| Benchmark | ` + LIBRARIES.join(' | ') + ` | Winner |\n|-----------|` + LIBRARIES.map(() => '---').join('|') + `|---|
`
  
  for (const [suite, res] of Object.entries(results)) {
    const vals = LIBRARIES.map(lib => {
      const r = res.find(item => item.name === lib)
      return r ? r.opsPerMs : 0
    })
    const max = Math.max(...vals)
    const winnerIdx = vals.indexOf(max)
    const winner = winnerIdx !== -1 && max > 0 ? LIBRARIES[winnerIdx] : '-'
    winners[suite] = winner
    md += `| **${suite}** | ` + vals.map(v => v === 0 ? '-' : v.toLocaleString()).join(' | ') + ` | **${winner}** |\n`
  }
  
  const memVals = LIBRARIES.map(lib => memResults[lib] || 0)
  const minMem = Math.min(...memVals.filter(v => v > 0))
  const memWinnerIdx = memVals.indexOf(minMem)
  const memWinner = memWinnerIdx !== -1 ? LIBRARIES[memWinnerIdx] : '-'
  winners['Memory'] = memWinner
  md += `| **Memory (1M units)** | ` + memVals.map(v => v === 0 ? '-' : v + ' MB').join(' | ') + ` | **${memWinner}** |\n`
  return md
}

import { writeFileSync } from 'fs'
const table = generateMarkdownTable(results);
const commonInfo = `**Date:** ${new Date().toLocaleDateString()}\n**Runtime:** Bun ${Bun.version}\n**System:** ${process.platform} ${process.arch}`;

const reportEn = `# Reactivity Performance Benchmark (Comprehensive)\n\n${commonInfo}\n\n## Results (ops/ms - Higher is Better)\n\n${table}\n\n*Note: Memory is measured in MB for 1,000,000 instances (Lower is Better).*`
const reportRu = `# Бенчмарк производительности реактивности\n\n**Дата:** ${new Date().toLocaleDateString('ru-RU')}\n**Среда:** Bun ${Bun.version}\n**Система:** ${process.platform} ${process.arch}\n\n## Результаты (операций/мс - чем выше, тем лучше)\n\n${table.replace(/Benchmark/g, 'Тест').replace(/Winner/g, 'Победитель').replace(/Creation \(Primitive\)/g, 'Создание (примитив)').replace(/Creation \(Object\)/g, 'Создание (объект)').replace(/Read \(Primitive\)/g, 'Чтение (примитив)').replace(/Write \(Primitive\)/g, 'Запись (примитив)').replace(/Computed Read \(Cached\)/g, 'Чтение Computed (кеш)').replace(/Computed Update/g, 'Обновление Computed').replace(/Deep Mutation/g, 'Глубокая мутация').replace(/Memory \(1M units\)/g, 'Память (1 млн юнитов)')}\n\n*Примечание: Память измеряется в МБ для 1 000 000 экземпляров (чем меньше, тем лучше).*`

writeFileSync('BENCHMARK_REPORT.md', reportEn)
writeFileSync('BENCHMARK_REPORT.ru.md', reportRu)
console.log('\nReports saved to BENCHMARK_REPORT.md and BENCHMARK_REPORT.ru.md')
process.exit(0)