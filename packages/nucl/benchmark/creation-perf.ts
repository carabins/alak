import { Nu } from '../src/index'
import { createKind } from '../src/plugins'
import { stdPlugin } from '../src/std/plugin'

const stdKind = createKind([stdPlugin])

function measure(name: string, fn: () => void, iterations = 1_000_000) {
  // Warmup
  for (let i = 0; i < 1000; i++) fn()
  if (global.gc) global.gc()

  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const end = performance.now()
  const total = end - start
  const perOp = (total / iterations) * 1000 // microseconds
  
  console.log(`${name}: ${perOp.toFixed(4)} µs/op (${Math.round(iterations / (total / 1000)).toLocaleString()} ops/sec)`)
}

console.log('--- Nucl Creation Benchmark ---')

measure('Nu(1) [Default]', () => {
  Nu(1)
})

measure('Nu(1, { kind: stdKind }) [Cached Object]', () => {
  Nu(1, { kind: stdKind })
})

measure('Nu(1, { plugins: [stdPlugin] }) [Fresh Extend]', () => {
  Nu(1, { plugins: [stdPlugin] })
})
