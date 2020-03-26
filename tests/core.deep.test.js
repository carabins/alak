const { A } = require('../facade')

const startValue = 'startValue'
const finalValue = 'finalValue'

test('name id meta', () => {
  let a = A.id('ground', startValue)
  expect(a.id).toBe('ground')
  expect(a.value).toBe(startValue)
  a.setId('sky')
  a.setName('bob')
  expect(a.id).toBe('sky')
  expect(a.name).toBe('bob')

  expect(a.hasMeta('x')).toBeFalsy()
  expect(a.getMeta('x')).toBeFalsy()

  a.addMeta('m')
  a.addMeta('k', finalValue)
  expect(a.hasMeta('m')).toBeTruthy()
  expect(a.getMeta('k')).toBe(finalValue)
  expect(A.id(finalValue).id).toBe(finalValue)
})

test('inject', () => {
  const a = A.id('start', finalValue)
  const o = {}
  a.injectOnce(o)
  a.injectOnce(o, 'final')
  expect(o).toHaveProperty('final', finalValue)
  expect(o).toHaveProperty('start', finalValue)

  const c = A(o)
  const c_clone = c.cloneValue()
  expect(c_clone.start).toBe(c.value.start)
  c.value.final = startValue
  expect(c_clone.final).not.toBe(c.value.final)
  expect(() => a.injectOnce(null)).toThrowError()
})

test('context', async () => {
  let a = A()
  a.setId('zero')
  expect(a.uid).toBeDefined()
  expect(a.uid).not.toBe(a.id)
  function fn(v, a) {
    expect(a.id).toBe('zero')
  }
  a.up(fn)
  a(startValue)
  expect.assertions(3)
})
