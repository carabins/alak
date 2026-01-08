const ITERATIONS = 10_000_000
const dummyFn = (arg: any) => { return arg.val + 1 }
const arg = { val: 0 }

function unsafeCall(fn: any, arg: any) {
  fn(arg)
}

function safeCall(fn: any, arg: any) {
  try {
    fn(arg)
  } catch (e) {
    console.error(e)
  }
}

console.log(`Running ${ITERATIONS} iterations...`)

// 1. Unsafe
const start1 = performance.now()
for(let i=0; i<ITERATIONS; i++) {
  unsafeCall(dummyFn, arg)
}
const end1 = performance.now()
console.log(`Unsafe: ${(end1 - start1).toFixed(2)}ms`)

// 2. Safe
const start2 = performance.now()
for(let i=0; i<ITERATIONS; i++) {
  safeCall(dummyFn, arg)
}
const end2 = performance.now()
console.log(`Safe:   ${(end2 - start2).toFixed(2)}ms`)

// 3. Ratio
console.log(`Overhead: x${((end2 - start2) / (end1 - start1)).toFixed(2)}`)
