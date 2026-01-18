import { createState } from '../src/index'

const ITERATIONS = 1_000_000

function bench(name: string, fn: () => void) {
  const start = performance.now()
  for(let i=0; i<ITERATIONS; i++) fn()
  const time = performance.now() - start
  console.log(`${name}: ${time.toFixed(2)}ms (${(ITERATIONS/time*1000).toFixed(0)} ops/s)`)
}

console.log('=== Ghost Performance Benchmark ===\n')

// 1. Ghosts Disabled (Baseline)
const stateOff = createState(() => {}, { ghosts: false })
const proxyOff = stateOff.deepWatch({ a: 1 })

bench('Disabled - Get Existing', () => { const v = proxyOff.a })
bench('Disabled - Get Missing', () => { 
  // @ts-ignore
  const v = proxyOff.missing 
})

console.log('---\n')

// 2. Ghosts Enabled
const stateOn = createState(() => {}, { ghosts: true, onGhost: () => {} })
const proxyOn = stateOn.deepWatch({ a: 1 })

bench('Enabled - Get Existing', () => { const v = proxyOn.a })
bench('Enabled - Get Missing (Create Ghost)', () => { 
  // @ts-ignore
  const v = proxyOn.missing 
})

// 3. Ghost Traversal (Deep)
// @ts-ignore
const ghost = proxyOn.missing
bench('Ghost - Nested Access', () => { 
  // @ts-ignore
  const v = ghost.deep.prop 
})

