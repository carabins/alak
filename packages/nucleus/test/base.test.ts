import { test, expect } from 'bun:test'
import N, { Q } from '@alaq/nucleus/index'

const startValue = 'startValue'
const finalValue = 'finalValue'

const beStart = (v) => expect(v).toBe(startValue)
const beFinal = (v) => expect(v).toBe(finalValue)

test('basic', () => {
  let n = N()
  expect(n.haveListeners).toBe(false)
  n.up((v) => {
    expect(v).toBe(startValue)
  })
  n(startValue)
  expect(n.value).toBe(startValue)
  expect(n.haveListeners).toBe(true)
})

test('bus', () => {
  const listener = (data) => {
    expect(data).toBe('z')
  }
  const everyThingListener = (event, data) => {
    expect(data).toBe('z')
    expect(event).toBe('every')
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
})

test('bus connections', () => {
  const a = Q()
  const b = Q()

  b.addBus(a)
  a.addEverythingListener((e, d) => {
    // console.log({e, d})
  })

  b.dispatchEvent('E1', 1)
})
