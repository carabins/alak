import {rune} from '@alaq/atom/property'


import {test} from 'tap'
import {UnionConstructor} from 'alak/index'

class model {
  someVar = rune.some_id('somevar')
  some = rune()
}

const u = UnionConstructor({
  namespace: 'initEventTest',
  emitChanges: true,
  models: {
    a: model,
    b: model,
  },
})

const { a, b } = u.facade.atoms

test('atom init events', (t) => {
  t.plan(3)
  const listener = (event, data) => {
    switch (event) {
      case 'NUCLEUS_INIT':
        t.equal(data.nucleus.id, a.core.someVar.id)
        t.equal(data.nucleus.value, 'somevar')
        t.equal(data.rune, 'some_id')
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
