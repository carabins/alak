/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { alakFactory, alakModel } from 'alak/model'
import { UnionFacade, UnionFactory } from 'alak/namespaces'

class model {
  one = 1
  two: number
  z: number

  addOne() {
    this.one++
  }

  onUpdateOne(v) {
    this.two = v
  }

  onEventNewOne(v) {
    this.one = v
  }

  onEventNewSome(v) {
    this.one = v
  }
}

test('cluster name', (t) => {
  const u = UnionFactory({
    namespace: 'extensionTest',
    singletons: {
      a: model,
      b: class {
        two: number = 2

        inAOneUp(v) {
          this.two = v
        }
      },
    },
    factories: {
      aa: model,
    },
    events: {
      NEW_ONE(data: number) {},
    },
  })
  t.plan(7)
  u.atoms.a.core.z(12)
  t.equal(u.states.a.z, 12)
  const aInstance = u.atoms.aa.get('A')
  aInstance.core.z(24)
  //
  const aInstanceFromMole = u.atoms['aa.A'] as any
  t.equal(aInstance.state.z, aInstanceFromMole.state.z)

  aInstance.actions.addOne()
  t.equal(aInstance.state.one, aInstanceFromMole.state.one)
  aInstanceFromMole.actions.addOne()
  t.equal(aInstance.state.one, aInstanceFromMole.state.one)

  u.atoms.a.actions.addOne()
  t.equal(u.states.a.two, 2)

  u.bus.dispatchEvent('NEW_ONE', 100)
  t.equal(u.states.a.one, 100)
  t.equal(u.states.a.one, u.states.b.two)
  t.end()
})
