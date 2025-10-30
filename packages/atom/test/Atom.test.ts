import { test, expect } from 'bun:test'

import bid from './bud'
import Model from './bud/model'

test('core and state', async () => {
  const classInstance = new Model()

  expect(bid.core.everCount.value).toBe(classInstance.everCount)
  expect(bid.state.everCount).toBe(classInstance.everCount)

  bid.core.addEverCount(1)
  classInstance.addEverCount(1)
  expect(bid.core.everCount.value).toBe(classInstance.everCount)
  expect(bid.state.everCount).toBe(classInstance.everCount)
  expect(classInstance.multiCount).toBe(bid.state.multiCount)
  expect(classInstance.multiCount).toBe(bid.core.multiCount.value)

  expect(classInstance.multiMethod()).toBe(bid.actions.multiMethod())

  expect(bid.state.taggedVar).toBe(12)
})

// test('atom eves
test('atom events', async () => {
  bid.bus.addEverythingListener((event, data) => {
    switch (event) {
      case 'init':
        expect(data.external).toBe('some')
        expect(data.nucleon.value).toBe('+')
        expect(data.nucleon.id).toBe(bid.core.someOtherVar.id)
        break
      case 'some':
        expect(event).toBe('some')
        break
      case 'someData':
        expect(event).toBe('someData')
        expect(data).toBe('+')
        break
    }
  })
  bid.core.someOtherVar()
  bid.bus.dispatchEvent('some')
  bid.bus.dispatchEvent('someData', '+')
})
