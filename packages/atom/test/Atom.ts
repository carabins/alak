import { test } from 'tap'

import bid from './bud'
import eternal from './bud/eternal'
import model from './bud/model'
test('core and state', async (t) => {
  const eth = new eternal()

  t.equal(bid.core.everCount.value, eth.everCount)
  t.equal(bid.state.everCount, eth.everCount)
  bid.core.addEverCount(1)
  eth.addEverCount(1)
  // console.log(bid.core.everCount.value)
  // console.log(eth.everCount)
  t.equal(bid.core.everCount.value, eth.everCount)
  t.equal(bid.state.everCount, eth.everCount)
  const m = new model()
  // console.log(bid.state.multiCount)
  // console.log(m.multiCount, bid.core.multiCount.value)
  t.equal(m.multiCount, bid.state.multiCount)
  t.equal(m.multiCount, bid.core.multiCount.value)
  t.end()

})
