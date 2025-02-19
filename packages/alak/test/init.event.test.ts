import { mixed, saved, tag } from '@alaq/atom/property'

import { test } from 'tap'
import { UnionConstructor } from 'alak/index'

class model {
  someVar = tag.some_id('somevar')
  some = tag()
}

class FactoryClass {
  graph = mixed(saved, tag.sync)
}

class FactoryPreInitClass {
  graph = mixed(saved, tag.sync)

  _on$init({ id }) {}

  _graph$once(v) {}
}

const u = UnionConstructor({
  namespace: 'initEventTest',
  emitChanges: true,
  models: {
    a: model,
    b: model,
  },
  factories: {
    book: FactoryClass,
    prebook: FactoryPreInitClass,
  },
  events: {
    NUCLEUS_INIT(n) {
      console.log(n.id)
    },
  },
})

//
const { a, b } = u.facade.atoms

test('atom events', (t) => {
  t.plan(3)
  const listener = (event, data) => {
    switch (event) {
      case 'NUCLEUS_INIT':
        t.equal(data.id, a.core.someVar.id)
        t.equal(data.value, 'somevar')
        t.equal(data.getMeta('tag'), 'some_id')
        break
    }
  }
  u.bus.addEverythingListener(listener)
  a.core.someVar()
  u.bus.removeListener(listener)
  a.core.some(3)
  t.end()
})
//
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

test('factory events', (t) => {
  t.plan(2)
  u.bus.addEventListener('NUCLEUS_INIT', (n) => {
    t.pass()
  })
  u.facade.atoms.prebook.get(200)
  u.facade.atoms.book.get(200).core.graph
  t.end()
})
