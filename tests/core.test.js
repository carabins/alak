// const { A } = require('../dist/packages/alak/atom')
// const { debug } = require('../dist/packages/alak/atom/debug')
// debug.activate('localhost:10946')
const startValue = 'startValue'
const finalValue = 'finalValue'

const beStart = (v) => expect(v).toBe(startValue)
const beFinal = (v) => expect(v).toBe(finalValue)
const neverBe = (v) => expect(v).toThrow

test('mini', () => {
  let a = A()
  a.up(beStart)
  a(startValue)
  expect.assertions(1)
})

test('up down next', async () => {
  let a = A()
  a.up(beStart)
  a(startValue)
  a.down(beStart)
  a.next(beFinal)
  a(finalValue)
  a.clear()
  a.up(neverBe)
  expect(a.value).toBeUndefined()
  expect.assertions(3)
})

test('once is', () => {
  const a = A()
  expect(a.is(undefined)).toBeTruthy()
  a.once(beStart)
  a(startValue)
  a(finalValue)
  a.once(beFinal)
  expect(a.is(finalValue)).toBeTruthy()
  expect(a.is(startValue)).toBeFalsy()
  a(startValue)
  expect.assertions(5)
})

test('stateless', async () => {
  const a = A.stateless()
  a(startValue)
  a.up(beFinal)
  expect(a()).toBe(undefined)
  a(finalValue)
  expect(a()).toBe(undefined)
  a.stateless(false)
  a(finalValue)
  expect(a()).toBe(finalValue)
  a.stateless()
  expect(a()).toBe(undefined)
})

test('holistic', async () => {
  const a = A.holistic().setId('-')
  a(startValue)
  expect(a.value[0]).toBe(startValue)
  a(startValue, finalValue)
  expect(a.value[1]).toBe(finalValue)
  a.up((v1, v2) => {
    expect(v1).toBe(startValue)
    expect(v2).toBe(finalValue)
  })
  a(startValue, finalValue)
  a.clear()
  a.holistic(false)
  a.up((f, a) => {
    expect(a.id).toBe('-')
  })
})

test('resend', async () => {
  let a = A(startValue)
  a.next(beStart)
  a.resend()
  expect.assertions(1)
})

test('fmap', () => {
  const a = A(3)
  a.fmap((v) => v + 2)
  expect(a()).toBe(5)
})

test('wrap', async () => {
  const a = A.setWrapper((v) => v * v)
  a(2)
  expect(a()).toBe(4)
  const b = A.setWrapper((v) => new Promise((done) => setTimeout(() => done(v * v), 24)))
  await b(4)
  expect(a()).toBe(4)
})

test('clear', () => {
  let a = A(startValue)
  expect(a.isEmpty).toBeFalsy()
  a.next(beFinal)
  a.clearValue()
  expect(a.isEmpty).toBeTruthy()
  a(finalValue)
  a.clear()
  a(startValue)
  a(finalValue)
  a(startValue)
  expect.assertions(3)
})

test('onClear', () => {
  let a = A()
  const clearResolver = jest.fn()
  const decayResolver = jest.fn()
  a.onClear(clearResolver)
  a.clearValue()
  a.clear()
  a.onClear(decayResolver)
  a.decay()
  expect(clearResolver).toHaveBeenCalledTimes(2)
  expect(decayResolver).toHaveBeenCalledTimes(1)
})

test('prev', () => {
  let a = A(startValue)
  a.next((v, a) => {
    a.prev
    expect(a.prev).toBe(startValue)
    expect(v).toBe(finalValue)
  })
  a(finalValue)
})
test('close', () => {
  let a = A(startValue)
  expect(!!a.uid).toBeTruthy()
  a.decay()
  expect(() => a()).toThrowError()
  // expect(a.uid).toBeUndefined()
})
