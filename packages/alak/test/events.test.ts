import { ok, test } from 'tap'
import { UnionFacadeFactory, UnionFactory } from 'alak/namespaces'

class model {
  eventState: string
  onEventHelloWorld(data) {
    this.eventState = data
  }
}

const u = UnionFactory({
  namespace: 'eventsTests',
  models: { a: model, b: model },
  events: {
    HELLO_WORLD(s) {
      console.log(s)
    },
  },
})

declare module 'alak/namespaces' {
  export interface ActiveUnions {
    eventsTests: typeof u
  }
}

test('atom events', (t) => {
  const q = UnionFacadeFactory('eventsTests')
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

  // u.buses.b.dispatchEvent('HELLO_WORLD', 'just b')
  //
  // cluster.bus.dispatchEvent('HELLO_WORLD', 'clquster')
  // a.bus.dispatchEvent('HELLO_WORLD', 'just a')
  // cluster.bus.dispatchEvent('HELLO_WORLD', 'cluster')
  // t.plan(7)
  t.end()
})

// test('atom events silent', (t) => {
//   class model {
//     one = 1
//   }
//
//   const z = alakModel({
//     name: 'z',
//     model,
//   })
//   const cluster = UnionFacadeFactory()
//   cluster.bus.addEventListener('ATOM_INIT', () => {
//     t.fail()
//   })
//   cluster.atoms.z.core
//   cluster.atoms.z.state
//   cluster.atoms.z.actions
//   cluster.atoms.z.bus
//
//   t.end()
// })
