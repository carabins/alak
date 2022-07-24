import { test } from 'tap'

import bid from './bud'
import Model from './bud/model'

test('core and state', async (t) => {
  const classInstance = new Model()

  // console.log(bid.core.everCount.value, eth.everCount)
  t.equal(bid.core.everCount.value, classInstance.everCount)
  t.equal(bid.state.everCount, classInstance.everCount)
  bid.core.addEverCount(1)
  classInstance.addEverCount(1)
  // // console.log(bid.core.everCount.value)
  // // console.log(eth.everCount)
  t.equal(bid.core.everCount.value, classInstance.everCount)
  t.equal(bid.state.everCount, classInstance.everCount)
  // console.log(bid.state.multiCount)
  // console.log(classInstance.multiCount, bid.core.multiCount.value)
  t.equal(classInstance.multiCount, bid.state.multiCount)
  t.equal(classInstance.multiCount, bid.core.multiCount.value)

  t.equal(classInstance.multiMethod(), bid.actions.multiMethod())
  // console.log(classInstance.multiMethod(), bid.actions.multiMethod())
  t.end()
})
