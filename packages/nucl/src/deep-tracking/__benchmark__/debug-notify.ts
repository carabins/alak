import { createState } from '../tracker'

const obj = { data: { x: 1 } }
const state = createState((payload) => {
  console.log('notify payload:', payload)
  console.log('payload.info:', payload.info)
  console.log('payload.type:', payload.type)
  console.log('payload.target:', payload.target)
})
const proxy = state.deepWatch(obj)

console.log('Accessing proxy.data...')
proxy.data

console.log('\nReplacing proxy.data...')
proxy.data = { x: 2 }
