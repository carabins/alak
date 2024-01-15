import { test } from 'tap'

import bid from './bud'
import Model from './bud/model'

test('core and state', async (t) => {
  const classInstance = new Model()

  t.equal(bid.core.everCount.value, classInstance.everCount)
  t.equal(bid.state.everCount, classInstance.everCount)

  bid.core.addEverCount(1)
  classInstance.addEverCount(1)
  t.equal(bid.core.everCount.value, classInstance.everCount)
  t.equal(bid.state.everCount, classInstance.everCount)
  t.equal(classInstance.multiCount, bid.state.multiCount)
  t.equal(classInstance.multiCount, bid.core.multiCount.value)

  t.equal(classInstance.multiMethod(), bid.actions.multiMethod())

  t.equal(bid.state.taggedVar, 12)
  t.end()
})

// test('atom eves
test('atom events', async (t) => {
  bid.bus.addEverythingListener((event, data) => {
    switch (event) {
      case 'init':
        t.equal(data.external, 'some')
        t.equal(data.nucleon.value, '+')
        t.equal(data.nucleon.id, bid.core.someOtherVar.id)
        break
      case 'some':
        t.equal(event, 'some')
        break
      case 'someData':
        t.equal(event, 'someData')
        t.equal(data, '+')
        break
    }
  })
  bid.core.someOtherVar()
  bid.bus.dispatchEvent('some')
  bid.bus.dispatchEvent('someData', '+')
})
