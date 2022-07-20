/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { atomicNodes } from '@alaq/molecule/atomicNode'
import { MultiAtomic } from '@alaq/atom/index'
import { test } from 'tap'

class M extends MultiAtomic {
  one = 1
  add() {
    this.one++
  }
  idReturnMethod() {
    return this.id
  }
}

const baseAtom = atomicNodes({
  model: M,
})

const eAtom = atomicNodes({
  eternal: M,
})
test('multiAtoms', (t) => {
  const a = baseAtom.get(100)
  t.equal(a.core.idReturnMethod(), 100)

  const b = baseAtom.get(101)
  b.actions.add()
  t.notSame(a.state.one, b.state.one)

  const e1 = eAtom.get(1)
  e1.actions.add()
  const e2 = eAtom.get(2)

  t.notSame(e1.state.one, e2.state.one)

  t.end()
})
