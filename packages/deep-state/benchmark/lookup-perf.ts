const ITERATIONS = 10_000_000
const keys = ['valueOf', 'toString', 'toJSON', 'then', 'randomProp', 'otherProp']

const skipFn = () => undefined
const skipMap: Record<string | symbol, any> = {
  valueOf: skipFn,
  toString: skipFn,
  toJSON: skipFn,
  then: undefined,
  [Symbol.toPrimitive]: skipFn
}

console.log('=== Lookup Optimization Benchmark ===\n')

// 1. Multiple IFs (Current)
{
  const start = performance.now()
  let hits = 0
  for(let i=0; i<ITERATIONS; i++) {
    const key = keys[i % keys.length]
    if (key === Symbol.toPrimitive || key === 'valueOf' || key === 'toString' || key === 'toJSON') {
      hits++
    } else if (key === 'then') {
      hits++
    }
  }
  const time = performance.now() - start
  console.log(`IF Chains: ${time.toFixed(2)}ms`)
}

// 2. Object Lookup
{
  const start = performance.now()
  let hits = 0
  for(let i=0; i<ITERATIONS; i++) {
    const key = keys[i % keys.length]
    const val = skipMap[key]
    if (val !== undefined || key === 'then') { // 'then' is undefined in map, tricky
        // Logic differs slightly because map['then'] is undefined, same as map['missing']
        // We need a marker for 'undefined value' vs 'missing key' if we use map
    }
  }
  // Let's assume we store explicit null for 'then' to distinguish
  skipMap.then = null 
  
  const start2 = performance.now()
  for(let i=0; i<ITERATIONS; i++) {
    const key = keys[i % keys.length]
    const val = skipMap[key]
    if (val !== undefined) hits++
  }
  const time = performance.now() - start2
  console.log(`Object Lookup: ${time.toFixed(2)}ms`)
}

// 3. Switch Case (V8 often optimizes this well)
{
  const start = performance.now()
  let hits = 0
  for(let i=0; i<ITERATIONS; i++) {
    const key = keys[i % keys.length]
    switch (key) {
      case 'valueOf':
      case 'toString':
      case 'toJSON':
      case Symbol.toPrimitive:
        hits++
        break
      case 'then':
        hits++
        break
    }
  }
  const time = performance.now() - start
  console.log(`Switch Case: ${time.toFixed(2)}ms`)
}
