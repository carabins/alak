/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { createAtom } from '@alaq/atom/index'
import { atomicNode } from '@alaq/molecule/atomicNode'
import molecule, { PartOfMolecule } from '@alaq/molecule/index'

abstract class Animal {
  abstract dispatchEvent(name: string, data?: any): void
}

class model {
  one = 1

  two: number

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
  model,
})
const b = atomicNode({
  model: class extends PartOfMolecule {
    two: number = 2
    inAOneUp(v) {
      this.two = v
    }
  },
})
const m = molecule({
  atoms: { a, b },
})
//
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
