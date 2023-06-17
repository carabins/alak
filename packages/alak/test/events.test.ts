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
  const cluster = getAtomCluster()
  cluster.bus.addEventListener('ATOM_INIT', (d) => {
    console.log(d.atom.core.zzz)
  })
  b.bus.dispatchEvent('HELLO_WORLD', 'just b')

  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')
  a.bus.dispatchEvent('HELLO_WORLD', 'just a')
  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')

  const c = atomicModel({
    name: 'c',
    model,
  })

  c.state.zzz

  t.end()
})
