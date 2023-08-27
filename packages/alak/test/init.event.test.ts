import { traced } from '@alaq/atom/property'
import { AlakModel } from 'alak/index'
import { alakModel } from 'alak/model'
import { test } from 'tap'
import { UnionFacade, UnionFactory } from 'alak/namespaces'

class model extends AlakModel {
  someVar = traced.some_id('somevar')
  some = traced()
}

const u = UnionFactory({
  namespace: 'initEventTest',
  emitChanges: true,
  models: {
    a: model,
    b: model,
  },
})

const { a, b } = u.atoms

test('atom init events', (t) => {
  t.plan(3)
  const listener = (event, data) => {
    switch (event) {
      case 'NUCLEUS_INIT':
        t.equal(data.nucleus.id, a.core.someVar.id)
        t.equal(data.nucleus.value, 'somevar')
        t.equal(data.traced, 'some_id')
        break
    }
  }
  u.bus.addEverythingListener(listener)
  a.core.someVar()
  u.bus.removeListener(listener)
  a.core.some(3)
  t.end()
})

test('atom change events', (t) => {
  t.plan(2)
  b.bus.addEventListener('NUCLEUS_CHANGE', (n) => {
    if (n.value === 'nextVar' || n.value === 'somevar') {
      t.pass()
    } else {
      t.fail()
    }
  })
  b.core.someVar('nextVar')
  t.end()
})
