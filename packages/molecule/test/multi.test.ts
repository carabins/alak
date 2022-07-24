/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { atomicFactory } from '@alaq/molecule/atomicModel'
import { MultiAtomic } from '@alaq/atom/index'
import { test } from 'tap'

class model extends MultiAtomic {
  one = 1

  add() {
    this.one++
  }

  get thisOne() {
    return this.one
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
  console.log(a.core.oneReturnMethod(), a.state.thisOne)
  // t.equal(a.core.oneReturnMethod(), a.state.thisOne)

  const b = baseAtom.get(101)
  b.actions.add()
  t.notSame(a.state.one, b.state.one)

  const e1 = eAtom.get(1)
  e1.actions.add()
  const e2 = eAtom.get(2)
  t.notSame(e1.state.one, e2.state.one)
  t.end()
})
