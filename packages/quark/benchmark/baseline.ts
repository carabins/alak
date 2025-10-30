/**
 * Baseline Benchmark - измерение производительности перед оптимизациями
 *
 * Этот бенчмарк создает baseline для сравнения с будущими оптимизациями из PERFORMANCE.md
 */

import { Qu, Qv } from '../src/index'

interface BenchResult {
  name: string
  ops: number
  time: number
  opsPerMs: number
}

const results: BenchResult[] = []

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

  const result: BenchResult = {
    name,
    ops,
    time: Math.round(time * 100) / 100,
    opsPerMs: Math.round((ops / time) * 100) / 100
  }

  results.push(result)
  return result
}

console.log('🔥 QUARK BASELINE BENCHMARK\n')
console.log('Starting performance measurements...\n')

// ============================================================================
// 1. CREATION BENCHMARKS
// ============================================================================
console.log('📦 CREATION:')

bench('Create empty quark', 100000, () => {
  const q = Qu()
})

bench('Create with value', 100000, () => {
  const q = Qv(42)
})

bench('Create with options', 100000, () => {
  const q = Qu({ value: 42, id: 'test' })
})

bench('Create with realm', 100000, () => {
  const q = Qu({ value: 42, realm: 'test' })
})

bench('Create with all options', 100000, () => {
  const q = Qu({
    value: 42,
    realm: 'test',
    id: 'test-id',
    dedup: true,
    stateless: true,
    pipe: (v) => v
  })
})

// ============================================================================
// 2. GET/SET BENCHMARKS
// ============================================================================
console.log('\n📝 GET/SET:')

const getSetQ = Qv(0)
bench('Get value', 1000000, () => {
  const v = getSetQ.value
})

bench('Set value (no listeners)', 1000000, () => {
  getSetQ(42)
})

const withListener = Qv(0)
withListener.up(() => {})
bench('Set value (1 listener)', 100000, () => {
  withListener(42)
})

const with5Listeners = Qv(0)
for (let i = 0; i < 5; i++) {
  with5Listeners.up(() => {})
}
bench('Set value (5 listeners)', 100000, () => {
  with5Listeners(42)
})

const with10Listeners = Qv(0)
for (let i = 0; i < 10; i++) {
  with10Listeners.up(() => {})
}
bench('Set value (10 listeners)', 100000, () => {
  with10Listeners(42)
})

// ============================================================================
// 3. LISTENERS BENCHMARKS
// ============================================================================
console.log('\n👂 LISTENERS:')

bench('Add listener', 100000, () => {
  const q = Qv(0)
  q.up(() => {})
})

bench('Remove listener', 100000, () => {
  const q = Qv(0)
  const fn = () => {}
  q.up(fn)
  q.down(fn)
})

const notifyQ = Qv(0)
let counter = 0
notifyQ.up(() => { counter++ })
bench('Notify 1 listener', 100000, () => {
  notifyQ(Math.random())
})

const notify5Q = Qv(0)
for (let i = 0; i < 5; i++) {
  notify5Q.up(() => { counter++ })
}
bench('Notify 5 listeners', 100000, () => {
  notify5Q(Math.random())
})

const notify10Q = Qv(0)
for (let i = 0; i < 10; i++) {
  notify10Q.up(() => { counter++ })
}
bench('Notify 10 listeners', 100000, () => {
  notify10Q(Math.random())
})

// ============================================================================
// 4. EVENTS BENCHMARKS
// ============================================================================
console.log('\n🎯 EVENTS:')

bench('Add event listener', 50000, () => {
  const q = Qu()
  q.on('test', () => {})
})

bench('Remove event listener', 50000, () => {
  const q = Qu()
  const fn = () => {}
  q.on('test', fn)
  q.off('test', fn)
})

const emitQ = Qu()
emitQ.on('test', () => {})
bench('Emit local event', 50000, () => {
  emitQ.emit('test', { data: 'test' })
})

const emitRealmQ = Qu({ realm: 'test' })
const listenerQ = Qu({ realm: 'logs' })
listenerQ.on('test:custom', () => {})
bench('Emit realm event', 50000, () => {
  emitRealmQ.emit('custom', { data: 'test' })
})

const wildcardQ = Qu({ realm: 'test' })
wildcardQ.on('*', () => {})
bench('Emit with wildcard listener', 50000, () => {
  wildcardQ.emit('event', { data: 'test' })
})

// ============================================================================
// 5. SPECIAL MODES BENCHMARKS
// ============================================================================
console.log('\n⚙️  SPECIAL MODES:')

const dedupQ = Qu({ value: 0, dedup: true })
let dedupCount = 0
dedupQ.up(() => { dedupCount++ })
bench('Set with dedup (same value)', 100000, () => {
  dedupQ(0)
})

bench('Set with dedup (different value)', 100000, () => {
  dedupQ(Math.random())
})

const statelessQ = Qu({ stateless: true })
let statelessCount = 0
statelessQ.up(() => { statelessCount++ })
bench('Set with stateless', 100000, () => {
  statelessQ(42)
})

const pipeQ = Qu({ value: 0, pipe: (v) => v * 2 })
bench('Set with pipe transform', 100000, () => {
  pipeQ(21)
})

const pipeRejectQ = Qu({ value: 0, pipe: (v) => v > 0 ? v : undefined })
bench('Set with pipe reject', 100000, () => {
  pipeRejectQ(-1)
})

// ============================================================================
// 6. COMBINED OPERATIONS
// ============================================================================
console.log('\n🔀 COMBINED:')

bench('Full workflow (create + subscribe + set)', 50000, () => {
  const q = Qv(0)
  q.up(() => {})
  q(1)
  q(2)
  q(3)
})

bench('Realm communication', 10000, () => {
  const counter = Qu({ realm: 'counters', id: 'c1' })
  const logger = Qu({ realm: 'logs' })
  logger.on('counters:increment', () => {})
  counter.emit('increment', { delta: 1 })
})

bench('Complex quark lifecycle', 10000, () => {
  const q = Qu({
    value: 0,
    realm: 'test',
    dedup: true,
    pipe: (v) => v > 0 ? v : undefined
  })
  q.up(() => {})
  q.on('change', () => {})
  q(1)
  q(1) // dedup
  q(2)
  q(-1) // pipe reject
  q.decay()
})

// ============================================================================
// RESULTS
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('📊 BENCHMARK RESULTS')
console.log('='.repeat(80))
console.log()

const categories = {
  '📦 CREATION': results.filter(r => r.name.includes('Create')),
  '📝 GET/SET': results.filter(r => r.name.includes('Get') || (r.name.includes('Set') && !r.name.includes('pipe') && !r.name.includes('dedup') && !r.name.includes('stateless'))),
  '👂 LISTENERS': results.filter(r => r.name.includes('listener') || r.name.includes('Notify')),
  '🎯 EVENTS': results.filter(r => r.name.includes('event') || r.name.includes('Emit')),
  '⚙️  SPECIAL MODES': results.filter(r => r.name.includes('dedup') || r.name.includes('stateless') || r.name.includes('pipe')),
  '🔀 COMBINED': results.filter(r => r.name.includes('workflow') || r.name.includes('communication') || r.name.includes('lifecycle'))
}

let totalOps = 0
let totalTime = 0

for (const [category, categoryResults] of Object.entries(categories)) {
  if (categoryResults.length === 0) continue

  console.log(category)
  console.log('-'.repeat(80))

  for (const result of categoryResults) {
    const opsStr = result.ops.toLocaleString().padStart(10)
    const timeStr = result.time.toFixed(2).padStart(8) + 'ms'
    const opsPerMsStr = result.opsPerMs.toLocaleString().padStart(12) + ' ops/ms'

    console.log(`  ${result.name.padEnd(40)} ${opsStr} ops in ${timeStr} → ${opsPerMsStr}`)

    totalOps += result.ops
    totalTime += result.time
  }
  console.log()
}

console.log('='.repeat(80))
console.log(`TOTAL: ${totalOps.toLocaleString()} operations in ${totalTime.toFixed(2)}ms`)
console.log(`AVERAGE: ${(totalOps / totalTime).toFixed(2)} ops/ms`)
console.log('='.repeat(80))

// ============================================================================
// EXPORT RESULTS
// ============================================================================
export const baselineResults = {
  timestamp: new Date().toISOString(),
  runtime: 'Bun ' + Bun.version,
  platform: process.platform,
  arch: process.arch,
  results: results,
  summary: {
    totalOps,
    totalTime: Math.round(totalTime * 100) / 100,
    avgOpsPerMs: Math.round((totalOps / totalTime) * 100) / 100
  }
}

console.log('\n✅ Baseline benchmark complete!')
console.log('📝 Results exported for comparison\n')
