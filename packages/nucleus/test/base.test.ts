import { test } from 'tap'
import N from '@alaq/nucleus/index'

const startValue = 'startValue'
const finalValue = 'finalValue'

const beStart = (t) => (v) => t.equal(v, startValue)
const beFinal = (t) => (v) => t.equal(v, finalValue)
// const neverBe = (v) => expect(v).toThrow

test('basic', (t) => {
  t.plan(1)
  let n = N()

  // console.log(n.ref)
  n.up((v) => {
    // console.log({ v })
    t.equal(v, startValue)
  })

  n(startValue)
  t.end()
})
