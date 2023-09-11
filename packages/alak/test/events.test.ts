import { ok, test } from 'tap'
import { UnionFacade, UnionFactory } from 'alak/namespaces'

class model {
  eventState: string
  init: boolean = false
  lastInit: string
  onEventHelloWorld(data) {
    this.eventState = data
  }
  onEventAtomInit(data) {
    this.lastInit = data.name
  }
  onEventInit(data) {
    this.init = true
  }
}

const u = UnionFactory({
  namespace: 'eventsTests',
  singletons: { a: model, b: model },
  events: {
    HELLO_WORLD(data) {},
  },
})

declare module 'alak/namespaces' {
  export interface ActiveUnions {
    eventsTests: IUnionDevCore
  }
}

test('atom events', (t) => {
  const q = UnionFacade('eventsTests')
  u.bus.addEventListener('ATOM_INIT', (d) => {
    switch (d.name) {
      case 'a':
        t.pass('ATOM_INIT a')
        break
      case 'b':
        t.pass('ATOM_INIT b')
        break
    }
  })

  u.buses.a.dispatchEvent('HELLO_WORLD', 'a')
  t.ok(u.states.a.init)
  t.equal(u.states.a.eventState, 'a')

  u.buses.b.dispatchEvent('HELLO_WORLD', 'just b')
  t.equal(u.states.b.eventState, 'just b')
  t.equal(u.states.a.lastInit, 'b')

  u.bus.dispatchEvent('HELLO_WORLD', '---')
  t.equal(u.states.a.eventState, '---')

  t.plan(7)
  t.end()
})

test('atom events proxy silent', (t) => {
  class model {
    one = 1
  }

  const u = UnionFactory({
    namespace: 'eventsTests',
    singletons: { z: model },
    events: {
      HELLO_WORLD(data) {},
    },
  })

  u.bus.addEventListener('ATOM_INIT', () => {
    t.fail()
  })
  u.atoms.z.core
  u.atoms.z.state
  u.atoms.z.actions
  u.atoms.z.bus
  t.end()
})
