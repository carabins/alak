import { AtomicModel, getAtomCluster } from 'alak/index'
import { atomicModel } from 'alak/atomicModel'
import { test } from 'tap'

test('atom events', (t) => {
  t.plan(5)
  class model {
    onEventHelloWorld(data) {
      t.pass(data)
    }
  }

  const a = atomicModel({
    name: 'a',
    model,
  })

  const b = atomicModel({
    name: 'b',
    model,
  })

  b.bus.dispatchEvent('HELLO_WORLD', 'just b')

  const cluster = getAtomCluster()

  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')
  a.bus.dispatchEvent('HELLO_WORLD', 'just a')
  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')

  t.end()
})
