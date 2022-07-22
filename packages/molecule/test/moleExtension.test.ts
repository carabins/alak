/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { atomicNode } from '@alaq/molecule/atomicNode'
import { getMolecule, PartOfMolecule } from '@alaq/molecule/index'
import { createAtom } from '@alaq/atom/index'

abstract class Animal {
  abstract dispatchEvent(name: string, data?: any): void
}

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

const a = atomicNode({
  name: 'a',
  model,
})
const b = atomicNode({
  name: 'b',
  model: class {
    two: number = 2
    inAOneUp(v) {
      this.two = v
    }
  },
})

const mole = getMolecule()
test('molecule name', (t) => {
  mole.atoms.a.core.z(12)
  t.equal(a.state.z, 12)
  t.end()
})

test('up & event listeners', (t) => {
  a.actions.addOne()
  t.equal(a.state.two, 2)
  a.emitEvent('NEW_EVENT', 100)
  t.equal(a.state.one, 100)
  t.end()
})

test('inner atoms edges', (t) => {
  t.equal(a.state.one, b.state.two)
  t.end()
})
