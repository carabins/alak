/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { AlakModel } from 'alak/index'
import { alakFactory } from 'alak/model'
import { UnionFactory } from 'alak/namespaces'

class submodel extends AlakModel {
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

const u = UnionFactory({
  namespace: 'muiltitest',
  models: {},
  factories: {
    eAtom: model,
    baseAtom: model,
  },
})
const { baseAtom, eAtom } = u.atoms

test('multiAtoms', (t) => {
  const a = baseAtom.get(100)

  t.equal(a.state.thisId, a.actions.getIdMethod())
  t.equal(a.core.oneReturnMethod(), a.state.thisOne)

  const b = baseAtom.get(101)
  b.actions.add()
  t.notSame(a.state.one, b.state.one)

  const e1 = eAtom.get(1)
  // e1.actions.add()
  // const e2 = eAtom.get(2)
  // t.notSame(e1.state.one, e2.state.one)
  t.end()
})
