import { test, expect } from 'bun:test'
import IndexedVertexMap from '../src/IndexedVertexMap'

test('IndexedVertexMap', () => {
  const ivm = IndexedVertexMap()
  ivm.push('one', 1)
  const indexOne = ivm.push('one', 11)
  let forEachCount = 0
  ivm.forEach('one', (value, index) => {
    if (index == '0' || index == '1') {
      forEachCount++
    }
  })

  expect(ivm.get('one').length === 2).toBeTruthy()

  ivm.remove('one', indexOne)
  expect(ivm.size('one') === 1).toBeTruthy()
  ivm.clearKey('one')
  expect(ivm.size('one') === 0).toBeTruthy()

  ivm.push('two', 2)
  ivm.clearAll()
  expect(ivm.size('two') === 0).toBeTruthy()
  expect(ivm.size('tree') === 0).toBeTruthy()

  expect(forEachCount).toBe(2)
})
