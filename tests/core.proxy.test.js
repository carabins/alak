const { A } = require('../facade')
const startValue = 'startValue'
const finalValue = 'finalValue'

const beStart = v => expect(v).toBe(startValue)
const beFinal = v => expect(v).toBe(finalValue)
const neverBe = v => expect(v).toThrow

function asyncFn() {
  return new Promise(done => {
    setTimeout(() => done(finalValue), 24)
  })
}

test('proxyProps ', () => {
  let a = A.proxy()
  expect(a.id).toBeDefined()
  expect(a.uid).toBe(a.id)
  a.setId('skill')
  a.setName('bob')
  expect(a.id).toBe('skill')
  expect(a.name).toBe('bob')
  a.toStateless()
  expect(a.isStateless).toBeTruthy()
})

test('async getter', async () => {
  let a = A.proxy(startValue)
  a.setGetter(asyncFn)
  expect(a.isAsync).toBeFalsy()
  a()
  expect(a.value).toBe(startValue)
  expect(a.isAwaiting).toBeTruthy()
  await a()
  expect(a.isAwaiting).toBeFalsy()
  expect(a.value).toBe(finalValue)
})

test('clear', () => {
  let a = A.proxy()
  a(startValue)
  expect(a.isEmpty).toBeFalsy()
  a.next(beFinal)
  const clearResolver = jest.fn()
  a.onClear(clearResolver)
  a.clearValue()
  a.offClear(clearResolver)
  a.clearValue()
  expect(a.isEmpty).toBeTruthy()
  a.from(A(finalValue)).weak(v => v)
  a.clear()
  a(startValue)
  expect(clearResolver).toHaveBeenCalledTimes(1)
})

