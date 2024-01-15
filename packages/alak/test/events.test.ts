import {InjectUnionFacade, IUFacade, UnionConstructor} from "alak/index";
import {test} from "tap";

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

const uc = UnionConstructor({
  namespace: 'eventsTests',
  models: {a: model, b: model},
  events: {} as {
    HELLO_WORLD(s: string): void
  },
})

type ICT = typeof uc

declare module 'alak/namespaces' {
  interface ActiveUnions {
    eventsTests: typeof uc
  }
}

test('atom events', (t) => {
  const u = InjectUnionFacade('eventsTests')

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

  const {facade} = UnionConstructor({
    namespace: 'eventsTests',
    models: {z: model},
    events: {
      HELLO_WORLD(data) {
        console.log("----", this.states.a.init)
        t.pass(this.states.a.init)
      },
      ATOM_INIT() {
        console.log("---")
      }
    },
  })

  facade.bus.addEventListener('ATOM_INIT', () => {
    t.fail()
  })
  facade.atoms.z.core
  facade.atoms.z.state
  facade.atoms.z.actions
  facade.atoms.z.bus
  facade.bus.dispatchEvent("HELLO_WORLD", '+')
  t.end()
})
