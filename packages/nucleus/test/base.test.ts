import { test } from 'tap'
import N, { Q } from '@alaq/nucleus/index'

const startValue = 'startValue'
const finalValue = 'finalValue'

const beStart = (t) => (v) => t.equal(v, startValue)
const beFinal = (t) => (v) => t.equal(v, finalValue)
// const neverBe = (v) => expect(v).toThrow

test('basic', (t) => {
  t.plan(2)
  let n = N()

  n.up((v) => {
    // console.log({ v })
    t.equal(v, startValue)
  })

  n(startValue)
  t.equal(n.value, startValue)
  t.end()
})

test('bus', (t) => {
  t.plan(4)
  const listener = (data) => {
    t.equal(data, 'z')
  }
  const everyThingListener = (event, data) => {
    t.equal(data, 'z')
    t.equal(event, 'every')
  }
  let q = Q()
  q.addEverythingListener(everyThingListener)
  q.removeListener(everyThingListener)

  q.addEventListener('some', listener)
  q.dispatchEvent('some', 'z')
  q.removeListener(listener)
  q.addEventListener('aum', listener)
  q.removeEventListener('some', listener)
  q.dispatchEvent('aum', 'z')

  q.addEverythingListener(everyThingListener)
  q.dispatchEvent('every', 'z')
  t.end()
})
