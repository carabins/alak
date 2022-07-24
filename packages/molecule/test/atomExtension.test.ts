/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { atomicModel, atomicFactory } from '@alaq/molecule/atomicModel'
import { getMolecule } from '@alaq/molecule/index'

class model {
  one = 1
  two: number
  z: number

  addOne() {
    this.one++
  }

  onOneUp(v) {
    this.two = v
  }

  onNewEventListener(v) {
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

const mole = getMolecule()
test('molecule name', (t) => {
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
  a.emitEvent('NEW_EVENT', 100)
  t.equal(a.state.one, 100)
  t.equal(a.state.one, b.state.two)
  t.end()
})
