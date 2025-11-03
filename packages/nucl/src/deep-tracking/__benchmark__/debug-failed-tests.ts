/**
 * Debug failed tests
 */

import { createState } from '../tracker'

console.log('=== Test 9: Array replacement ===\n')
{
  const obj = { items: [1, 2, 3] }
  const state = createState(() => {})
  const proxy = state.deepWatch(obj)

  const ref = proxy.items
  console.log('Before:', ref, ref[0], ref.length)

  proxy.items = [4, 5, 6]
  console.log('After:', ref, ref[0], ref.length)
  console.log('Expected: ref[0] === 4, got:', ref[0])
  console.log('Expected: ref.length === 3, got:', ref.length)
}

console.log('\n=== Test 10: Notify parameters ===\n')
{
  const obj = { data: { x: 1 } }
  const state = createState((info, type, target, oldValue) => {
    console.log('Notify called:')
    console.log('  info:', info)
    console.log('  type:', type)
    console.log('  target:', target)
    console.log('  oldValue:', oldValue)
  })
  const proxy = state.deepWatch(obj)

  console.log('Accessing proxy.data...')
  const ref = proxy.data

  console.log('\nReplacing proxy.data...')
  proxy.data = { x: 2 }
}
