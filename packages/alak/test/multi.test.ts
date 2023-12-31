/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'

import { alakFactory } from 'alak/model'
 import { UnionFactory } from 'alak/namespaces'
import { UnionMultiModel } from 'alak/index'

class SubModel extends UnionMultiModel<"defaultUnion"> {
  get thisOne() {
    return this['one'] as number
  }
  get thisId() {
    return this.__.id as number
  }
}

class Model extends SubModel {
  one = 1

  add() {
    this.one++
  }

  getIdMethod() {
    return this.__.id
  }
  oneReturnMethod() {
    return this.thisOne
  }
}

const u = UnionFactory({
  namespace: 'defaultUnion',
  factories: {
    eAtom: Model,
    baseAtom: Model,
  },
})
const { baseAtom, eAtom } = u.atoms

test('multiAtoms', (t) => {
  const a = baseAtom.get(100)

  // console.log(a.state.thisId)
  t.equal(a.state.thisId, 100)
  t.equal(a.state.thisId, a.actions.getIdMethod())
  t.equal(a.core.oneReturnMethod(), a.state.thisOne)

  const b = baseAtom.get(101)
  b.actions.add()
  t.notSame(a.state.one, b.state.one)

  const e1 = eAtom.get(1)
  e1.actions.add()
  const e2 = eAtom.get(2)
  t.notSame(e1.state.one, e2.state.one)
  t.plan(5)
  t.end()
})
