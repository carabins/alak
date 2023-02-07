/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { atomicFactory, atomicModel } from 'alak/atomicModel'
import { getAtomCluster } from 'alak/index'

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

const a = atomicModel({
  name: 'a',
  model,
})
const b = atomicModel({
  name: 'b',
  model: class {
    two: number = 2
    inAOneUp(v) {
      this.two = v
    }
  },
})

const multiA = atomicFactory({
  name: 'aa',
  model,
})

const mole = getAtomCluster()
test('cluster name', (t) => {
  t.plan(7)
  mole.atoms.a.core.z(12)
  t.equal(a.state.z, 12)
  const aInstance = multiA.get('A')
  aInstance.core.z(24)
  const aInstanceFromMole = mole.atoms['aa.A'] as any
  t.equal(aInstance.state.z, aInstanceFromMole.state.z)
  aInstance.actions.addOne()
  t.equal(aInstance.state.one, aInstanceFromMole.state.one)
  aInstanceFromMole.actions.addOne()
  t.equal(aInstance.state.one, aInstanceFromMole.state.one)
  a.actions.addOne()
  t.equal(a.state.two, 2)

  a.bus.dispatchEvent('NEW_ONE', 100)
  t.equal(a.state.one, 100)

  t.equal(a.state.one, b.state.two)
  t.end()
})
