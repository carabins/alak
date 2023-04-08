import { external } from '@alaq/atom/property'
import { AtomicModel, getAtomCluster } from 'alak/index'
import { atomicModel } from 'alak/atomicModel'
import { test } from 'tap'

class model extends AtomicModel {
  someVar = external.some_id('somevar')
  some = external()
}

const a = atomicModel({
  name: 'a',
  model,
})
const b = atomicModel({
  name: 'b',
  model,
  emitChanges: true,
})

const cluster = getAtomCluster()

test('atom init events', (t) => {
  t.plan(3)
  const listener = (event, data) => {
    switch (event) {
      case 'INIT':
        t.equal(data.nucleon.id, a.core.someVar.id)
        t.equal(data.nucleon.value, 'somevar')
        t.equal(data.external, 'some_id')
    }
  }
  cluster.bus.addEverythingListener(listener)
  a.core.someVar()
  cluster.bus.removeListener(listener)
  a.core.some(3)
  t.end()
})

test('atom change events', (t) => {
  t.plan(2)
  b.bus.addEventListener('NUCLEON_CHANGE', (n) => {
    if (n.value === 'nextVar' || n.value === 'somevar') {
      t.pass()
    } else {
      t.fail()
    }
  })
  b.core.someVar('nextVar')
  t.end()
})
