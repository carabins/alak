import { AlakModel, injectCluster } from 'alak/index'
import { alakModel } from 'alak/model'
import { ok, test } from 'tap'

test('atom events', (t) => {
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
  const cluster = injectCluster()
  cluster.bus.addEventListener('ATOM_INIT', (d) => {
    // console.log(d.name)
    switch (d.name) {
      case 'a':
        t.pass('ATOM_INIT a')
        break
      case 'b':
        t.pass('ATOM_INIT b')
        break
    }
  })
  b.bus.dispatchEvent('HELLO_WORLD', 'just b')

  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')
  a.bus.dispatchEvent('HELLO_WORLD', 'just a')
  cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')
  t.plan(7)
  t.end()
})

test('atom events silent', (t) => {
  class model {
    one = 1
  }

  const z = alakModel({
    name: 'z',
    model,
  })
  const cluster = injectCluster()
  cluster.bus.addEventListener('ATOM_INIT', () => {
    t.fail()
  })
  cluster.atoms.z.core
  cluster.atoms.z.state
  cluster.atoms.z.actions
  cluster.atoms.z.bus

  t.end()
})
