/**
 * Baseline Deep State Benchmark
 * Measures raw proxy overhead before Ghost implementation
 */

import { createState } from '../src/index'

const ITERATIONS = 1_000_000

// 1. Setup
const state = createState(() => {})
const data = {
  a: 1,
  b: { c: 2 },
  d: { e: { f: 3 } }
}
const proxy = state.deepWatch(data)

// Warmup
for(let i=0; i<1000; i++) {
  const v = proxy.a
  proxy.a = i
}

console.log('=== Deep State Baseline ===\n')

// 2. Measure GET (Depth 1)
{
  const start = performance.now()
  for(let i=0; i<ITERATIONS; i++) {
    const v = proxy.a
  }
  const time = performance.now() - start
  console.log(`GET Depth 1: ${time.toFixed(2)}ms (${(ITERATIONS/time*1000).toFixed(0)} ops/s)`)
}

// 3. Measure GET (Depth 3)
{
  const start = performance.now()
  for(let i=0; i<ITERATIONS; i++) {
    const v = proxy.d.e.f
  }
  const time = performance.now() - start
  console.log(`GET Depth 3: ${time.toFixed(2)}ms (${(ITERATIONS/time*1000).toFixed(0)} ops/s)`)
}

// 4. Measure SET (Depth 1)
{
  const start = performance.now()
  for(let i=0; i<ITERATIONS; i++) {
    proxy.a = i
  }
  const time = performance.now() - start
  console.log(`SET Depth 1: ${time.toFixed(2)}ms (${(ITERATIONS/time*1000).toFixed(0)} ops/s)`)
}

// 5. Measure Access Undefined (Ghost candidate)
// Currently this just returns undefined. We want to ensure this doesn't get significantly slower
// when we add the ghost check (it will be slower if ghost is enabled, but check logic itself should be fast).
{
  const start = performance.now()
  for(let i=0; i<ITERATIONS; i++) {
    // @ts-ignore
    const v = proxy.missing
  }
  const time = performance.now() - start
  console.log(`GET Undefined: ${time.toFixed(2)}ms (${(ITERATIONS/time*1000).toFixed(0)} ops/s)`)
}

