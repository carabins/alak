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

const cluster = getAtomCluster()

test('atom events', (t) => {
  t.plan(3)
  const listener = (event, data) => {
    switch (event) {
      case 'init':
        t.equal(data.nucleon.id, a.core.someVar.id)
        t.equal(data.nucleon.value, 'somevar')
        t.equal(data.external, 'some_id')
    }
  }
  // console.log('?', cluster.bus.id)
  cluster.bus.addEverythingListener(listener)
  // a.bus.addEverythingListener(listener)
  a.core.someVar()
  // cluster.bus.removeListener(listener)
  cluster.bus.removeListener(listener)
  a.core.some()
  t.end()
})
