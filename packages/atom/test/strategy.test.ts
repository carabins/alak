/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { Atom } from '@alaq/atom/index'

class model {
  one = 1
}

test('nucleus strategy', (t) => {
  const statelessAtom = Atom({
    model,
    nucleusStrategy: 'stateless',
  })
  t.equal(statelessAtom.core.one.isStateless, true)
  t.equal(statelessAtom.state.one, undefined)
  const holyStateAtom = Atom({
    model,
    nucleusStrategy: 'holystate',
  })
  t.equal(holyStateAtom.core.one.isHoly, true)
  t.equal(holyStateAtom.core.one.isStateless, true)
  t.end()
})
