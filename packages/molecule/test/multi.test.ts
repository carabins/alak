/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { atomicFactory } from '@alaq/molecule/atomicModel'
import { MultiAtomic } from '@alaq/atom/index'
import { test } from 'tap'
import { PartOfMolecule } from '@alaq/molecule/index'

class submodel extends PartOfMolecule {
  get thisOne() {
    return this['one'] as number
  }
  get thisId() {
    return this._.id as number
  }
}

class model extends submodel {
  one = 1

  add() {
    this.one++
  }

  getIdMethod() {
    return this._.id
  }
  oneReturnMethod() {
    return this.thisOne
  }
}

const baseAtom = atomicFactory({
  name: 'baseAtom',
  model,
})

const eAtom = atomicFactory({
  name: 'aAtom',
  model,
  nucleusStrategy: 'eternal',
})

test('multiAtoms', (t) => {
  const a = baseAtom.get(100)

  t.equal(a.state.thisId, a.actions.getIdMethod())
  t.equal(a.core.oneReturnMethod(), a.state.thisOne)

  const b = baseAtom.get(101)
  b.actions.add()
  t.notSame(a.state.one, b.state.one)
  //
  const e1 = eAtom.get(1)
  e1.actions.add()
  const e2 = eAtom.get(2)
  t.notSame(e1.state.one, e2.state.one)
  t.end()
})
