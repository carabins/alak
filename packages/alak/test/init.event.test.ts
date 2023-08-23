import { traced } from '@alaq/atom/property'
import { AlakModel, UnionFacade } from 'alak/index'
import { alakModel } from 'alak/model'
import { test } from 'tap'

class model extends AlakModel {
  someVar = traced.some_id('somevar')
  some = traced()
}

const a = alakModel({
  name: 'a',
  model,
})
const b = alakModel({
  name: 'b',
  model,
  emitChanges: true,
})

const cluster = UnionFacade()

test('atom init events', (t) => {
  t.plan(3)
  const listener = (event, data) => {
    switch (event) {
      case 'NUCLEON_INIT':
        console.log(data)
        t.equal(data.nucleon.id, a.core.someVar.id)
        t.equal(data.nucleon.value, 'somevar')
        t.equal(data.traced, 'some_id')
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
