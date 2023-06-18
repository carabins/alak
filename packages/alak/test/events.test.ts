import { AlakModel, activeCluster } from 'alak/index'
import { alakModel } from 'alak/model'
import { test } from 'tap'

test('atom events', (t) => {
  t.plan(5)
  class model {
    onEventHelloWorld(data) {
      t.pass(data)
    }
  }

  const a = alakModel({
    name: 'a',
    model,
  })

  const b = alakModel({
    name: 'b',
    model,
  })
  const cluster = activeCluster()
  cluster.bus.addEventListener('ATOM_INIT', (d) => {
    console.log(d.atom.core.zzz)
  })
  b.bus.dispatchEvent('HELLO_WORLD', 'just b')

  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')
  a.bus.dispatchEvent('HELLO_WORLD', 'just a')
  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')

  // const c = alakModel({
  //   name: 'c',
  //   model,
  // })

  t.end()
})
